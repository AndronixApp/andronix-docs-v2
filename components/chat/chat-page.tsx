"use client";
// /chat (build plan 2B.4): sign-in card, handoff from the app, the conversation, the rail.
// Fragment entries (#q, #src, #h) are read once, then cleared before anything else runs.

import { useCallback, useEffect, useRef, useState } from "react";
import { onIdTokenChanged, sendEmailVerification, signInWithCustomToken, signInWithEmailAndPassword, signOut, type Auth, type User } from "firebase/auth";
import * as bridge from "@/lib/app-bridge";
import { chatAuth, finishRedirect, friendlyAuthError, signInWithGoogle } from "./firebase";
import { getMe, redeem, type Me } from "./api";
import { ChatView } from "./chat-view";
import { SignInCard, VerifyEmailCard, Card, Primary } from "./cards";
import { DISCLAIMER } from "./copy";
import { useChatEvents, type Entry, type Surface } from "./events";

type Boot = { q: string; entry: Entry; handoff: string | null; embed: boolean };

/** Reads #q, #src and #h once, then clears the fragment (history.replaceState) before analytics run. */
let bootOnce: Boot | null = null;
function readFragment(): Boot {
  if (bootOnce) return bootOnce;
  const url = new URL(location.href);
  const frag = new URLSearchParams(url.hash.slice(1));
  const embed = url.searchParams.get("embed") === "app";
  if (url.searchParams.get("shim") === "app") bridge.installDevShim();
  const q = (frag.get("q") ?? "").replace(/\s+/g, " ").trim().slice(0, 500);
  const src = frag.get("src");
  const handoff = frag.get("h");
  if (url.hash) history.replaceState(history.state, "", url.pathname + url.search);
  bootOnce = { q, entry: src === "discord" ? "discord" : "docs", handoff: handoff && /^[A-Za-z0-9_-]{16,128}$/.test(handoff) ? handoff : null, embed };
  return bootOnce;
}

export function ChatPage() {
  const [boot, setBoot] = useState<Boot | null>(null);
  const [auth, setAuth] = useState<Auth | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const b = readFragment();
    if (b.embed) document.documentElement.dataset.chatEmbed = "app";
    setBoot(b);
    chatAuth(b.embed || bridge.isApp()).then(setAuth, () => setFailed(true));
  }, []);
  if (failed) return <div className="chat-shell"><div className="chat-main"><p className="chat-error">The assistant can't load right now. Try again later.</p></div></div>;
  if (!boot || !auth) return <div className="chat-shell" aria-busy="true" />;
  return <ChatShell boot={boot} auth={auth} />;
}

