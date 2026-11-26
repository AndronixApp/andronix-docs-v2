// The ChatLimiter Durable Object: one global instance ("global") around LimiterCore.
// SQLite-backed (new_sqlite_classes), synchronous KV, so every RPC call is atomic.
// The alarm runs the daily expiry sweep (build plan 1.5).

import { DurableObject } from "cloudflare:workers";
import { parseLimits, type Env } from "../env.ts";
import { LimiterCore, type Store } from "./core.ts";

const DAY = 24 * 60 * 60_000;

class KvStore implements Store {
  constructor(private kv: SyncKvStorage) {}
  get<T>(k: string) { return this.kv.get<T>(k); }
  put<T>(k: string, v: T) { this.kv.put(k, v); }
  delete(k: string) { return this.kv.delete(k); }
  list<T>(prefix: string) { return this.kv.list<T>({ prefix }); }
}

export type CoreMethod = { [K in keyof LimiterCore]: LimiterCore[K] extends (...a: any[]) => any ? K : never }[keyof LimiterCore];

/** What the Worker sees through the stub (RPC results are promises). */
export interface LimiterRpc {
  call<M extends CoreMethod>(method: M, ...args: Parameters<LimiterCore[M]>): Promise<ReturnType<LimiterCore[M]>>;
  devAdvance(ms: number): Promise<number>;
  devSweep(): Promise<ReturnType<LimiterCore["sweep"]>>;
}

export class ChatLimiter extends DurableObject<Env> {
  private core: LimiterCore;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    const offset = Number(env.DEV_CLOCK || 0);
    this.core = new LimiterCore(new KvStore(ctx.storage.kv), parseLimits(env.LIMITS_JSON), () => Date.now() + (this.clockOffset || offset));
    ctx.blockConcurrencyWhile(async () => {
      this.clockOffset = (ctx.storage.kv.get<number>("devclock") ?? 0);
      if ((await ctx.storage.getAlarm()) === null) await ctx.storage.setAlarm(Date.now() + DAY);
    });
  }
  private clockOffset = 0;

  /** Single RPC entry point: the Worker calls `limiter.call("admitCreate", who, id)`. */
  call<M extends CoreMethod>(method: M, ...args: Parameters<LimiterCore[M]>): ReturnType<LimiterCore[M]> {
    const fn = this.core[method] as (...a: unknown[]) => ReturnType<LimiterCore[M]>;
    const out = fn.apply(this.core, args);
    // Image bytes: deletes queued by the core (remove, chat end, harmful, erase, expiry) go to R2
    // right away; an unsent upload or a sent image needs the alarm sooner than the daily sweep.
    if (this.core.pendingImageDeletes().length) this.ctx.waitUntil(this.flushImageDeletes());
    if (method === "registerImage" || method === "attachImages") this.ctx.waitUntil(this.scheduleImageAlarm());
    return out;
  }

  /** Core time (dev clock offset applied) → wall time for setAlarm. */
  private realTime(coreMs: number) { return coreMs - (this.clockOffset || Number(this.env.DEV_CLOCK || 0)); }

  private async flushImageDeletes() {
    const keys = this.core.pendingImageDeletes().slice(0, 1000);
    if (!keys.length || !this.env.CHAT_IMAGES) return;
    try {
      await this.env.CHAT_IMAGES.delete(keys);
      this.core.imageDeletesDone(keys);
    } catch {
      // kept in the queue; the alarm retries (and the bucket's 2-day lifecycle is the backstop)
      await this.scheduleImageAlarm(5 * 60_000);
    }
  }

  private async scheduleImageAlarm(minDelayMs = 0) {
    const deadline = this.core.nextImageDeadline();
    if (deadline === null) return;
    const at = Math.max(Date.now() + 1000, this.realTime(deadline) + minDelayMs);
    const current = await this.ctx.storage.getAlarm();
    if (current === null || at < current) await this.ctx.storage.setAlarm(at);
  }

  /** Dev and tests only (guarded in the Worker): move the DO clock forward. */
  devAdvance(ms: number) {
    this.clockOffset += ms;
    this.ctx.storage.kv.put("devclock", this.clockOffset);
    return this.clockOffset;
  }
  devSweep() { const r = this.core.sweep(); this.ctx.waitUntil(this.flushImageDeletes()); return r; }

  /** Daily sweep when due; image expiry and R2 deletes every time. */
  async alarm() {
    const lastSweep = this.ctx.storage.kv.get<number>("lastSweep") ?? 0;
    if (Date.now() - lastSweep >= DAY - 60_000) {
      this.core.sweep();
      this.ctx.storage.kv.put("lastSweep", Date.now());
    } else {
      this.core.sweepImagesNow();
    }
    await this.flushImageDeletes();
    const ni = this.core.nextImageDeadline();
    const nextImage = ni === null ? null : this.realTime(ni);
    const nextDaily = (this.ctx.storage.kv.get<number>("lastSweep") ?? Date.now()) + DAY;
    await this.ctx.storage.setAlarm(Math.max(Date.now() + 1000, Math.min(nextDaily, nextImage ?? nextDaily)));
  }
}
