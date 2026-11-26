"use client";
// Cards from the mocks: sign-in (3), limits (8), the support form and its sent state (9, 10),
// the rating prompt (10), the attach card (7). Buttons are text only.

import { useState, type FormEvent, type ReactNode } from "react";
import { ORDER_ID_HINT } from "./copy";
import { cooldownText, REFUSAL_BUTTONS, REFUSAL_COPY } from "./refusals";

export function Card({ children, tone }: { children: ReactNode; tone?: "ok" | "warn" }) {
  return <div className={`chat-card ${tone ? `chat-card-${tone}` : ""}`}>{children}</div>;
}
export function Primary(props: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button type="button" {...props} className={`chat-btn chat-btn-primary ${props.className ?? ""}`} />;
}
export function Secondary(props: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button type="button" {...props} className={`chat-btn chat-btn-secondary ${props.className ?? ""}`} />;
}
export function Pill({ children, tone }: { children: ReactNode; tone: "warn" | "ok" | "muted" }) {
  return <span className={`chat-pill chat-pill-${tone}`}>{children}</span>;
}

// ---------- sign-in (mock 3) ----------

export function SignInCard({ question, onGoogle, onEmail, busy, error, footer }: {
  question: string | null; onGoogle: () => void; onEmail: (email: string, password: string) => void; busy: boolean; error: string; footer: string;
}) {
  const [emailOpen, setEmailOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const submit = (e: FormEvent) => { e.preventDefault(); if (email && password) onEmail(email.trim(), password); };
  return (
    <div className="chat-signin">
      <h1 className="chat-signin-title">Sign in to ask</h1>
      <p className="chat-muted">Use your Andronix account, the same one as in the app. It keeps your chats private and lets the assistant see your own reports.</p>
      <div className="flex flex-col gap-2.5">
        <Primary onClick={onGoogle} disabled={busy}>Continue with Google</Primary>
        {!emailOpen ? (
          <Secondary onClick={() => setEmailOpen(true)} disabled={busy}>Sign in with email</Secondary>
        ) : (
          <form onSubmit={submit} className="flex flex-col gap-2">
            <label className="chat-field"><span>Email</span><input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></label>
            <label className="chat-field"><span>Password</span><input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required /></label>
            <button type="submit" className="chat-btn chat-btn-secondary" disabled={busy}>Sign in</button>
          </form>
        )}
        <p className="chat-small text-center">No account? Use Google, or create one in the Andronix app.</p>
      </div>
      {error && <p className="chat-error" role="alert">{error}</p>}
      {question && (
        <div className="chat-kept">
          <span className="chat-kept-label">Your question, kept for after sign-in</span>
          <span>{question}</span>
        </div>
      )}
      <p className="chat-small">{footer}</p>
    </div>
  );
}

export function VerifyEmailCard({ email, onSend, sent, onRecheck }: { email: string; onSend: () => void; sent: boolean; onRecheck: () => void }) {
  return (
    <Card>
      <Pill tone="muted">Unverified email</Pill>
      <p className="chat-card-title">Verify your email for more questions</p>
      <p className="chat-muted">Accounts with an unverified email get 3 questions a day. Verify {email} to get the full limit.</p>
      <div className="flex flex-col gap-2">
        {!sent ? <Secondary onClick={onSend}>Verify email</Secondary> : <Secondary onClick={onRecheck}>I verified it</Secondary>}
        {sent && <p className="chat-small">We sent a link to {email}. Open it, then come back here.</p>}
      </div>
    </Card>
  );
}

// ---------- limits (mock 8) ----------

const fmtWait = (s: number) => {
  if (s < 90) return `${Math.max(1, Math.round(s))} s`;
  const h = Math.floor(s / 3600);
  const m = Math.round((s % 3600) / 60);
  return h ? `${h} h ${m} min` : `${m} min`;
};

export function LimitCard({ code, retryAfter, dayMax, onSupport, docsHref, inApp, onReport }: {
  code: string; retryAfter?: number; dayMax?: number; onSupport: () => void; docsHref: string; inApp: boolean; onReport?: () => void;
}) {
  if (code === "cooldown") {
    return (
      <Card>
        <Pill tone="warn">Paused</Pill>
        <p className="chat-muted">{cooldownText(retryAfter ?? 600)}</p>
        <div className="flex flex-col gap-2">
          <a className="chat-btn chat-btn-primary" href={docsHref}>Open the docs</a>
          <Secondary onClick={onSupport}>Send to support team</Secondary>
        </div>
      </Card>
    );
  }
  if (code === "budget_paused" || code === "disabled") {
    return (
      <Card>
        <Pill tone="muted">Busy</Pill>
        <p className="chat-card-title">The assistant is resting right now</p>
        <p className="chat-muted">
          {code === "budget_paused" ? "A lot of people asked today. It's back at 00:00 UTC." : "It isn't available right now."} You can still reach our team{inApp ? ", and they see your phone's details with the report" : ""}.
        </p>
        <div className="flex flex-col gap-2">
          {inApp && onReport ? <Primary onClick={onReport}>Report a problem</Primary> : <Primary onClick={onSupport}>Send to support team</Primary>}
          <a className="chat-btn chat-btn-secondary" href={docsHref}>Open the docs</a>
        </div>
      </Card>
    );
  }
  const title =
    code === "rate_day" ? `That's today's ${dayMax ?? 10} questions`
    : code === "new_account" ? "That's today's questions for new accounts"
    : code === "rate_month" ? "That's this month's questions"
    : code === "cost_day" ? "That's today's limit"
    : code === "new_ip" ? "Too many new accounts on this network today"
    : code === "streams" ? "Too many chats open"
    : "Limit reached";
  const extra = code === "new_account" ? " Accounts under a day old, or with an unverified email, get 3 questions a day." : "";
  return (
    <Card>
      <Pill tone="warn">Limit reached</Pill>
      <p className="chat-card-title">{title}</p>
      <p className="chat-muted">
        {retryAfter ? `You can ask again in ${fmtWait(retryAfter)}. ` : ""}Your question is saved in the box.{extra} Need help sooner? Our team can pick this chat up.
      </p>
      <div className="flex flex-col gap-2">
        <Primary onClick={onSupport}>Send to support team</Primary>
        <a className="chat-btn chat-btn-secondary" href={docsHref}>Open the docs</a>
      </div>
    </Card>
  );
}

// ---------- support form (mocks 9, 10) ----------

const TOPIC_LABEL: Record<string, string> = {
  purchase_locked: "Purchase not unlocking", refund: "Refund", billing_other: "Billing", account_access: "Signing in",
  account_deletion: "Deleting the account", legal: "Legal", install: "Install problem", other: "Something else",
};
export const topicLabel = (t?: string) => (t && TOPIC_LABEL[t]) || "Support request";

/** A button that shows a spinner while busy and a check when done (owner 2026-11-26). Reduced motion: static. */
export function StateButton({ busy, done, label, busyLabel, doneLabel, className = "chat-btn chat-btn-primary", ...rest }:
  { busy: boolean; done?: boolean; label: string; busyLabel: string; doneLabel: string } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button {...rest} className={`${className} chat-state-btn`} disabled={rest.disabled || busy || done} aria-busy={busy || undefined}>
      {busy && <span className="chat-spinner" aria-hidden="true" />}
      {done && <svg className="chat-check" viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8.5l3.2 3L13 4.5" /></svg>}
      <span>{done ? doneLabel : busy ? busyLabel : label}</span>
    </button>
  );
}

/** Card shell after Beautiful UI's "Approval Card": a small kicker, a title, body, actions row. */
export function ApprovalCard({ kicker, title, children, className = "" }: { kicker?: string; title: string; children: ReactNode; className?: string }) {
  return (
    <div className={`chat-card chat-approval ${className}`}>
      {kicker && <span className="chat-approval-kicker">{kicker}</span>}
      <p className="chat-card-title">{title}</p>
      {children}
    </div>
  );
}

export function HandoffForm({ reason, topic, email, reportId, messages, canIncludeChat, imageCount = 0, onSubmit, busy, done = false, error }: {
  reason: string; topic?: string; email: string; reportId?: string | null; messages: number; canIncludeChat: boolean;
  /** Screenshots sent in this chat that may go along; the box is off by default (lead decision 4). */
  imageCount?: number;
  onSubmit: (v: { orderId?: string; note?: string; includeChat: boolean; includeImages: boolean }) => void; busy: boolean; done?: boolean; error: string;
}) {
  const [orderId, setOrderId] = useState("");
  const [note, setNote] = useState("");
  const [includeChat, setIncludeChat] = useState(canIncludeChat);
  const [includeImages, setIncludeImages] = useState(false);
  const money = reason === "money";
  const orderOk = !orderId || /^GPA\.\d{4}-\d{4}-\d{4}-\d{5}(\.\.\d+)?$/.test(orderId.trim());
  return (
    <ApprovalCard kicker="Support team" title="Send to support team">
      <form className="flex flex-col gap-2.5" onSubmit={(e) => { e.preventDefault(); if (orderOk) onSubmit({ orderId: orderId.trim() || undefined, note: note.trim() || undefined, includeChat, includeImages: includeImages && imageCount > 0 }); }}>
        <dl className="chat-facts">
          <dt>Reply to</dt><dd>{email || "your account email"}</dd>
          {reportId && (<><dt>Report</dt><dd>{reportId}</dd></>)}
          {canIncludeChat && (<><dt>Chat</dt><dd>{messages} messages, {includeChat ? "included" : "not included"}</dd></>)}
        </dl>
        {money && (
          <label className="chat-field">
            <span>Order ID · optional</span>
            <input value={orderId} onChange={(e) => setOrderId(e.target.value)} placeholder="GPA.0000-0000-0000-00000" inputMode="text" autoComplete="off" />
          </label>
        )}
        {!orderOk && <p className="chat-error">Order IDs look like GPA.1234-5678-9012-34567.</p>}
        <label className="chat-field">
          <span>Anything to add · optional</span>
          <textarea value={note} onChange={(e) => setNote(e.target.value.slice(0, 2000))} rows={2} placeholder="What you tried, what you saw" />
        </label>
        {canIncludeChat && (
          <label className="chat-toggle">
            <span>Include this chat</span>
            <input type="checkbox" checked={includeChat} onChange={(e) => setIncludeChat(e.target.checked)} />
          </label>
        )}
        {canIncludeChat && imageCount > 0 && (
          <label className="chat-toggle">
            <span>Attach my screenshots ({imageCount})</span>
            <input type="checkbox" checked={includeImages} onChange={(e) => setIncludeImages(e.target.checked)} />
          </label>
        )}
        <div className="chat-approval-actions">
          <StateButton type="submit" busy={busy} done={done} disabled={!orderOk} label="Send to support team" busyLabel="Sending…" doneLabel="Sent" />
        </div>
        {money && <p className="chat-small">{ORDER_ID_HINT}</p>}
        {error && <p className="chat-error" role="alert">{error}</p>}
      </form>
    </ApprovalCard>
  );
}

export function SentCard({ ticketRef, topic, email }: { ticketRef: string; topic?: string; email: string }) {
  return (
    <Card>
      <Pill tone="ok">Sent to the team</Pill>
      <p className="chat-card-title">A person will reply by email</p>
      <p className="chat-muted">We sent your message to our support team. The reply goes to {email || "your account email"}.</p>
      <dl className="chat-facts"><dt>Ticket</dt><dd>{ticketRef}</dd><dt>About</dt><dd>{topicLabel(topic)}</dd></dl>
    </Card>
  );
}

// ---------- rating (mock 10) ----------

export function RatingCard({ onRate, onDismiss, inApp }: { onRate: () => void; onDismiss: () => void; inApp: boolean }) {
  return (
    <Card tone="ok">
      <p className="chat-card-title">Did Andronix help?</p>
      <p className="chat-muted">A rating on Google Play helps other people find it.</p>
      <div className="grid grid-cols-2 gap-2">
        {inApp ? <Primary onClick={onRate} className="chat-btn-ok">Rate on Google Play</Primary>
          : <a className="chat-btn chat-btn-primary chat-btn-ok" href="https://play.google.com/store/apps/details?id=studio.com.techriz.andronix" target="_blank" rel="noopener noreferrer" onClick={onRate}>Rate on Google Play</a>}
        <button type="button" className="chat-btn chat-btn-ghost" onClick={onDismiss}>Not now</button>
      </div>
    </Card>
  );
}

// ---------- attach my report (mock 7) ----------

export function AttachCard({ onAttach, onDismiss, busy, error }: { onAttach: () => void; onDismiss: () => void; busy: boolean; error: string }) {
  return (
    <Card>
      <p className="chat-card-title">Attach my report</p>
      <p className="chat-muted">The app shows you exactly what it sends before anything leaves your phone: the install, the step it stopped at, your phone and Android version, the app version, and the installer log with personal details removed.</p>
      <div className="grid grid-cols-2 gap-2">
        <Primary onClick={onAttach} disabled={busy}>Attach</Primary>
        <Secondary onClick={onDismiss} disabled={busy}>Not now</Secondary>
      </div>
      {error && <p className="chat-error" role="alert">{error}</p>}
    </Card>
  );
}

// ---------- decline (guardrails §1): the fixed card replaces the turn's text ----------

export function DeclineCard({ reason, docsHref, onSupport }: { reason: "offtopic" | "harmful"; docsHref: string; onSupport: () => void }) {
  const buttons = REFUSAL_BUTTONS[reason];
  return (
    <Card>
      <p className="chat-muted">{REFUSAL_COPY[reason]}</p>
      <div className="flex flex-col gap-2">
        {buttons.includes("open_docs") && <a className="chat-btn chat-btn-primary" href={docsHref}>Open the docs</a>}
        {buttons.includes("send_to_support") && <Secondary onClick={onSupport}>Send to support team</Secondary>}
      </div>
    </Card>
  );
}
