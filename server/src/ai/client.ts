import Anthropic from "@anthropic-ai/sdk";
import { config } from "../config.js";

// The only place the API key is used. It never leaves the server.
export const anthropic = new Anthropic({ apiKey: config.ANTHROPIC_API_KEY, timeout: 60_000, maxRetries: 1 });

export const QA_MODEL = config.QA_MODEL;
export const QA_FALLBACK_MODEL = config.QA_FALLBACK_MODEL;
export const GENERATOR_MODEL = config.GENERATOR_MODEL;

/** Answers are short by design: this caps output cost and keeps replies direct. */
export const QA_MAX_OUTPUT_TOKENS = 350;

/** Listings whose prompt is longer than this go straight to the fallback model. */
export const LONG_PROMPT_CHARS = 15_000;

/**
 * Per-model request settings for Q&A.
 * Haiku 4.5 takes a low temperature for factual answers. Sonnet 5 rejects sampling parameters, and
 * thinking is switched off so the whole 350-token budget goes to the answer.
 */
export function qaRequest(
  model: string,
  system: string,
  messages: Anthropic.MessageParam[],
): Anthropic.MessageCreateParamsNonStreaming {
  const base = { model, max_tokens: QA_MAX_OUTPUT_TOKENS, system, messages };
  return model.startsWith("claude-haiku")
    ? { ...base, temperature: 0.2 }
    : { ...base, thinking: { type: "disabled" } };
}

/** Errors worth retrying on the fallback model: overload, rate limits, 5xx, network. */
export function isRetryable(err: unknown): boolean {
  if (err instanceof Anthropic.APIConnectionError) return true;
  return err instanceof Anthropic.APIError && typeof err.status === "number" && (err.status === 429 || err.status >= 500);
}

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
