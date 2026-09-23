import type Anthropic from "@anthropic-ai/sdk";
import { Router, type Request, type Response } from "express";
import {
  anthropic,
  describeAiError,
  GENERATOR_MODEL,
  isRetryable,
  LONG_PROMPT_CHARS,
  publicAiErrorMessage,
  QA_FALLBACK_MODEL,
  QA_MODEL,
  qaRequest,
} from "../ai/client.js";
import {
  GENERATED_DRAFT_JSON_SCHEMA,
  LISTING_GENERATOR_SYSTEM_PROMPT,
  NOT_IN_LISTING,
  propertyQaSystemPrompt,
} from "../ai/prompts.js";
import { type QaCaller, remainingQuestions, reserveQuestion } from "../ai/qaLimits.js";
import { rateAnswer, recordAnswer, RETENTION_DAYS } from "../data/qaLog.js";
import { recordSpend, spendCapReached } from "../data/spend.js";
import { findListing } from "../data/store.js";
import { log } from "../log.js";
import { requireRole } from "../middleware/auth.js";
import { HttpError } from "../middleware/error.js";
import { generatorLimiter } from "../middleware/rateLimit.js";
import type { Listing } from "../types.js";
import {
  AnswerIdSchema,
  AskSchema,
  FeedbackSchema,
  GeneratedDraftSchema,
  GenerateListingSchema,
  ListingIdSchema,
  parse,
} from "../validation.js";

export const aiRouter = Router();

type StreamEvent =
  | { type: "delta"; text: string }
  | { type: "done"; answerId: string | null; missingInfo: boolean }
  | { type: "error"; message: string };

function sendEvent(res: Response, event: StreamEvent) {
  res.write(`data: ${JSON.stringify(event)}\n\n`);
}

function loadListing(req: Request): Listing {
  const listing = findListing(parse(ListingIdSchema, req.params.id));
  if (!listing) throw new HttpError(404, "Listing not found");
  return listing;
}

/** Who is asking, which usage buckets they count against, and whether they're exempt (agent on their own listing). */
function qaCaller(req: Request, listing: Listing): QaCaller {
  if (req.user) {
    return {
      tier: "user",
      keys: [`user:${req.user.id}`],
      exempt: req.user.role === "agent" && listing.agentId === req.user.id,
    };
  }
  return { tier: "anon", keys: [`anon:${req.anon!.id}`, `ip:${req.ip ?? "unknown"}`], exempt: false };
}

function assertQaAvailable(listing: Listing) {
  if (listing.qaEnabled === false) {
    throw new HttpError(403, "The agent has turned off AI questions for this listing. Please contact the agent directly.", "qa_disabled");
  }
  if (spendCapReached()) {
    throw new HttpError(503, "The AI assistant is paused for today. Please contact the agent directly.", "unavailable", 3600);
  }
}

/** What the chat panel needs before the first question: is Q&A on, and how many questions are left. */
aiRouter.get("/listings/:id/status", (req, res) => {
  const listing = loadListing(req);
  const caller = qaCaller(req, listing);
  res.json({
    qaEnabled: listing.qaEnabled !== false,
    available: !spendCapReached(),
    remaining: remainingQuestions(caller, listing.id),
    retentionDays: RETENTION_DAYS,
  });
});

/**
 * Property Q&A. Streams the answer as Server-Sent Events.
 * The listing is loaded server-side from the id; the client only sends the question and recent history.
 */
