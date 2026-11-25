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
    return fn.apply(this.core, args);
  }

  /** Dev and tests only (guarded in the Worker): move the DO clock forward. */
  devAdvance(ms: number) {
    this.clockOffset += ms;
    this.ctx.storage.kv.put("devclock", this.clockOffset);
    return this.clockOffset;
  }
  devSweep() { return this.core.sweep(); }

  async alarm() {
    this.core.sweep();
    await this.ctx.storage.setAlarm(Date.now() + DAY);
  }
}
