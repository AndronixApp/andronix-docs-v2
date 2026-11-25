import type { Metadata } from "next";
import { ChatPage } from "@/components/chat/chat-page";
import "./chat.css";

// Static title, never derived from content (build plan 1.8). Not indexed: the page is an app.
export const metadata: Metadata = {
  title: "Ask the assistant",
  description: "Ask the Andronix assistant about installing and using Linux on Android. Sign in with your Andronix account.",
  robots: { index: false, follow: true },
  alternates: { canonical: "/chat" },
};

export default function Page() {
  return <ChatPage />;
}