aiRouter.post("/listings/:id/ask", async (req, res) => {
  const listing = loadListing(req);
  const { question, history } = parse(AskSchema, req.body);
  assertQaAvailable(listing);

  const caller = qaCaller(req, listing);
  // Guests must present an existing "a" cookie: one issued on this very request doesn't get free questions.
  if (caller.tier === "anon" && req.anon!.isNew) {
    throw new HttpError(429, "Please reload the page and try again.", "login_required", 1);
  }
  const reserved = reserveQuestion(caller, listing.id);
  if (!reserved.ok) {
    const { code, message, retryAfterSeconds } = reserved.denial;
    log.info("ai.ask_limited", { caller: caller.keys[0], listingId: listing.id, code });
    throw new HttpError(429, message, code, retryAfterSeconds);
  }
  const { reservation } = reserved;

  const system = propertyQaSystemPrompt(listing);
  const messages: Anthropic.MessageParam[] = [...history, { role: "user", content: question }];
  // Very long listings go straight to the stronger model; otherwise Haiku first, Sonnet if Haiku fails.
  const models = system.length > LONG_PROMPT_CHARS ? [QA_FALLBACK_MODEL] : [QA_MODEL, QA_FALLBACK_MODEL];

  res.writeHead(200, {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
  });

  // Stop paying for tokens nobody will read if the user navigates away or presses Stop.
  let clientGone = false;
  let current: ReturnType<typeof anthropic.messages.stream> | null = null;
  res.on("close", () => {
    if (!res.writableFinished) {
      clientGone = true;
      current?.abort();
    }
  });

  let answer = "";
  try {
    let final: Anthropic.Message | null = null;
    for (const model of models) {
      current = anthropic.messages.stream(qaRequest(model, system, messages));
      try {
        for await (const event of current) {
          if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
            answer += event.delta.text;
            sendEvent(res, { type: "delta", text: event.delta.text });
          }
        }
        final = await current.finalMessage();
        break;
      } catch (err) {
        // Fall back only if nothing reached the user yet and the error is transient.
        if (clientGone || answer || !isRetryable(err) || model === models.at(-1)) throw err;
        log.warn("ai.ask_fallback", { from: model, to: models.at(-1), ...describeAiError(err) });
      }
    }
    if (!final) throw new Error("no response");

    recordSpend(final.model, final.usage);
    reservation.addTokens(final.usage.input_tokens + final.usage.output_tokens);

    if (final.stop_reason === "refusal") {
      sendEvent(res, { type: "error", message: "The assistant can't help with that. Try asking something about this property." });
      return;
    }
    if (final.stop_reason === "max_tokens") sendEvent(res, { type: "delta", text: "…" });

    const missingInfo = answer.replace(/’/g, "'").toLowerCase().includes(NOT_IN_LISTING.toLowerCase().replace(/\.$/, ""));
    // Agents testing their own listing don't show up in its stats.
    const record = caller.exempt
      ? null
      : recordAnswer({ listingId: listing.id, caller: caller.keys[0], question, answer, model: final.model, missingInfo });

    log.info("ai.ask", {
      caller: caller.keys[0],
      listingId: listing.id,
      model: final.model,
      stopReason: final.stop_reason,
      inputTokens: final.usage.input_tokens,
      outputTokens: final.usage.output_tokens,
      missingInfo,
    });
    sendEvent(res, { type: "done", answerId: record?.id ?? null, missingInfo });
  } catch (err) {
    if (clientGone) {
      log.info("ai.ask_cancelled", { caller: caller.keys[0], listingId: listing.id });
      return;
    }
    reservation.refund();
    log.error("ai.ask_failed", { caller: caller.keys[0], listingId: listing.id, ...describeAiError(err) });
    sendEvent(res, { type: "error", message: publicAiErrorMessage(err) });
  } finally {
    reservation.release();
    res.end();
  }
});

/** Thumbs up/down on an answer. Only the person who got the answer can rate it. */
aiRouter.post("/answers/:id/feedback", (req, res) => {
  const id = parse(AnswerIdSchema, req.params.id);
  const { rating } = parse(FeedbackSchema, req.body);
  const caller = req.user ? `user:${req.user.id}` : `anon:${req.anon!.id}`;
  if (!rateAnswer(id, caller, rating)) throw new HttpError(404, "Answer not found");
  res.status(204).end();
});

/** Smart Listing Generator (agents only). Returns a structured draft; nothing is saved until the agent confirms. */
aiRouter.post("/generate-listing", requireRole("agent"), generatorLimiter, async (req, res) => {
  const details = parse(GenerateListingSchema, req.body);
  if (spendCapReached()) throw new HttpError(503, "AI features are paused for today. Please try again tomorrow.", "unavailable", 3600);

  let response: Anthropic.Message;
  try {
    response = await anthropic.messages.create({
      model: GENERATOR_MODEL,
      max_tokens: 4000,
      system: LISTING_GENERATOR_SYSTEM_PROMPT,
      messages: [{ role: "user", content: `<property_details>\n${JSON.stringify(details, null, 2)}\n</property_details>` }],
      output_config: { effort: "low", format: { type: "json_schema", schema: GENERATED_DRAFT_JSON_SCHEMA } },
    });
  } catch (err) {
    log.error("ai.generate_failed", { userId: req.user!.id, ...describeAiError(err) });
    throw new HttpError(502, publicAiErrorMessage(err));
  }

  recordSpend(response.model, response.usage);
  log.info("ai.generate", {
    userId: req.user!.id,
    model: response.model,
    stopReason: response.stop_reason,
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
  });

  if (response.stop_reason === "refusal") {
    throw new HttpError(422, "The assistant couldn't write a listing from those details. Please adjust them and try again.");
  }

  const text = response.content.find((b) => b.type === "text")?.text ?? "";
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new HttpError(502, "The assistant returned an unexpected response. Please try again.");
  }
  const draft = GeneratedDraftSchema.safeParse(json);
  if (!draft.success) throw new HttpError(502, "The assistant returned an unexpected response. Please try again.");

  res.json({ draft: draft.data });
});
