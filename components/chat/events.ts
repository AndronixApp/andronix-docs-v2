"use client";
// Page-sent chat events (build plan 1.10). Values are enums, numbers and booleans only, plus
// chat_id; never text, URLs, emails, order ids or report ids. Every event carries entry and surface.

import { useOpenPanel } from "@openpanel/nextjs";
import { useCallback } from "react";

export type Entry = "docs" | "discord" | "app_help" | "app_install_failed";
export type Surface = "web" | "app_webview";

type PageEvents = {
  chat_opened: { signed_in: boolean };
  chat_signin_shown: { had_query: boolean };
  chat_signin_completed: { method: "google" | "email" | "handoff" };
  chat_code_check: { chat_id: string; blocks: number; unverified: number };
  chat_rating_prompt: { action: "shown" | "rate" | "dismiss" };
};

export function useChatEvents(entry: Entry, surface: Surface) {
  const op = useOpenPanel();
  const track = useCallback(<K extends keyof PageEvents>(name: K, props: PageEvents[K]) => {
    try { op.track(name, { ...props, entry, surface }); } catch {}
  }, [op, entry, surface]);
  const identify = useCallback((pid: string) => { try { op.identify({ profileId: pid }); } catch {} }, [op]);
  const reset = useCallback(() => { try { (op as unknown as { clear?: () => void }).clear?.(); } catch {} }, [op]);
  return { track, identify, reset };
}
