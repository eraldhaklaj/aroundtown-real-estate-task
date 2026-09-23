import type { Listing, PublicUser } from "./types";

export class ApiError extends Error {
  status: number;
  /** Machine-readable reason from the server, e.g. "login_required" when a guest's free question is used up. */
  code?: string;
  constructor(status: number, message: string, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

function toApiError(status: number, body: { error?: unknown; code?: unknown }, fallback: string) {
  return new ApiError(
    status,
    typeof body.error === "string" ? body.error : fallback,
    typeof body.code === "string" ? body.code : undefined,
  );
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      ...init,
      credentials: "same-origin",
      headers: { "Content-Type": "application/json", ...init.headers },
    });
  } catch {
    throw new ApiError(0, "Network error. Check your connection and try again.");
  }

  if (res.status === 204) return undefined as T;
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw toApiError(res.status, body, "Something went wrong.");
  return body as T;
}

export const api = {
  login: (email: string, password: string) =>
    request<{ user: PublicUser }>("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }),
  logout: () => request<void>("/auth/logout", { method: "POST" }),
  /** Signed-in user, or null for guests (the first call also creates the guest session). */
  me: () => request<{ user: PublicUser | null }>("/auth/me"),
  listings: () => request<{ listings: Listing[] }>("/listings"),
  listing: (id: string) => request<{ listing: Listing }>(`/listings/${encodeURIComponent(id)}`),
  generateListing: (details: GenerateListingInput) =>
    request<{ draft: ListingDraft }>("/ai/generate-listing", { method: "POST", body: JSON.stringify(details) }),
  createListing: (input: Omit<GenerateListingInput, "highlights"> & ListingDraft) =>
    request<{ listing: Listing }>("/listings", { method: "POST", body: JSON.stringify(input) }),
  qaStatus: (listingId: string) => request<QaStatus>(`/ai/listings/${encodeURIComponent(listingId)}/status`),
  rateAnswer: (answerId: string, rating: "up" | "down") =>
    request<void>(`/ai/answers/${encodeURIComponent(answerId)}/feedback`, { method: "POST", body: JSON.stringify({ rating }) }),
  setQaEnabled: (listingId: string, enabled: boolean) =>
    request<{ qaEnabled: boolean }>(`/listings/${encodeURIComponent(listingId)}/qa`, { method: "PATCH", body: JSON.stringify({ enabled }) }),
  qaInsights: (listingId: string) => request<QaInsights>(`/listings/${encodeURIComponent(listingId)}/qa-insights`),
};

export interface QaStatus {
  qaEnabled: boolean;
  /** false when the daily AI budget is used up */
  available: boolean;
  /** null when limits don't apply (agent on their own listing) */
  remaining: { forListing: number; today: number; perListingLimit: number; perDayLimit: number } | null;
  retentionDays: number;
}

export interface QaInsights {
  questions: number;
  thumbsUp: number;
  thumbsDown: number;
  missingInfo: { question: string; askedAt: string }[];
  privateData: { sellerName: string; sellerPhone: string; minimumPrice?: number; agentNotes: string } | null;
}

export interface GenerateListingInput {
  type: Listing["type"];
  status: Listing["status"];
  bedrooms: number;
  bathrooms: number;
  sizeSqm: number;
  district: string;
  price: number;
  highlights: string;
}

export interface ListingDraft {
  title: string;
  description: string;
  features: string[];
}

export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

type StreamEvent =
  | { type: "delta"; text: string }
  | { type: "done"; answerId: string | null; missingInfo: boolean }
  | { type: "error"; message: string };

/**
 * Asks a question about a listing and streams the answer.
 * POST + fetch streaming (EventSource only supports GET), parsing the SSE `data:` lines by hand.
 */
export async function askAboutListing(
  listingId: string,
  question: string,
  history: ChatTurn[],
  onDelta: (text: string) => void,
  signal: AbortSignal,
): Promise<{ answerId: string | null; missingInfo: boolean }> {
  const res = await fetch(`/api/ai/listings/${encodeURIComponent(listingId)}/ask`, {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question, history }),
    signal,
  });

  if (!res.ok || !res.body) {
    const body = await res.json().catch(() => ({}));
    throw toApiError(res.status, body, "The assistant is unavailable.");
  }

  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += value;
    const frames = buffer.split("\n\n");
    buffer = frames.pop() ?? "";
    for (const frame of frames) {
      if (!frame.startsWith("data: ")) continue;
      const event = JSON.parse(frame.slice(6)) as StreamEvent;
      if (event.type === "delta") onDelta(event.text);
      else if (event.type === "error") throw new ApiError(502, event.message);
      else if (event.type === "done") return { answerId: event.answerId, missingInfo: event.missingInfo };
    }
  }
  throw new ApiError(502, "The answer was cut off. Please try again.");
}
