// Per-caller limits for the Property Q&A. In memory for the demo (Redis in production).
// Guests are tracked under both their device id (the "a" cookie) and their IP, so clearing
// cookies doesn't reset their allowance.

export const QA_LIMITS = {
  anon: { perMinute: 3, perListingPerDay: 3, perDay: 10, concurrent: 1, tokensPerDay: 40_000 },
  user: { perMinute: 6, perListingPerDay: 30, perDay: 100, concurrent: 2, tokensPerDay: 400_000 },
} as const;

export type Tier = keyof typeof QA_LIMITS;

export interface QaCaller {
  tier: Tier;
  /** Usage keys: ["user:<id>"] or ["anon:<device id>", "ip:<address>"] */
  keys: string[];
  /** Agents testing their own listing: nothing is counted or limited. */
  exempt: boolean;
}

export interface LimitDenial {
  code: "login_required" | "daily_limit" | "rate_limited" | "busy";
  message: string;
  retryAfterSeconds: number;
}

interface Usage {
  day: string;
  perDay: number;
  perListing: Map<string, number>;
  tokens: number;
  recent: number[]; // request timestamps in the last minute
  active: number; // streams in progress
}

const usage = new Map<string, Usage>();

const today = () => new Date().toISOString().slice(0, 10);

function secondsUntilMidnightUtc() {
  const now = new Date();
  const midnight = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1);
  return Math.ceil((midnight - now.getTime()) / 1000);
}

function usageFor(key: string): Usage {
  let u = usage.get(key);
  if (!u) {
    u = { day: today(), perDay: 0, perListing: new Map(), tokens: 0, recent: [], active: 0 };
    usage.set(key, u);
  }
  if (u.day !== today()) Object.assign(u, { day: today(), perDay: 0, perListing: new Map(), tokens: 0 });
  const cutoff = Date.now() - 60_000;
  u.recent = u.recent.filter((t) => t > cutoff);
  return u;
}

function denial(caller: QaCaller, u: Usage, listingId: string): LimitDenial | null {
  const limits = QA_LIMITS[caller.tier];
  const guest = caller.tier === "anon";

  if (u.active >= limits.concurrent) {
    return { code: "busy", message: "Please wait for the current answer to finish.", retryAfterSeconds: 5 };
  }
  const untilTomorrow = secondsUntilMidnightUtc();
  if ((u.perListing.get(listingId) ?? 0) >= limits.perListingPerDay) {
    return guest
      ? { code: "login_required", message: `You've used the ${limits.perListingPerDay} free questions for this property. Sign in to keep asking, or contact the agent.`, retryAfterSeconds: untilTomorrow }
      : { code: "daily_limit", message: "You've reached today's question limit for this property. Please contact the agent for more details.", retryAfterSeconds: untilTomorrow };
  }
  if (u.perDay >= limits.perDay || u.tokens >= limits.tokensPerDay) {
    return guest
      ? { code: "login_required", message: "You've used today's free questions. Sign in to keep asking, or contact the agent.", retryAfterSeconds: untilTomorrow }
      : { code: "daily_limit", message: "You've reached today's question limit. Please try again tomorrow or contact the agent.", retryAfterSeconds: untilTomorrow };
  }
  // Checked last so a guest who is out of questions sees the sign-in wall, not a short wait.
  if (u.recent.length >= limits.perMinute) {
    const wait = Math.max(1, Math.ceil((u.recent[0] + 60_000 - Date.now()) / 1000));
    return { code: "rate_limited", message: `You're asking questions quickly. Please wait ${wait} seconds.`, retryAfterSeconds: wait };
  }
  return null;
}

export interface Reservation {
  /** Stream finished (always call). */
  release(): void;
  /** The request failed on our side, so give the question back. */
  refund(): void;
  addTokens(n: number): void;
}

const NOOP: Reservation = { release() {}, refund() {}, addTokens() {} };

/** Checks every limit for every key and, if all pass, counts the question up front (so parallel requests can't overspend). */
export function reserveQuestion(caller: QaCaller, listingId: string): { ok: true; reservation: Reservation } | { ok: false; denial: LimitDenial } {
  if (caller.exempt) return { ok: true, reservation: NOOP };

  const all = caller.keys.map(usageFor);
  for (const u of all) {
    const d = denial(caller, u, listingId);
    if (d) return { ok: false, denial: d };
  }

  const now = Date.now();
  for (const u of all) {
    u.perDay++;
    u.perListing.set(listingId, (u.perListing.get(listingId) ?? 0) + 1);
    u.recent.push(now);
    u.active++;
  }

  let released = false;
  return {
    ok: true,
    reservation: {
      release() {
        if (released) return;
        released = true;
        for (const u of all) u.active = Math.max(0, u.active - 1);
      },
      refund() {
        for (const u of all) {
          u.perDay = Math.max(0, u.perDay - 1);
          u.perListing.set(listingId, Math.max(0, (u.perListing.get(listingId) ?? 0) - 1));
          u.recent = u.recent.filter((t) => t !== now);
        }
      },
      addTokens(n) {
        for (const u of all) u.tokens += n;
      },
    },
  };
}

/** Remaining questions (the strictest across the caller's keys), or null when the caller is exempt. */
export function remainingQuestions(caller: QaCaller, listingId: string) {
  if (caller.exempt) return null;
  const limits = QA_LIMITS[caller.tier];
  const all = caller.keys.map(usageFor);
  return {
    forListing: Math.min(...all.map((u) => Math.max(0, limits.perListingPerDay - (u.perListing.get(listingId) ?? 0)))),
    today: Math.min(...all.map((u) => Math.max(0, limits.perDay - u.perDay))),
    perListingLimit: limits.perListingPerDay,
    perDayLimit: limits.perDay,
  };
}
