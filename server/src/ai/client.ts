import Anthropic from "@anthropic-ai/sdk";
import { config } from "../config.js";

// The only place the API key is used. It never leaves the server.
export const anthropic = new Anthropic({ apiKey: config.ANTHROPIC_API_KEY, timeout: 60_000, maxRetries: 2 });

export const MODEL = config.ANTHROPIC_MODEL;

// If the model declines on safety grounds, the API retries on Anthropic's recommended fallback model.
export const FALLBACK_OPTIONS: Pick<Anthropic.Beta.MessageCreateParams, "betas" | "fallbacks"> = {
  betas: ["server-side-fallback-2026-07-01"],
  fallbacks: "default",
};

/** Maps SDK errors to a message that is safe to show users (details are logged server-side). */
export function publicAiErrorMessage(err: unknown): string {
  if (err instanceof Anthropic.RateLimitError) return "The AI assistant is busy right now. Please try again in a moment.";
  if (err instanceof Anthropic.APIConnectionError) return "Couldn't reach the AI assistant. Please try again.";
  return "The AI assistant is temporarily unavailable. Please try again later.";
}

export function describeAiError(err: unknown) {
  if (err instanceof Anthropic.APIError) return { errorType: err.constructor.name, status: err.status ?? null, requestId: err.requestID ?? null };
  return { errorType: err instanceof Error ? err.name : "unknown", status: null, requestId: null };
}
