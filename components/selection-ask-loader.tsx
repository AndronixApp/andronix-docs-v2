"use client";
// Loads the selection action as its own chunk, only when the layout renders it (NEXT_PUBLIC_CHAT_ENTRY=1).
import dynamic from "next/dynamic";
export const SelectionAskLoader = dynamic(() => import("./selection-ask"), { ssr: false });
