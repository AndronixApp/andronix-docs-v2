"use client";
// Motion on /chat (owner 2026-11-26): subtle, fast enter/exit for messages, cards, the sign-in
// panel, image tiles, the viewer and composer state.
// - Motion itself is ./motion-runtime, loaded with import() by <ChatPage> in parallel with auth
//   (loadMotion), so it's in no page's first JS. If it fails to load, everything renders unanimated.
// - Springs with no bounce, 150-250 ms; small y offset or scale 0.98 → 1, plus a fade.
// - prefers-reduced-motion: no transform and no duration (things just appear and go).
// - Containers only: streaming text updates inside an already-mounted element, never per token.

import { createContext, useContext, type ReactNode } from "react";
import { appearVariants, SPRING, type AppearKind } from "./motion-variants";
export { SPRING, EXIT } from "./motion-variants";

export type MotionRuntime = typeof import("./motion-runtime");

let pending: Promise<MotionRuntime | null> | null = null;
/** Loads Motion once; resolves null on failure (the chat then renders without animation). */
export function loadMotion(): Promise<MotionRuntime | null> {
  return (pending ??= import("./motion-runtime").catch(() => null));
}

const RuntimeCtx = createContext<MotionRuntime | null>(null);
const ReducedCtx = createContext(true);

/** Wraps the chat once the runtime promise settled. `rt` must not change afterwards (element types would). */
export function ChatMotion({ rt, children }: { rt: MotionRuntime | null; children: ReactNode }) {
  if (!rt) return <ReducedCtx.Provider value={true}>{children}</ReducedCtx.Provider>;
  return <WithMotion rt={rt}>{children}</WithMotion>;
}

function WithMotion({ rt, children }: { rt: MotionRuntime; children: ReactNode }) {
  const reduced = !!rt.useReducedMotion();
  return (
    <rt.LazyMotion features={rt.domAnimation} strict>
      <rt.MotionConfig reducedMotion={reduced ? "always" : "never"} transition={reduced ? { duration: 0 } : SPRING}>
        <RuntimeCtx.Provider value={rt}>
          <ReducedCtx.Provider value={reduced}>{children}</ReducedCtx.Provider>
        </RuntimeCtx.Provider>
      </rt.MotionConfig>
    </rt.LazyMotion>
  );
}

type AppearProps = { children: ReactNode; kind?: AppearKind; className?: string; as?: "div" | "span"; role?: string; "aria-live"?: "polite" };

/** Enters on mount, exits inside a <Presence>. Without the runtime: a plain element. */
export function Appear({ children, kind = "up", className, as = "div", ...rest }: AppearProps) {
  const rt = useContext(RuntimeCtx);
  const reduced = useContext(ReducedCtx);
  if (!rt) {
    const P = as;
    return <P className={className} {...rest}>{children}</P>;
  }
  const C = as === "span" ? rt.m.span : rt.m.div;
  return (
    <C className={className} variants={appearVariants(kind, reduced)} initial="hidden" animate="shown" exit="gone" {...rest}>
      {children}
    </C>
  );
}

/** AnimatePresence with this page's defaults; a fragment without the runtime. */
export function Presence({ children, mode, initial = true }: { children: ReactNode; mode?: "sync" | "wait" | "popLayout"; initial?: boolean }) {
  const rt = useContext(RuntimeCtx);
  if (!rt) return <>{children}</>;
  return <rt.AnimatePresence mode={mode} initial={initial}>{children}</rt.AnimatePresence>;
}

/** The loaded runtime (null when Motion didn't load), for one-off motion elements like the viewer. */
export const useMotionRuntime = () => useContext(RuntimeCtx);
export const useMotionReduced = () => useContext(ReducedCtx);