function ChatShell({ boot, auth }: { boot: Boot; auth: Auth }) {
  const inApp = bridge.isApp();
  const surface: Surface = inApp ? "app_webview" : "web";
  const [entry, setEntry] = useState<Entry>(boot.entry);
  const events = useChatEvents(entry, surface);
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [me, setMe] = useState<Me | null>(null);
  const [meError, setMeError] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [reportId, setReportId] = useState<string | null>(null);
  const [chatKey, setChatKey] = useState(0);
  const [verifySent, setVerifySent] = useState(false);
  const opened = useRef(false);
  const signinShown = useRef(false);
  const method = useRef<"google" | "email" | "handoff" | null>(null);

  // App handoff: honoured only when the bridge reports the app (1.8); otherwise #h is ignored.
  const handoffDone = useRef(false);
  useEffect(() => {
    if (!boot.handoff || !inApp || handoffDone.current) return;
    handoffDone.current = true;
    (async () => {
      setBusy(true);
      try {
        const verifier = await bridge.handoffVerifier();
        const r = await redeem(boot.handoff!, verifier);
        if (auth.currentUser) await signOut(auth);
        method.current = "handoff";
        await signInWithCustomToken(auth, r.customToken);
        setEntry(r.entry);
        if (r.reportId) setReportId(r.reportId);
      } catch {
        setError("This chat link can't be used. Close it and open the chat from the app again.");
      } finally { setBusy(false); }
    })();
  }, [boot.handoff, inApp, auth]);

  useEffect(() => {
    finishRedirect(auth).then((ok) => { if (ok) method.current = "google"; });
    return onIdTokenChanged(auth, (u) => setUser(u));
  }, [auth]);

  const loadMe = useCallback(async (force = false) => {
    const u = auth.currentUser;
    if (!u) return;
    try {
      const m = await getMe(await u.getIdToken(force));
      setMe(m); setMeError("");
      events.identify(m.pid);
    } catch (e) {
      const code = (e as { code?: string }).code;
      setMeError(code === "disabled" ? "disabled" : code === "auth" ? "auth" : "error");
    }
  }, [auth, events]);

  useEffect(() => {
    if (user === undefined) return;
    if (!opened.current) { opened.current = true; events.track("chat_opened", { signed_in: !!user }); }
    if (user) {
      loadMe();
      if (method.current) { events.track("chat_signin_completed", { method: method.current }); method.current = null; }
    } else {
      setMe(null);
      if (!signinShown.current && !boot.handoff) { signinShown.current = true; events.track("chat_signin_shown", { had_query: !!boot.q }); }
    }
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  // Back from the verification email: refresh the token so `email_verified` is current (F9).
  useEffect(() => {
    if (!verifySent) return;
    const onFocus = async () => { const u = auth.currentUser; if (!u) return; await u.reload(); if (u.emailVerified) await loadMe(true); };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [verifySent, auth, loadMe]);

  const google = async () => {
    setBusy(true); setError("");
    try { method.current = "google"; await signInWithGoogle(auth); }
    catch (e) { method.current = null; setError(friendlyAuthError(e)); }
    finally { setBusy(false); }
  };
  const email = async (address: string, password: string) => {
    setBusy(true); setError("");
    try { method.current = "email"; await signInWithEmailAndPassword(auth, address, password); }
    catch (e) { method.current = null; setError(friendlyAuthError(e)); }
    finally { setBusy(false); }
  };

  const left = me ? Math.max(0, me.limits.day.max - me.limits.day.used) : null;
  const embed = boot.embed || inApp;

  let main: React.ReactNode;
  if (user === undefined || (boot.handoff && inApp && busy && !user)) {
    main = <p className="chat-muted">Loading…</p>;
  } else if (!user) {
    main = (
      <div className="chat-center">
        <SignInCard question={boot.q || null} onGoogle={google} onEmail={email} busy={busy} error={error} footer={DISCLAIMER} />
      </div>
    );
  } else if (meError === "disabled" || (me && !me.rollout)) {
    main = <Card><p className="chat-card-title">The assistant isn't open yet</p><p className="chat-muted">It's being tested with a small group first. The docs and our support team are here meanwhile.</p><a className="chat-btn chat-btn-secondary" href="/">Open the docs</a></Card>;
  } else if (!me) {
    main = meError ? <Card><p className="chat-card-title">Something went wrong</p><Primary onClick={() => loadMe(true)}>Try again</Primary></Card> : <p className="chat-muted">Loading…</p>;
  } else {
    main = (
      <>
        {!me.verified && user.email && user.providerData.some((p) => p.providerId === "password") && (
          <VerifyEmailCard email={user.email} sent={verifySent}
            onSend={() => sendEmailVerification(user).then(() => setVerifySent(true)).catch(() => setVerifySent(true))}
            onRecheck={async () => { await user.reload(); await loadMe(true); }} />
        )}
        <ChatView key={chatKey} user={user} me={me} entry={entry} surface={surface} initialQuestion={boot.q}
          pendingReportId={reportId} onMeStale={() => loadMe(true)} onLimitsChanged={() => loadMe()}
          onNewChat={() => { setChatKey((k) => k + 1); setReportId(null); }} />
      </>
    );
  }

  return (
    <div className={`chat-shell ${embed ? "chat-embed" : ""}`}>
      <div className="chat-main">
        <header className="chat-header">
          <div>
            <h1 className="chat-title">Ask the assistant <span className="chat-ai-badge">AI</span></h1>
            {embed && <p className="chat-small">AI · answers from the Andronix docs</p>}
          </div>
          <div className="flex items-center gap-2">
            {left !== null && <span className="chat-left-chip">{left} left today</span>}
            {user && me && <button type="button" className={`chat-link-btn ${embed ? "" : "chat-header-new"}`} onClick={() => { setChatKey((k) => k + 1); setReportId(null); }}>New chat</button>}
          </div>
        </header>
        {main}
      </div>
      {!embed && user && me && (
        <aside className="chat-rail" aria-label="Your account">
          <div className="chat-rail-card">
            <p className="font-semibold break-all">{user.email ?? "Signed in"}</p>
            <p className="chat-small">Andronix account · <button type="button" className="chat-link-btn" onClick={() => signOut(auth)}>Sign out</button></p>
          </div>
          <div className="chat-rail-card">
            <p className="font-semibold">{left} of {me.limits.day.max} questions left today</p>
            <div className="chat-meter" aria-hidden="true"><span style={{ width: `${(100 * (left ?? 0)) / Math.max(1, me.limits.day.max)}%` }} /></div>
            <p className="chat-small">Resets at 00:00 UTC. Limits are per account.</p>
          </div>
          <div className="chat-rail-card">
            <p className="font-semibold">Report</p>
            <p className="chat-small">{reportId ? `${reportId} attached.` : "None attached. Send one from the app (Help > Report a problem) and it shows up here."}</p>
          </div>
          <button type="button" className="chat-btn chat-btn-secondary" onClick={() => window.dispatchEvent(new Event("andronix-chat-support"))}>Send to support team</button>
          <button type="button" className="chat-link-btn self-center" onClick={() => { setChatKey((k) => k + 1); setReportId(null); }}>New chat</button>
        </aside>
      )}
    </div>
  );
}
