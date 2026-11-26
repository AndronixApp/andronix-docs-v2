import Link from "next/link";

// "Stuck? Ask the Andronix assistant" on the docs home (owner 2026-11-27; replaces the sidebar pill).
// A server component with no client JS of its own: the link doesn't prefetch, so the /chat bundle
// loads only after a click, and the click is counted as chat_entry_click {source:"home_card"} by
// the delegated listener in components/analytics.tsx (data-chat-entry); data-card="" keeps the
// .prose link colour off the button. Shown only when
// NEXT_PUBLIC_CHAT_ENTRY=1, like the other chat entry points. Styles: .ask-card in app/global.css.
const CHAT_ENTRY = process.env.NEXT_PUBLIC_CHAT_ENTRY === "1";

export default function AskAssistantCard() {
  if (!CHAT_ENTRY) return null;
  return (
    <section className="ask-card not-prose" aria-labelledby="ask-card-title" data-chat-hide-in-app>
      <img src="/mark.svg" alt="" width={44} height={44} className="ask-card-avatar" />
      <div className="ask-card-text">
        <h2 id="ask-card-title" className="ask-card-title">Stuck? Ask the Andronix assistant</h2>
        <p className="ask-card-body">Answers from our docs and known issues in seconds. Send a screenshot of the error.</p>
      </div>
      <div className="ask-card-action">
        <Link href="/chat#src=docs" prefetch={false} data-card="" data-chat-entry="home_card" className="ask-card-button">
          Ask the assistant
        </Link>
        <span className="ask-card-note">Sign in with your Andronix account</span>
      </div>
    </section>
  );
}
