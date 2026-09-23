import type Anthropic from "@anthropic-ai/sdk";
import { Router, type Response } from "express";
import { anthropic, describeAiError, FALLBACK_OPTIONS, MODEL, publicAiErrorMessage } from "../ai/client.js";
import { GENERATED_DRAFT_JSON_SCHEMA, LISTING_GENERATOR_SYSTEM_PROMPT, propertyQaSystemPrompt } from "../ai/prompts.js";
import { findListing } from "../data/store.js";
import { log } from "../log.js";
import { requireRole } from "../middleware/auth.js";
import { HttpError } from "../middleware/error.js";
import { aiLimiter } from "../middleware/rateLimit.js";
import { AskSchema, GeneratedDraftSchema, GenerateListingSchema, ListingIdSchema, parse } from "../validation.js";

export const aiRouter = Router();

type StreamEvent = { type: "delta"; text: string } | { type: "done" } | { type: "error"; message: string };

function sendEvent(res: Response, event: StreamEvent) {
  res.write(`data: ${JSON.stringify(event)}\n\n`);
}

/**
 * Property Q&A. Streams the answer as Server-Sent Events.
 * The listing is loaded server-side from the id; the client only sends the question and recent history.
 */
aiRouter.post("/listings/:id/ask", aiLimiter, async (req, res) => {
  const listingId = parse(ListingIdSchema, req.params.id);
  const { question, history } = parse(AskSchema, req.body);
  const listing = findListing(listingId);
  if (!listing) throw new HttpError(404, "Listing not found");

  const messages: Anthropic.Beta.BetaMessageParam[] = [...history, { role: "user", content: question }];

  res.writeHead(200, {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
  });

  const stream = anthropic.beta.messages.stream({
    model: MODEL,
    max_tokens: 2000,
    system: propertyQaSystemPrompt(listing),
    messages,
    output_config: { effort: "low" },
    ...FALLBACK_OPTIONS,
  });

  // Stop paying for tokens nobody will read if the user navigates away or presses Stop.
  let clientGone = false;
  res.on("close", () => {
    if (!res.writableFinished) {
      clientGone = true;
      stream.abort();
    }
  });

  try {
    for await (const event of stream) {
      if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
        sendEvent(res, { type: "delta", text: event.delta.text });
      }
    }
    const final = await stream.finalMessage();
    log.info("ai.ask", {
      userId: req.user!.id,
      listingId,
      model: final.model,
      stopReason: final.stop_reason,
      inputTokens: final.usage.input_tokens,
      outputTokens: final.usage.output_tokens,
    });
    if (final.stop_reason === "refusal") {
      sendEvent(res, { type: "error", message: "The assistant can't help with that. Try asking something about this property." });
    } else {
      sendEvent(res, { type: "done" });
    }
  } catch (err) {
    if (clientGone) {
      log.info("ai.ask_cancelled", { userId: req.user!.id, listingId });
      return;
    }
    log.error("ai.ask_failed", { userId: req.user!.id, listingId, ...describeAiError(err) });
    sendEvent(res, { type: "error", message: publicAiErrorMessage(err) });
  } finally {
    res.end();
  }
});

/** Smart Listing Generator (agents only). Returns a structured draft; nothing is saved until the agent confirms. */
aiRouter.post("/generate-listing", requireRole("agent"), aiLimiter, async (req, res) => {
  const details = parse(GenerateListingSchema, req.body);

  let response: Anthropic.Beta.BetaMessage;
  try {
    response = await anthropic.beta.messages.create({
      model: MODEL,
      max_tokens: 4000,
      system: LISTING_GENERATOR_SYSTEM_PROMPT,
      messages: [{ role: "user", content: `<property_details>\n${JSON.stringify(details, null, 2)}\n</property_details>` }],
      output_config: { effort: "low", format: { type: "json_schema", schema: GENERATED_DRAFT_JSON_SCHEMA } },
      ...FALLBACK_OPTIONS,
    });
  } catch (err) {
    log.error("ai.generate_failed", { userId: req.user!.id, ...describeAiError(err) });
    throw new HttpError(502, publicAiErrorMessage(err));
  }

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
