// Variants and timings for /chat motion (no JSX, so node --test can check them).
import type { Transition, Variants } from "motion/react";

export const SPRING: Transition = { type: "spring", bounce: 0, duration: 0.22 };
export const EXIT: Transition = { type: "tween", ease: "easeIn", duration: 0.15 };

export type AppearKind = "up" | "fade" | "scale";

/** Variants per kind. With reduced motion: identical hidden/shown states, so nothing moves. */
export function appearVariants(kind: AppearKind, reduced: boolean): Variants {
  if (reduced) return { hidden: { opacity: 1 }, shown: { opacity: 1 }, gone: { opacity: 0, transition: { duration: 0 } } };
  const from = kind === "up" ? { opacity: 0, y: 6 } : kind === "scale" ? { opacity: 0, scale: 0.98 } : { opacity: 0 };
  const to = kind === "up" ? { opacity: 1, y: 0 } : kind === "scale" ? { opacity: 1, scale: 1 } : { opacity: 1 };
  const out = kind === "up" ? { opacity: 0, y: -4, transition: EXIT } : kind === "scale" ? { opacity: 0, scale: 0.98, transition: EXIT } : { opacity: 0, transition: EXIT };
  return { hidden: from, shown: { ...to, transition: SPRING }, gone: out };
}

