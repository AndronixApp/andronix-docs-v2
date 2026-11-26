// Everything /chat uses from Motion, in one module that <ChatPage> loads with import() while Firebase
// auth starts. So no page's first JS includes Motion, /chat's included, and other docs pages never load it.
export { AnimatePresence, LazyMotion, MotionConfig, useReducedMotion, domAnimation } from "motion/react";
export * as m from "motion/react-m";
