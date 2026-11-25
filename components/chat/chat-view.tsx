"use client";
// The conversation: useEveAgent (pinned eve 1.5.0) through the docs Worker, same origin.
// - Each send carries a clientMsgId (reused on retry) and the entry, as per-send headers.
// - The composer is disabled while a turn runs; Stop cancels it.
// - The stream closes when the session is idle (followWhile) and reopens on the next send.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useEveAgent } from "eve/react";
import { activeTurn, idle, session as sessionOf, turn as turnOf } from "eve/events";
import type { User } from "firebase/auth";
import { HTTP_ERRORS, isErrorCode } from "@/lib/chat-contract/http/http-errors";
import * as bridge from "@/lib/app-bridge";
import { newId } from "@/lib/app-bridge";
import { AssistantHeader, Bubble, Markdown, SourceChips, turnFacts, type ToolPart } from "./message";
import { AttachCard, HandoffForm, LimitCard, Pill, RatingCard, Secondary, SentCard, Primary } from "./cards";
import { attachReport, chatIdFor, fileTicket, sendFeedback, type Me } from "./api";
import { retrievedText } from "./verify";
import { COMPOSER_NOTE, MONEY_FOLLOWUP, SOLVED_FOLLOWUP, STUCK_FOLLOWUP } from "./copy";
import type { Entry, Surface } from "./events";
import { useChatEvents } from "./events";

type Msg = { id: string; role: "user" | "assistant"; parts: readonly any[]; metadata?: { turnId?: string; status?: string; optimistic?: true } };
type Limit = { code: string; retryAfter?: number };
type Handoff = { reason: "money" | "account" | "stuck" | "user_request" | "limit"; topic?: string; key: string };

const RATING_KEY = "andronix.chat.ratingShown";
const readFlag = (k: string) => { try { return localStorage.getItem(k) === "1"; } catch { return false; } };
const setFlag = (k: string) => { try { localStorage.setItem(k, "1"); } catch {} };

