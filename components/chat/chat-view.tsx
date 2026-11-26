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
import { AssistantHeader, Bubble, CopyButton, Markdown, SourceChips, turnFacts, type ToolPart } from "./message";
import { ImageTile, ImageViewer } from "./image-viewer";
import { Appear, Presence, useMotionReduced } from "./motion";
import { ThinkingTrace } from "./progress";
import { ApprovalCard, AttachCard, DeclineCard, HandoffForm, LimitCard, Pill, RatingCard, Secondary, SentCard, Primary } from "./cards";
import { attachReport, chatIdFor, fileTicket, sendFeedback, type Me } from "./api";
import { retrievedUnits } from "./verify";
import { reportChip } from "./report-chip";
import { refusalKey } from "./refusals";
import { COMPOSER_NOTE, MONEY_FOLLOWUP, SOLVED_FOLLOWUP, STUCK_FOLLOWUP } from "./copy";
import { ATTACH_NOTICE, IMAGE_ACCEPT, IMAGE_ONLY_TEXT, PER_MESSAGE, deleteImage, isAcceptedType, maskAssistantText, prepareImage, splitUserText, uploadErrorText, uploadImage, type Attachment, type UploadError } from "./images";
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
  const awaitEndRef = useRef(false);
  const [sessionGone, setSessionGone] = useState(false);
  const [draft, setDraft] = useState(initialQuestion);
  const [failed, setFailed] = useState<{ text: string; id: string; images?: string[] } | null>(null);
  // image attachments (support-chat-images.md §4): chips in the composer, previews kept by image id
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [previews, setPreviews] = useState<Record<string, { thumb: string; full: string }>>({});
  // the image viewer: the full in-memory copy, opened from a tile (local only)
  const [viewer, setViewer] = useState<string | null>(null);
  // the composer dock's height, for the message list's bottom padding / scroll padding
  const dockRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = dockRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const set = () => document.documentElement.style.setProperty("--chat-dock-h", `${Math.ceil(el.getBoundingClientRect().height)}px`);
    set();
    const ro = new ResizeObserver(set);
    ro.observe(el);
    return () => { ro.disconnect(); document.documentElement.style.removeProperty("--chat-dock-h"); };
  }, []);
  const [inflightImages, setInflightImages] = useState<string[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const imagesRef = useRef<string[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const imagesOn = !!me.images?.enabled && (!inApp || bridge.appCaps().includes("file"));
  const [limit, setLimit] = useState<Limit | null>(null);
  const [cooldownUntil, setCooldownUntil] = useState(0);
  const [handoff, setHandoff] = useState<Handoff | null>(null);
  const [sent, setSent] = useState<Record<string, { ticketRef: string; topic?: string }>>({});
  const [formBusy, setFormBusy] = useState(false);
  // the handoff button shows a check for a moment before the sent card replaces the form
  const [formDone, setFormDone] = useState<string | null>(null);
  // the Send button's spinner while the message POST is in flight
  const [sending, setSending] = useState(false);
  const reducedMotion = useMotionReduced();
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
    // idle → close the stream; but after a jailbreak/harmful decline eve ends the session on the
    // next line (turn-outcome hook), so keep reading until that session.ended arrives
    followWhile: (view) => !idle(view) || awaitEndRef.current,
    prepareSend: (input) => ({
      ...input,
      headers: {
        ...(input.headers ?? {}), "x-andronix-client-msg-id": msgIdRef.current, "x-andronix-entry": entry,
        ...(imagesRef.current.length ? { "x-andronix-images": imagesRef.current.join(",") } : {}),
      },
    }),
    onFinish: () => onLimitsChanged(),
  });
  const view = agent.view;
  const sessionId = agent.session?.sessionId ?? null;
  const running = !!activeTurn(view) || agent.status === "busy";
  const ended = sessionOf(view).status === "ended" || sessionGone;
  const messages = agent.messages as readonly Msg[];
  const retrieved = useMemo(() => retrievedUnits(messages as never), [messages]);

  // the report the app handed over (failed-install entry) binds to the session once it exists;
  // the chip shows it from the start (reportChip)
  const [reportFailed, setReportFailed] = useState<string | null>(null);
  useEffect(() => {
    if (!sessionId || !pendingReportId || reportId || reportFailed) return;
    user.getIdToken().then((t) => attachReport(t, sessionId, pendingReportId)).then(() => setReportId(pendingReportId)).catch(() => setReportFailed(pendingReportId));
  }, [sessionId, pendingReportId, reportId, reportFailed, user]);

  useEffect(() => { if (cooldownUntil > Date.now()) { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); } }, [cooldownUntil]);

  const uploading = attachments.some((a) => a.status === "uploading");
  const send = useCallback(async (text: string, retryId?: string, retryImages?: string[]) => {
    const message = text.trim();
    const kept = attachments;
    const ids = retryImages ?? attachments.filter((a) => a.status === "ready" && a.imageId).map((a) => a.imageId!);
    if ((!message && ids.length === 0) || running || ended || uploading) return;
    msgIdRef.current = retryId ?? newId();
    imagesRef.current = ids;
    setLimit(null); setFailed(null);
    setDraft("");
    if (!retryImages) setAttachments([]);
    setInflightImages(ids);
    const restore = () => { if (!retryImages && ids.length) setAttachments(kept); };
    try {
      setSending(true);
      await agent.send(message || IMAGE_ONLY_TEXT).finally(() => setSending(false));
      onLimitsChanged();
    } catch (e) {
      const code = (e as { code?: string }).code ?? "";
      let retryAfter: number | undefined;
      try { retryAfter = JSON.parse((e as { body?: string }).body ?? "{}").retryAfter; } catch {}
      if (code === "chat_full") { setLimit({ code }); return; }
      // eve ended the session without a card we saw (e.g. its output guard): offer a new chat
      if (code === "session_not_active" || (e as { name?: string }).name === "SessionNotActiveError") { setSessionGone(true); setDraft(message); return; }
      if (code === "auth") { onMeStale(); setFailed({ text: message, id: msgIdRef.current, images: ids }); setDraft(message); return; }
      if (code === "rate_minute") { setCooldownUntil(Date.now() + (retryAfter ?? 20) * 1000); setDraft(message); restore(); return; }
      if (code === "image_limit") { setLimit({ code, retryAfter }); setDraft(message); onLimitsChanged(); return; }
      if (isErrorCode(code) && (HTTP_ERRORS[code].status === 429 || HTTP_ERRORS[code].status === 503)) {
        setLimit({ code, retryAfter }); setDraft(message); restore(); onLimitsChanged(); return;
      }
      setFailed({ text: message, id: msgIdRef.current, images: ids });
    } finally {
      imagesRef.current = [];
    }
  }, [agent, running, ended, uploading, attachments, onMeStale, onLimitsChanged]);

  // ---- attachments ----
  const chatImageCount = useMemo(() => messages.filter((m) => m.role === "user").reduce((n, m) => n + splitUserText(m.parts.filter((p) => p.type === "text").map((p) => p.text).join("\n")).imageIds.length, 0), [messages]);
  const perChat = me.images?.perChat ?? 4;
  const addFiles = useCallback(async (files: File[]) => {
    if (!imagesOn || ended) return;
    const room = Math.max(0, Math.min(PER_MESSAGE - attachments.length, perChat - chatImageCount - attachments.length));
    for (const file of files.slice(0, room)) {
      const localId = newId();
      if (!isAcceptedType(file.type)) {
        setAttachments((a) => [...a, { localId, status: "failed", preview: "", error: uploadErrorText({ code: "image_type" }) }]);
        continue;
      }
      setAttachments((a) => [...a, { localId, status: "uploading", preview: "" }]);
      try {
        const { body, preview, full } = await prepareImage(file);
        setAttachments((a) => a.map((x) => (x.localId === localId ? { ...x, preview, full } : x)));
        const r = await uploadImage(await user.getIdToken(), body);
        setPreviews((p) => ({ ...p, [r.imageId]: { thumb: preview, full } }));
        setAttachments((a) => {
          if (!a.some((x) => x.localId === localId)) { user.getIdToken().then((t) => deleteImage(t, r.imageId)); return a; } // removed while uploading
          return a.map((x) => (x.localId === localId ? { ...x, status: "ready", imageId: r.imageId } : x));
        });
        onLimitsChanged();
      } catch (e) {
        setAttachments((a) => a.map((x) => (x.localId === localId ? { ...x, status: "failed", error: uploadErrorText(e as UploadError) } : x)));
      }
    }
  }, [imagesOn, ended, attachments.length, perChat, chatImageCount, user, onLimitsChanged]);
  const removeAttachment = (a: Attachment) => {
    setAttachments((list) => list.filter((x) => x.localId !== a.localId));
    if (a.imageId) user.getIdToken().then((t) => deleteImage(t, a.imageId!)).then(() => onLimitsChanged());
  };
  const imageFiles = (list: FileList | DataTransferItemList | null | undefined): File[] => {
    if (!list) return [];
    const out: File[] = [];
    for (const it of Array.from(list as ArrayLike<File | DataTransferItem>)) {
      const f = it instanceof File ? it : it.kind === "file" ? it.getAsFile() : null;
      if (f && f.type.startsWith("image/")) out.push(f);
    }
    return out;
  };
  const canAddMore = imagesOn && !ended && attachments.length < PER_MESSAGE && chatImageCount + attachments.length < perChat;

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
    if (!s.settled || s.outcome !== "completed" || last.tools.some((p) => p.name === "offer_handoff" || p.name === "decline")) return null;
    const f = turnFacts(last.text, retrieved);
    return f.hasSteps || f.verifiedCode > 0 ? last.turnId : null;
  }, [turns, view, retrieved]); // eslint-disable-line react-hooks/exhaustive-deps

  // jailbreak / harmful (and an output-guard stop) end the session from eve's turn-outcome hook
  {
    const last = [...turns].reverse().find((t) => !t.turnId.startsWith("local:"));
    const d = last?.tools.find((p) => p.name === "decline")?.input as { reason?: string } | undefined;
    awaitEndRef.current = !ended && (d?.reason === "jailbreak" || d?.reason === "harmful");
  }
  // the idle close can win the race with eve's session.ended line: catch up once to see it
  const resumedFor = useRef<string | null>(null);
  const lastTurnId = turns.length ? turns[turns.length - 1].turnId : null;
  useEffect(() => {
    if (!awaitEndRef.current || ended || agent.status !== "idle" || !lastTurnId || resumedFor.current === lastTurnId) return;
    resumedFor.current = lastTurnId;
    agent.resume().catch(() => {});
  });
  const endedByRefusal = sessionGone || ended && (agent.events as readonly { type: string; data?: { cause?: { hook?: string } } }[])
    .some((e) => e.type === "session.ended" && e.data?.cause?.hook === "turn-outcome");

  const submitTicket = async (h: Handoff, v: { orderId?: string; note?: string; includeChat: boolean; includeImages?: boolean }) => {
    setFormBusy(true); setFormError("");
    try {
      const token = await user.getIdToken();
      const r = await fileTicket(token, {
        sessionId: sessionId ?? undefined, reason: h.reason, topic: h.topic, orderId: v.orderId, note: v.note, includeChat: v.includeChat && !!sessionId, reportId: reportId ?? undefined,
        ...(v.includeImages && sessionId ? { includeImages: true } : {}),
      });
      setFormDone(h.key);
      if (!reducedMotion) await new Promise((res) => setTimeout(res, 700));
      setFormDone(null);
      setSent((s) => ({ ...s, [h.key]: { ticketRef: r.ticketRef, topic: h.topic } }));
      if (handoff?.key === h.key) setHandoff(null);
    } catch (e) {
      const code = (e as { code?: string }).code;
      const detail = (e as { body?: { error?: string } | null }).body?.error;
      setFormError(code === "tickets" ? "You've sent the most support requests for today. Our team will reply to the ones you sent."
        : code === "bad_body" && detail ? detail : "That didn't send. Try again.");
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
    user.getIdToken().then((t) => attachReport(t, sessionId, pendingAttach)).then(() => { setReportId(pendingAttach); setPendingAttach(null); }).catch(() => { setReportFailed(pendingAttach); setPendingAttach(null); });
  }, [sessionId, pendingAttach, user]);

  const chip = reportChip({ bound: reportId, pending: reportId ? null : pendingAttach ?? pendingReportId, failed: reportFailed });
  const cooling = cooldownUntil > now;
  const ticketImageCount = turns.filter((t) => !t.tools.some((p) => p.name === "decline"))
    .reduce((n, t) => n + t.user.reduce((k, m) => k + splitUserText(m.parts.filter((p) => p.type === "text").map((p) => p.text).join("\n")).imageIds.length, 0), 0);
  const docsHref = inApp ? "/?embed=app" : "/";
  const userMessages = messages.filter((m) => m.role === "user").length;
  const left = Math.max(0, me.limits.day.max - me.limits.day.used);

  return (
    <div className="chat-thread">
      <Presence initial={false}>
        {chip && <Appear key={`chip-${chip.text}`} kind="fade" className="flex justify-end"><Pill tone={chip.tone}>{chip.text}</Pill></Appear>}
        {messages.length === 0 && !limit && (
          <Appear key="intro" kind="fade" className="chat-empty">
            <AssistantHeader />
            <p>Ask about installing a distro, the desktop, Termux, or an error you see. Answers come from the Andronix docs.</p>
          </Appear>
        )}
        {(attachState === "offer" || attachState === "busy") && (
          <Appear key="attach"><AttachCard onAttach={onAttach} onDismiss={() => setAttachState("dismissed")} busy={attachState === "busy"} error={attachError} /></Appear>
        )}
      </Presence>

      {turns.map((t) => {
        const s = settledInfo(t);
        const handoffPart = t.tools.find((p) => p.name === "offer_handoff" && p.input && typeof p.input === "object");
        const hi = handoffPart?.input as { reason?: Handoff["reason"]; topic?: string } | undefined;
        const hKey = `tool:${t.turnId}`;
        const declinePart = t.tools.find((p) => p.name === "decline");
        return (
          // keyed by the first user message: its id survives optimistic → confirmed, the turn id doesn't
          <div key={t.user[0]?.id ?? t.turnId} className="flex flex-col gap-3">
            {t.user.map((m) => {
              const u = splitUserText(m.parts.filter((p) => p.type === "text").map((p) => p.text).join("\n"));
              const ids = m.metadata?.optimistic ? inflightImages : u.imageIds;
              return (
                <Appear key={m.id} className="flex flex-col items-end gap-1.5">
                  {ids.length > 0 && (
                    <div className="chat-image-row">
                      {ids.map((id) => previews[id]?.thumb
                        ? <Appear key={id} kind="scale"><ImageTile src={previews[id].thumb} label="Attached screenshot" onOpen={() => setViewer(previews[id].full || previews[id].thumb)} /></Appear>
                        : <span key={id} className="chat-image-chip">Image</span>)}
                    </div>
                  )}
                  {u.text && <Bubble>{u.text}</Bubble>}
                </Appear>
              );
            })}
            {(t.assistant.length > 0 || (!s.settled && !t.turnId.startsWith("local:"))) && (
              // the answer container animates in once; streamed text updates inside it, never per token
              <Appear className="flex flex-col gap-3">
                <AssistantHeader />
                {!declinePart && <ThinkingTrace tools={t.tools} working={!s.settled} hasText={!!t.text} />}
                {/* a turn with `decline` shows only the fixed card; its text is dropped (guardrails §1, layer 4) */}
                {declinePart
                  ? <Appear key="decline"><DeclineCard reason={refusalKey(declinePart.input)} docsHref={docsHref} onSupport={() => setHandoff({ reason: "user_request", topic: "other", key: `decline:${t.turnId}` })} /></Appear>
                  : t.text ? <Markdown text={maskAssistantText(t.text)} settled={s.settled} retrieved={retrieved} /> : null}
                {s.settled && t.text && !declinePart && (
                  <div className="chat-answer-actions"><CopyButton text={maskAssistantText(t.text)} label="Copy answer" className="chat-answer-copy" /></div>
                )}
                {s.settled && s.outcome === "failed" && !ended && <p className="chat-error">Something went wrong. Try again.</p>}
                {s.settled && s.outcome === "cancelled" && <p className="chat-small">Stopped.</p>}
                {!declinePart && <SourceChips tools={t.tools} />}
                <Presence initial={false}>
                {handoffPart && hi?.reason && (sent[hKey]
                  ? <Appear key="sent" className="flex flex-col gap-3"><SentCard ticketRef={sent[hKey].ticketRef} topic={sent[hKey].topic} email={user.email ?? ""} /><AssistantHeader /><p>{MONEY_FOLLOWUP}</p></Appear>
                  : <Appear key="form"><HandoffForm reason={hi.reason} topic={hi.topic} email={user.email ?? ""} reportId={reportId} messages={userMessages * 2} canIncludeChat={!!sessionId} imageCount={ticketImageCount}
                      busy={formBusy && formDone !== hKey} done={formDone === hKey} error={handoff?.key === hKey || !handoff ? formError : ""}
                      onSubmit={(v) => submitTicket({ reason: hi.reason!, topic: hi.topic, key: hKey }, v)} /></Appear>)}
                {feedbackTurn === t.turnId && !feedback[t.turnId] && (
                  <Appear key="feedback">
                    <ApprovalCard kicker="Quick check" title="Did that fix it?">
                      <div className="chat-approval-actions">
                        <button type="button" className="chat-btn chat-btn-secondary" onClick={() => onFeedback(t.turnId, "stuck")}>Still stuck</button>
                        <button type="button" className="chat-btn chat-btn-primary" onClick={() => onFeedback(t.turnId, "solved")}>Solved</button>
                      </div>
                    </ApprovalCard>
                  </Appear>
                )}
                {feedback[t.turnId] === "solved" && <Appear key="solved" className="flex flex-col gap-3"><AssistantHeader /><p>{SOLVED_FOLLOWUP}</p></Appear>}
                {feedback[t.turnId] === "solved" && rating === "shown" && (
                  <Appear key="rating"><RatingCard inApp={inApp}
                    onRate={() => { setRating("done"); events.track("chat_rating_prompt", { action: "rate" }); if (inApp) bridge.openPlayRating().catch(() => {}); }}
                    onDismiss={() => { setRating("done"); events.track("chat_rating_prompt", { action: "dismiss" }); }} /></Appear>
                )}
                {feedback[t.turnId] === "stuck" && <Appear key="stuck" className="flex flex-col gap-3"><AssistantHeader /><p>{STUCK_FOLLOWUP}</p></Appear>}
                </Presence>
              </Appear>
            )}
          </div>
        );
      })}

      <Presence initial={false}>
      {handoff && !handoff.key.startsWith("tool:") && (sent[handoff.key]
        ? <Appear key={`sent-${handoff.key}`}><SentCard ticketRef={sent[handoff.key].ticketRef} topic={sent[handoff.key].topic} email={user.email ?? ""} /></Appear>
        : <Appear key={`form-${handoff.key}`}><HandoffForm reason={handoff.reason} topic={handoff.topic} email={user.email ?? ""} reportId={reportId} messages={userMessages * 2} canIncludeChat={!!sessionId} imageCount={ticketImageCount}
            busy={formBusy && formDone !== handoff.key} done={formDone === handoff.key} error={formError} onSubmit={(v) => submitTicket(handoff, v)} /></Appear>)}
      {Object.entries(sent).filter(([k]) => !k.startsWith("tool:") && handoff?.key !== k).map(([k, v]) => (
        <Appear key={`sent-${k}`}><SentCard ticketRef={v.ticketRef} topic={v.topic} email={user.email ?? ""} /></Appear>
      ))}

      {agent.error && !failed && !limit && !ended && (
        <Appear key="agent-error" kind="fade"><p className="chat-error">{agent.error.message.includes("streams") || (agent.error as { code?: string }).code === "streams" ? "Too many chats open. Close another tab and try again." : "Something went wrong. Try again."}</p></Appear>
      )}
      {failed && !cooling && (
        <Appear key="failed" kind="fade" className="flex items-center gap-3">
          <p className="chat-error">Something went wrong. Try again.</p>
          <Secondary className="!w-auto px-4" onClick={() => send(failed.text, failed.id, failed.images)}>Try again</Secondary>
        </Appear>
      )}
      {(ended || limit?.code === "chat_full") && (
        <Appear key="ended" className="chat-card">
          {/* a model error ends the session too (spike C4): say what happened, not "full" */}
          {/* jailbreak / harmful end the session after the card (guardrails §2): just offer a new chat */}
          {endedByRefusal ? null : <p className="chat-card-title">{ended && sessionOf(view).outcome === "failed" ? "Something went wrong. Start a new chat." : "This chat is full. Start a new chat."}</p>}
          <Primary onClick={onNewChat}>{endedByRefusal ? "Start a new chat" : "New chat"}</Primary>
        </Appear>
      )}
      {limit && limit.code !== "chat_full" && (
        <Appear key={`limit-${limit.code}`}><LimitCard code={limit.code} retryAfter={limit.retryAfter} dayMax={me.limits.day.max} docsHref={docsHref} inApp={inApp}
          onSupport={() => setHandoff({ reason: "limit", topic: "other", key: `limit:${Date.now()}` })}
          onReport={inApp ? () => bridge.createReport().catch(() => {}) : undefined} /></Appear>
      )}
      </Presence>

      {/* the dock: sticky at the bottom with the page background; its height pads the list (CSS) */}
      <div className="chat-dock" ref={dockRef}>
      {attachments.length > 0 && (
        <div className="chat-attachments" aria-live="polite">
          <Presence initial={false}>
          {attachments.map((a) => (
            <Appear key={a.localId} kind="scale" className={`chat-attachment chat-attachment-${a.status}`}>
              {/* while it re-encodes and uploads: a shimmer skeleton, or the preview under a shimmer */}
              <span className={a.status === "uploading" ? "chat-skeleton-wrap chat-skeleton-on" : "chat-skeleton-wrap"}>
                {a.preview ? <ImageTile src={a.preview} label="Your screenshot" onOpen={() => setViewer(a.full || a.preview)} /> : <span className="chat-attachment-blank" />}
              </span>
              <span className={`chat-attachment-state ${a.status === "uploading" ? "chat-shimmer" : ""}`}>{a.status === "uploading" ? "Uploading…" : a.status === "failed" ? a.error : "Ready"}</span>
              <button type="button" className="chat-link-btn" onClick={() => removeAttachment(a)}>Remove</button>
            </Appear>
          ))}
          </Presence>
          <p className="chat-small">{ATTACH_NOTICE}</p>
        </div>
      )}
      <form className={`chat-composer ${dragOver ? "chat-composer-drop" : ""}`}
        onSubmit={(e) => { e.preventDefault(); if (!cooling) send(draft, failed && failed.text === draft.trim() ? failed.id : undefined, failed && failed.text === draft.trim() ? failed.images : undefined); }}
        onDragOver={(e) => { if (imagesOn && e.dataTransfer.types.includes("Files")) { e.preventDefault(); setDragOver(true); } }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { if (!imagesOn) return; e.preventDefault(); setDragOver(false); addFiles(imageFiles(e.dataTransfer.files)); }}>
        {imagesOn && (
          <>
            <input ref={fileRef} type="file" accept={IMAGE_ACCEPT} multiple hidden onChange={(e) => { addFiles(imageFiles(e.target.files)); e.target.value = ""; }} />
            <button type="button" className="chat-add-image" disabled={!canAddMore || running} onClick={() => fileRef.current?.click()}>Add image</button>
          </>
        )}
        <textarea
          onPaste={(e) => { const files = imageFiles(e.clipboardData?.items); if (files.length && imagesOn) { e.preventDefault(); addFiles(files); } }}
          aria-label="Your question"
          value={draft}
          onChange={(e) => setDraft(e.target.value.slice(0, 2000))}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); (e.currentTarget.form as HTMLFormElement).requestSubmit(); } }}
          placeholder={messages.length ? "Ask a follow-up" : "Type your question"}
          rows={Math.min(5, Math.max(draft.split("\n").length, Math.ceil(draft.length / 48), 1))}
          disabled={ended}
        />
        <Presence mode="wait" initial={false}>
        {running && !sending
          ? <Appear key="stop" kind="scale" as="span" className="chat-send-slot"><button type="button" className="chat-send chat-send-stop" onClick={() => agent.cancel().catch(() => {})}>Stop</button></Appear>
          : <Appear key="send" kind="scale" as="span" className="chat-send-slot"><button type="submit" className="chat-send chat-state-btn" aria-busy={sending || undefined} disabled={sending || (!draft.trim() && !attachments.some((a) => a.status === "ready")) || uploading || cooling || ended}>
              {sending && <span className="chat-spinner" aria-hidden="true" />}<span>Send</span></button></Appear>}
        </Presence>
      </form>
      <Presence mode="wait" initial={false}>
      <Appear key={cooling ? "cool" : limit ? "limit" : "note"} kind="fade" as="div">
      <p className={`chat-composer-note ${cooling ? "chat-composer-warn" : ""}`}>
        {cooling ? `One moment. You can send again in ${Math.ceil((cooldownUntil - now) / 1000)} s.`
          : limit ? "Limits are per account and reset at 00:00 UTC."
          : COMPOSER_NOTE}
        {!cooling && !limit && <span className="chat-mobile-only"> {left} left today.</span>}
      </p>
      </Appear>
      </Presence>
      </div>
      <Presence>{viewer && <ImageViewer key="viewer" src={viewer} onClose={() => setViewer(null)} />}</Presence>
    </div>
  );
}
