"use client";
// Firebase Auth for /chat only (loaded by this route alone). authDomain is docs.andronix.app in
// production (the /__/auth proxy keeps the popup/redirect flow same-site); preview builds use
// andronix-techriz.firebaseapp.com. Inside the app (embed) auth lives in memory only.

import { getApps, initializeApp, type FirebaseApp } from "firebase/app";
import {
  browserLocalPersistence, browserPopupRedirectResolver, connectAuthEmulator, GoogleAuthProvider, indexedDBLocalPersistence,
  inMemoryPersistence, initializeAuth, getRedirectResult, signInWithPopup, signInWithRedirect, type Auth,
} from "firebase/auth";

const EMULATOR = process.env.NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR;

type WebConfig = { apiKey: string; authDomain: string; projectId: string; appId?: string };

/**
 * The web config: from the build (NEXT_PUBLIC_FIREBASE_*) when set, otherwise Firebase's own
 * public /__/firebase/init.json, which the Worker proxies on this origin. authDomain is the build's
 * (docs.andronix.app in production) or this origin's default from init.json.
 */
async function webConfig(): Promise<WebConfig> {
  const env = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || undefined,
  };
  if (env.apiKey && env.projectId) return { ...env, authDomain: env.authDomain || location.host } as WebConfig;
  const init = (await (await fetch("/__/firebase/init.json", { cache: "force-cache" })).json()) as Partial<WebConfig>;
  if (!init.apiKey || !init.projectId) throw new Error("no firebase config");
  return { apiKey: init.apiKey, projectId: init.projectId, appId: init.appId, authDomain: env.authDomain || init.authDomain || location.host };
}

let auth: Promise<Auth> | null = null;

export function chatAuth(embed: boolean): Promise<Auth> {
  if (!auth) auth = makeAuth(embed);
  return auth;
}

async function makeAuth(embed: boolean): Promise<Auth> {
  const app: FirebaseApp = getApps()[0] ?? initializeApp(await webConfig());
  const a = initializeAuth(app, {
    persistence: embed ? [inMemoryPersistence] : [indexedDBLocalPersistence, browserLocalPersistence],
    popupRedirectResolver: browserPopupRedirectResolver,
  });
  if (EMULATOR) connectAuthEmulator(a, EMULATOR, { disableWarnings: true });
  return a;
}

/** In-app browsers (Discord's, Instagram's, Android WebViews) can't open pop-ups: straight to a redirect. */
const EMBEDDED_UA = /Discord|FBAN|FBAV|Instagram|Line\/|; wv\)|WebView/i;
const MOBILE_UA = /Android|iPhone|iPad|iPod/i;
const REDIRECT_ON = ["auth/popup-blocked", "auth/internal-error", "auth/operation-not-supported-in-this-environment", "auth/web-storage-unsupported"];

/** Google sign-in: popup on desktop, redirect on mobile and in-app browsers (from discord/signinPage.ts). */
export async function signInWithGoogle(a: Auth): Promise<"done" | "redirecting"> {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  const ua = navigator.userAgent;
  if (EMBEDDED_UA.test(ua) || MOBILE_UA.test(ua)) { await signInWithRedirect(a, provider); return "redirecting"; }
  try {
    await signInWithPopup(a, provider);
    return "done";
  } catch (e) {
    const code = (e as { code?: string }).code ?? "";
    if (REDIRECT_ON.includes(code)) { await signInWithRedirect(a, provider); return "redirecting"; }
    throw e;
  }
}

export async function finishRedirect(a: Auth): Promise<boolean> {
  try { return !!(await getRedirectResult(a)); } catch { return false; }
}

export function friendlyAuthError(e: unknown): string {
  const code = (e as { code?: string }).code ?? "";
  if (code === "auth/invalid-credential" || code === "auth/wrong-password" || code === "auth/user-not-found" || code === "auth/invalid-email") return "That email and password don't match an Andronix account.";
  if (code === "auth/too-many-requests") return "Too many tries. Wait a few minutes and try again.";
  if (code === "auth/popup-closed-by-user" || code === "auth/cancelled-popup-request") return "";
  if (code === "auth/network-request-failed") return "No connection. Check your internet and try again.";
  return "Sign-in didn't work. Try again.";
}