export function ChatView({ user, me, entry, surface, initialQuestion, pendingReportId, onMeStale, onNewChat, onLimitsChanged }: {
  user: User; me: Me; entry: Entry; surface: Surface; initialQuestion: string; pendingReportId: string | null;
  onMeStale: () => void; onNewChat: () => void; onLimitsChanged: () => void;
}) {
  const inApp = surface === "app_webview";
  const events = useChatEvents(entry, surface);
  const msgIdRef = useRef<string>("");
  const [draft, setDraft] = useState(initialQuestion);
  const [failed, setFailed] = useState<{ text: string; id: string } | null>(null);
  const [limit, setLimit] = useState<Limit | null>(null);
  const [cooldownUntil, setCooldownUntil] = useState(0);
  const [handoff, setHandoff] = useState<Handoff | null>(null);
  const [sent, setSent] = useState<Record<string, { ticketRef: string; topic?: string }>>({});
  const [formBusy, setFormBusy] = useState(false);
  const [formError, setFormError] = useState("");
  const [feedback, setFeedback] = useState<Record<string, "solved" | "stuck">>({});
  const [rating, setRating] = useState<"hidden" | "shown" | "done">("hidden");
  const [reportId, setReportId] = useState<string | null>(null);
  const [attachState, setAttachState] = useState<"offer" | "busy" | "done" | "dismissed">(inApp && entry === "app_help" ? "offer" : "dismissed");
  const [attachError, setAttachError] = useState("");
  const [now, setNow] = useState(Date.now());
  const codeChecked = useRef(new Set<string>());

  const agent = useEveAgent({
    baseUrl: "",
    auth: { bearer: async () => user.getIdToken() },
    followWhile: (view) => !idle(view),
    prepareSend: (input) => ({ ...input, headers: { ...(input.headers ?? {}), "x-chat-client-msg-id": msgIdRef.current, "x-chat-entry": entry } }),
    onFinish: () => onLimitsChanged(),
  });
  const view = agent.view;
  const sessionId = agent.session?.sessionId ?? null;
  const running = !!activeTurn(view) || agent.status === "busy";
  const ended = sessionOf(view).status === "ended";
  const messages = agent.messages as readonly Msg[];
  const retrieved = useMemo(() => retrievedText(messages as never), [messages]);

  // the report the app handed over (failed-install entry) binds to the session once it exists
  useEffect(() => {
    if (!sessionId || !pendingReportId || reportId) return;
    user.getIdToken().then((t) => attachReport(t, sessionId, pendingReportId)).then(() => setReportId(pendingReportId)).catch(() => {});
  }, [sessionId, pendingReportId, reportId, user]);

  useEffect(() => { if (cooldownUntil > Date.now()) { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); } }, [cooldownUntil]);

  const send = useCallback(async (text: string, retryId?: string) => {
    const message = text.trim();
    if (!message || running || ended) return;
    msgIdRef.current = retryId ?? newId();
    setLimit(null); setFailed(null);
    setDraft("");
    try {
      await agent.send(message);
      onLimitsChanged();
    } catch (e) {
      const code = (e as { code?: string }).code ?? "";
      let retryAfter: number | undefined;
      try { retryAfter = JSON.parse((e as { body?: string }).body ?? "{}").retryAfter; } catch {}
      if (code === "chat_full") { setLimit({ code }); return; }
      if (code === "auth") { onMeStale(); setFailed({ text: message, id: msgIdRef.current }); setDraft(message); return; }
      if (code === "rate_minute") { setCooldownUntil(Date.now() + (retryAfter ?? 20) * 1000); setDraft(message); setFailed({ text: message, id: msgIdRef.current }); return; }
      if (isErrorCode(code) && (HTTP_ERRORS[code].status === 429 || HTTP_ERRORS[code].status === 503)) {
        setLimit({ code, retryAfter }); setDraft(message); onLimitsChanged(); return;
      }
      setFailed({ text: message, id: msgIdRef.current });
    }
  }, [agent, running, ended, onMeStale, onLimitsChanged]);

  // A question pre-filled from #q is never auto-sent; the box just holds it.

  // ---- per-turn grouping ----
  type Turn = { turnId: string; user: Msg[]; assistant: Msg[]; tools: ToolPart[]; text: string };
  const turns = useMemo(() => {
    const out: Turn[] = [];
    const byId = new Map<string, Turn>();
    for (const m of messages) {
      const tid = m.metadata?.turnId ?? `local:${m.id}`;
      let t = byId.get(tid);
      if (!t) { t = { turnId: tid, user: [], assistant: [], tools: [], text: "" }; byId.set(tid, t); out.push(t); }
      if (m.role === "user") t.user.push(m);
      else {
        t.assistant.push(m);
        for (const p of m.parts) {
          if (p.type === "tool") t.tools.push(p as ToolPart);
          if (p.type === "text") t.text += (t.text ? "\n\n" : "") + p.text;
        }
      }
    }
    return out;
  }, [messages]);

  const settledInfo = (t: { turnId: string }) => {
    const o = t.turnId.startsWith("local:") ? undefined : turnOf(view, t.turnId);
    return { settled: o?.status === "settled", outcome: o?.outcome, error: o?.error };
  };

  // chat_code_check once per settled turn with code blocks
  useEffect(() => {
    if (!sessionId) return;
    for (const t of turns) {
      const s = settledInfo(t);
      if (!s.settled || codeChecked.current.has(t.turnId)) continue;
      codeChecked.current.add(t.turnId);
      const f = turnFacts(t.text, retrieved);
      if (f.blocks) chatIdFor(sessionId).then((chat_id) => events.track("chat_code_check", { chat_id, blocks: f.blocks, unverified: f.unverified }));
    }
  });

  // the last settled completed turn without offer_handoff that has steps or a verified command
  const feedbackTurn = useMemo(() => {
    const last = [...turns].reverse().find((t) => !t.turnId.startsWith("local:"));
    if (!last) return null;
    const s = settledInfo(last);
    if (!s.settled || s.outcome !== "completed" || last.tools.some((p) => p.name === "offer_handoff")) return null;
    const f = turnFacts(last.text, retrieved);
    return f.hasSteps || f.verifiedCode > 0 ? last.turnId : null;
  }, [turns, view, retrieved]); // eslint-disable-line react-hooks/exhaustive-deps

  const submitTicket = async (h: Handoff, v: { orderId?: string; note?: string; includeChat: boolean }) => {
    setFormBusy(true); setFormError("");
    try {
      const token = await user.getIdToken();
      const r = await fileTicket(token, { sessionId: sessionId ?? undefined, reason: h.reason, topic: h.topic, orderId: v.orderId, note: v.note, includeChat: v.includeChat && !!sessionId, reportId: reportId ?? undefined });
      setSent((s) => ({ ...s, [h.key]: { ticketRef: r.ticketRef, topic: h.topic } }));
      if (handoff?.key === h.key) setHandoff(null);
    } catch (e) {
      const code = (e as { code?: string }).code;
      setFormError(code === "tickets" ? "You've sent the most support requests for today. Our team will reply to the ones you sent." : "That didn't send. Try again.");
    } finally { setFormBusy(false); }
  };

  const onFeedback = async (turnId: string, value: "solved" | "stuck") => {
    if (!sessionId || feedback[turnId]) return;
    setFeedback((f) => ({ ...f, [turnId]: value }));
    user.getIdToken().then((t) => sendFeedback(t, sessionId, turnId, value)).catch(() => {});
    if (value === "solved" && !readFlag(RATING_KEY)) { setFlag(RATING_KEY); setRating("shown"); events.track("chat_rating_prompt", { action: "shown" }); }
    if (value === "stuck") setHandoff({ reason: "stuck", topic: "install", key: `stuck:${turnId}` });
  };

  const [pendingAttach, setPendingAttach] = useState<string | null>(null);
  // the rail's "Send to support team" opens the form here
  useEffect(() => {
    const open = () => setHandoff({ reason: "user_request", topic: "other", key: `user:${Date.now()}` });
    window.addEventListener("andronix-chat-support", open);
    return () => window.removeEventListener("andronix-chat-support", open);
  }, []);

  const onAttach = async () => {
    setAttachState("busy"); setAttachError("");
    try {
      const { reportId: id } = await bridge.createReport();
      if (sessionId) { await attachReport(await user.getIdToken(), sessionId, id); setReportId(id); }
      else setPendingAttach(id);
      setAttachState("done");
    } catch (e) {
      setAttachState("offer");
      setAttachError((e as { code?: string }).code === "cancelled" ? "" : "The report didn't attach. Try again.");
    }
  };
  useEffect(() => {
    if (!sessionId || !pendingAttach) return;
    user.getIdToken().then((t) => attachReport(t, sessionId, pendingAttach)).then(() => { setReportId(pendingAttach); setPendingAttach(null); }).catch(() => {});
  }, [sessionId, pendingAttach, user]);

  const cooling = cooldownUntil > now;
  const docsHref = inApp ? "/?embed=app" : "/";
  const userMessages = messages.filter((m) => m.role === "user").length;
  const left = Math.max(0, me.limits.day.max - me.limits.day.used);

  return (
    <div className="chat-thread">
      {reportId && <div className="flex justify-end"><Pill tone="ok">Report {reportId} attached</Pill></div>}
      {messages.length === 0 && !limit && (
        <div className="chat-empty">
          <AssistantHeader />
          <p>Ask about installing a distro, the desktop, Termux, or an error you see. Answers come from the Andronix docs.</p>
        </div>
      )}
      {attachState === "offer" || attachState === "busy" ? (
        <AttachCard onAttach={onAttach} onDismiss={() => setAttachState("dismissed")} busy={attachState === "busy"} error={attachError} />
      ) : null}

      {turns.map((t) => {
        const s = settledInfo(t);
        const handoffPart = t.tools.find((p) => p.name === "offer_handoff" && p.input && typeof p.input === "object");
        const hi = handoffPart?.input as { reason?: Handoff["reason"]; topic?: string } | undefined;
        const hKey = `tool:${t.turnId}`;
        return (
          <div key={t.turnId} className="flex flex-col gap-3">
            {t.user.map((m) => (
              <div key={m.id} className="flex justify-end">
                <Bubble>{m.parts.filter((p) => p.type === "text").map((p) => p.text).join("\n")}</Bubble>
              </div>
            ))}
            {(t.assistant.length > 0 || (!s.settled && !t.turnId.startsWith("local:"))) && (
              <div className="flex flex-col gap-3">
                <AssistantHeader />
                {t.text ? <Markdown text={t.text} settled={s.settled} retrieved={retrieved} /> : !s.settled ? <p className="chat-thinking">Looking in the docs…</p> : null}
                {s.settled && s.outcome === "failed" && <p className="chat-error">Something went wrong. Try again.</p>}
                {s.settled && s.outcome === "cancelled" && <p className="chat-small">Stopped.</p>}
                <SourceChips tools={t.tools} />
                {handoffPart && hi?.reason && (sent[hKey]
                  ? <><SentCard ticketRef={sent[hKey].ticketRef} topic={sent[hKey].topic} email={user.email ?? ""} /><AssistantHeader /><p>{MONEY_FOLLOWUP}</p></>
                  : <HandoffForm reason={hi.reason} topic={hi.topic} email={user.email ?? ""} reportId={reportId} messages={userMessages * 2} canIncludeChat={!!sessionId}
                      busy={formBusy} error={handoff?.key === hKey || !handoff ? formError : ""}
                      onSubmit={(v) => submitTicket({ reason: hi.reason!, topic: hi.topic, key: hKey }, v)} />)}
                {feedbackTurn === t.turnId && (
                  <div className="chat-card">
                    <p className="chat-card-title">Did that fix it?</p>
                    <div className="grid grid-cols-2 gap-2">
                      <button type="button" className={`chat-btn ${feedback[t.turnId] === "solved" ? "chat-btn-primary" : "chat-btn-secondary"}`} disabled={!!feedback[t.turnId]} onClick={() => onFeedback(t.turnId, "solved")}>Solved</button>
                      <button type="button" className={`chat-btn ${feedback[t.turnId] === "stuck" ? "chat-btn-primary" : "chat-btn-secondary"}`} disabled={!!feedback[t.turnId]} onClick={() => onFeedback(t.turnId, "stuck")}>Still stuck</button>
                    </div>
                  </div>
                )}
                {feedback[t.turnId] === "solved" && <><AssistantHeader /><p>{SOLVED_FOLLOWUP}</p></>}
                {feedback[t.turnId] === "solved" && rating === "shown" && (
                  <RatingCard inApp={inApp}
                    onRate={() => { setRating("done"); events.track("chat_rating_prompt", { action: "rate" }); if (inApp) bridge.openPlayRating().catch(() => {}); }}
                    onDismiss={() => { setRating("done"); events.track("chat_rating_prompt", { action: "dismiss" }); }} />
                )}
                {feedback[t.turnId] === "stuck" && <><AssistantHeader /><p>{STUCK_FOLLOWUP}</p></>}
              </div>
            )}
          </div>
        );
      })}

      {handoff && !handoff.key.startsWith("tool:") && (sent[handoff.key]
        ? <SentCard ticketRef={sent[handoff.key].ticketRef} topic={sent[handoff.key].topic} email={user.email ?? ""} />
        : <HandoffForm reason={handoff.reason} topic={handoff.topic} email={user.email ?? ""} reportId={reportId} messages={userMessages * 2} canIncludeChat={!!sessionId}
            busy={formBusy} error={formError} onSubmit={(v) => submitTicket(handoff, v)} />)}
      {Object.entries(sent).filter(([k]) => !k.startsWith("tool:") && handoff?.key !== k).map(([k, v]) => (
        <SentCard key={k} ticketRef={v.ticketRef} topic={v.topic} email={user.email ?? ""} />
      ))}

      {failed && !cooling && (
        <div className="flex items-center gap-3">
          <p className="chat-error">Something went wrong. Try again.</p>
          <Secondary className="!w-auto px-4" onClick={() => send(failed.text, failed.id)}>Try again</Secondary>
        </div>
      )}
      {(ended || limit?.code === "chat_full") && (
        <div className="chat-card">
          <p className="chat-card-title">This chat is full. Start a new chat.</p>
          <Primary onClick={onNewChat}>New chat</Primary>
        </div>
      )}
      {limit && limit.code !== "chat_full" && (
        <LimitCard code={limit.code} retryAfter={limit.retryAfter} dayMax={me.limits.day.max} docsHref={docsHref} inApp={inApp}
          onSupport={() => setHandoff({ reason: "limit", topic: "other", key: `limit:${Date.now()}` })}
          onReport={inApp ? () => bridge.createReport().catch(() => {}) : undefined} />
      )}

      <form className="chat-composer" onSubmit={(e) => { e.preventDefault(); if (!cooling) send(draft, failed && failed.text === draft.trim() ? failed.id : undefined); }}>
        <textarea
          aria-label="Your question"
          value={draft}
          onChange={(e) => setDraft(e.target.value.slice(0, 2000))}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); (e.currentTarget.form as HTMLFormElement).requestSubmit(); } }}
          placeholder={messages.length ? "Ask a follow-up" : "Type your question"}
          rows={1}
          disabled={ended}
        />
        {running
          ? <button type="button" className="chat-send chat-send-stop" onClick={() => agent.cancel().catch(() => {})}>Stop</button>
          : <button type="submit" className="chat-send" disabled={!draft.trim() || cooling || ended}>Send</button>}
      </form>
      <p className={`chat-composer-note ${cooling ? "chat-composer-warn" : ""}`}>
        {cooling ? `One moment. You can send again in ${Math.ceil((cooldownUntil - now) / 1000)} s.`
          : limit ? "Limits are per account and reset at 00:00 UTC."
          : COMPOSER_NOTE}
        {!cooling && !limit && <span className="chat-mobile-only"> {left} left today.</span>}
      </p>
    </div>
  );
}
