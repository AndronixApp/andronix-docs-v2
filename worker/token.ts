// Firebase ID token check (build plan 1.2, 1.4): jose + Google's securetoken JWKS.
// Dev only: with FIREBASE_AUTH_EMULATOR_HOST set, the emulator's unsigned tokens are accepted
// (issuer and audience still checked). That var is never set on a deployed Worker.

import { createRemoteJWKSet, decodeJwt, jwtVerify, type JWTPayload } from "jose";
import type { Env } from "./env.ts";

const JWKS = createRemoteJWKSet(
  new URL("https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com"),
);

export const CHAT_ENTRY_CLAIMS = ["app_help", "app_install_failed"] as const;

export interface Principal {
  uid: string;
  email: string | null;
  emailVerified: boolean;
  staff: boolean;
  signInProvider: string;
  /** Set only for handoff (custom-token) sessions; from products-api's server enum. */
  chatEntry: (typeof CHAT_ENTRY_CLAIMS)[number] | null;
  issuedAt: number;
}

type FirebaseClaims = JWTPayload & {
  email?: string;
  email_verified?: boolean;
  support_staff?: boolean;
  chat_entry?: string;
  firebase?: { sign_in_provider?: string };
};

export async function verifyIdToken(authorization: string | null, env: Env): Promise<Principal | null> {
  const m = /^Bearer\s+([A-Za-z0-9._-]+)$/.exec(authorization ?? "");
  if (!m) return null;
  const token = m[1];
  const project = env.FIREBASE_PROJECT_ID || "andronix-techriz";
  const issuer = `https://securetoken.google.com/${project}`;
  let claims: FirebaseClaims;
  try {
    if (env.FIREBASE_AUTH_EMULATOR_HOST) {
      claims = decodeJwt(token) as FirebaseClaims;
      const now = Date.now() / 1000;
      if (claims.iss !== issuer || claims.aud !== project || typeof claims.exp !== "number" || claims.exp < now) return null;
    } else {
      const res = await jwtVerify(token, JWKS, { issuer, audience: project, algorithms: ["RS256"] });
      claims = res.payload as FirebaseClaims;
    }
  } catch {
    return null;
  }
  if (typeof claims.sub !== "string" || claims.sub.length === 0 || claims.sub.length > 128) return null;
  const provider = claims.firebase?.sign_in_provider ?? "";
  const entry = (CHAT_ENTRY_CLAIMS as readonly string[]).includes(claims.chat_entry ?? "")
    ? (claims.chat_entry as Principal["chatEntry"]) : null;
  // A custom-token session without a chat_entry claim was not made by the chat handoff: refused.
  if (provider === "custom" && !entry) return null;
  return {
    uid: claims.sub,
    email: typeof claims.email === "string" ? claims.email : null,
    emailVerified: claims.email_verified === true,
    staff: claims.support_staff === true,
    signInProvider: provider,
    chatEntry: entry,
    issuedAt: typeof claims.iat === "number" ? claims.iat * 1000 : 0,
  };
}
