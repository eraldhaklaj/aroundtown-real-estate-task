import type { Listing, PublicUser } from "./types";

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
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
  if (!res.ok) throw new ApiError(res.status, typeof body.error === "string" ? body.error : "Something went wrong.");
  return body as T;
}

export const api = {
  login: (email: string, password: string) =>
    request<{ user: PublicUser }>("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }),
  logout: () => request<void>("/auth/logout", { method: "POST" }),
  me: () => request<{ user: PublicUser }>("/auth/me"),
  listings: () => request<{ listings: Listing[] }>("/listings"),
  listing: (id: string) => request<{ listing: Listing }>(`/listings/${encodeURIComponent(id)}`),
  generateListing: (details: GenerateListingInput) =>
    request<{ draft: ListingDraft }>("/ai/generate-listing", { method: "POST", body: JSON.stringify(details) }),
  createListing: (input: Omit<GenerateListingInput, "highlights"> & ListingDraft) =>
    request<{ listing: Listing }>("/listings", { method: "POST", body: JSON.stringify(input) }),
};

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

type StreamEvent = { type: "delta"; text: string } | { type: "done" } | { type: "error"; message: string };

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
): Promise<void> {
  const res = await fetch(`/api/ai/listings/${encodeURIComponent(listingId)}/ask`, {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question, history }),
    signal,
  });

  if (!res.ok || !res.body) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(res.status, typeof body.error === "string" ? body.error : "The assistant is unavailable.");
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
      else if (event.type === "done") return;
    }
  }
  throw new ApiError(502, "The answer was cut off. Please try again.");
}
