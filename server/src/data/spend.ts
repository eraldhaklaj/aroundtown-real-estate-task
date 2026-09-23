import type Anthropic from "@anthropic-ai/sdk";
import { config } from "../config.js";
import { log } from "../log.js";

// USD per million tokens (input, output). Unknown models are priced high so the cap errs on the safe side.
const PRICING: Array<[prefix: string, input: number, output: number]> = [
  ["claude-haiku-4-5", 1, 5],
  ["claude-sonnet-5", 2, 10],
];
const UNKNOWN_MODEL_PRICING = [5, 25] as const;

let day = "";
let spentUsd = 0;

function rollDay() {
  const today = new Date().toISOString().slice(0, 10);
  if (today !== day) {
    day = today;
    spentUsd = 0;
  }
}

export function recordSpend(model: string, usage: Anthropic.Usage) {
  rollDay();
  const [, input, output] = PRICING.find(([prefix]) => model.startsWith(prefix)) ?? ["", ...UNKNOWN_MODEL_PRICING];
  const tokensIn = usage.input_tokens + (usage.cache_creation_input_tokens ?? 0) + (usage.cache_read_input_tokens ?? 0);
  spentUsd += (tokensIn * input + usage.output_tokens * output) / 1_000_000;
  if (spentUsd >= config.AI_DAILY_SPEND_CAP_USD) log.warn("ai.spend_cap_reached", { spentUsd: Number(spentUsd.toFixed(4)) });
}

export function spendCapReached(): boolean {
  rollDay();
  return spentUsd >= config.AI_DAILY_SPEND_CAP_USD;
}
