import { randomUUID } from "node:crypto";
import { maskPii } from "../pii.js";

// Q&A conversation records: what buyers asked, for feedback and agent insights.
// Contact details are masked before storing, and records are deleted after the retention period.
// In memory for the demo; production would use a database table with a TTL job.
export const RETENTION_DAYS = 90;
const RETENTION_MS = RETENTION_DAYS * 24 * 60 * 60 * 1000;

export interface QaRecord {
  id: string;
  listingId: string;
  caller: string;
  question: string;
  answer: string;
  model: string;
  missingInfo: boolean;
  rating?: "up" | "down";
  createdAt: number;
}

let records: QaRecord[] = [];

function purgeExpired() {
  const cutoff = Date.now() - RETENTION_MS;
  records = records.filter((r) => r.createdAt >= cutoff);
}
setInterval(purgeExpired, 60 * 60 * 1000).unref();

export function recordAnswer(input: Omit<QaRecord, "id" | "createdAt" | "question" | "answer"> & { question: string; answer: string }): QaRecord {
  purgeExpired();
  const record: QaRecord = {
    ...input,
    id: randomUUID(),
    question: maskPii(input.question),
    answer: maskPii(input.answer),
    createdAt: Date.now(),
  };
  records.push(record);
  return record;
}

/** Only the caller who received the answer can rate it. */
export function rateAnswer(id: string, caller: string, rating: "up" | "down"): boolean {
  const record = records.find((r) => r.id === id && r.caller === caller);
  if (!record) return false;
  record.rating = rating;
  return true;
}

export function listingInsights(listingId: string) {
  const forListing = records.filter((r) => r.listingId === listingId);
  return {
    questions: forListing.length,
    thumbsUp: forListing.filter((r) => r.rating === "up").length,
    thumbsDown: forListing.filter((r) => r.rating === "down").length,
    missingInfo: forListing
      .filter((r) => r.missingInfo)
      .slice(-20)
      .reverse()
      .map((r) => ({ question: r.question, askedAt: new Date(r.createdAt).toISOString() })),
  };
}
