"use client";
// Motion on /chat (owner 2026-11-26): subtle, fast enter/exit for messages, cards, the sign-in
// panel, image tiles, the viewer and composer state. Only `m` components under LazyMotion
// (features loaded lazily from ./motion-features), so the cost stays on /chat.
// - Springs with no bounce, 150-250 ms; small y offset or scale 0.98 → 1, plus a fade.
// - prefers-reduced-motion: no transform and no duration (things just appear and go).
// - Containers only: streaming text updates inside an already-mounted element, never per token.

import { createContext, useContext, type ReactNode } from "react";
import { AnimatePresence, LazyMotion, MotionConfig, m, useReducedMotion } from "motion/react";
import { appearVariants, SPRING, type AppearKind } from "./motion-variants";
export { SPRING, EXIT } from "./motion-variants";

const ReducedCtx = createContext(false);
const loadFeatures = () => import("./motion-features").then((r) => r.default);

export function ChatMotion({ children }: { children: ReactNode }) {
  const reduced = !!useReducedMotion();
  return (
    <LazyMotion features={loadFeatures} strict>
      <MotionConfig reducedMotion={reduced ? "always" : "never"} transition={reduced ? { duration: 0 } : SPRING}>
        <ReducedCtx.Provider value={reduced}>{children}</ReducedCtx.Provider>
      </MotionConfig>
    </LazyMotion>
  );
}

type AppearProps = { children: ReactNode; kind?: AppearKind; className?: string; as?: "div" | "span"; role?: string; "aria-live"?: "polite" };

/** Enters on mount, exits inside an <AnimatePresence>. */
export function Appear({ children, kind = "up", className, as = "div", ...rest }: AppearProps) {
  const reduced = useContext(ReducedCtx);
  const C = as === "span" ? m.span : m.div;
  return (
    <C className={className} variants={appearVariants(kind, reduced)} initial="hidden" animate="shown" exit="gone" {...rest}>
      {children}
    </C>
  );
}

/** AnimatePresence with the defaults this page uses (no animation on the first render of a list). */
export function Presence({ children, mode, initial = true }: { children: ReactNode; mode?: "sync" | "wait" | "popLayout"; initial?: boolean }) {
  return <AnimatePresence mode={mode} initial={initial}>{children}</AnimatePresence>;
}

export { m, AnimatePresence };
export const useMotionReduced = () => useContext(ReducedCtx);
