// Freemium quota for anonymous guests, keyed by the id in their signed "a" cookie.
// In memory for the demo; a real deployment would use Redis or the database.
export const FREE_QUESTIONS_PER_GUEST = 1;

const used = new Map<string, number>();

export function freeQuestionsLeft(anonId: string): number {
  return Math.max(0, FREE_QUESTIONS_PER_GUEST - (used.get(anonId) ?? 0));
}

/** Reserves one free question. Returns false when the guest has none left. */
export function consumeFreeQuestion(anonId: string): boolean {
  if (freeQuestionsLeft(anonId) === 0) return false;
  used.set(anonId, (used.get(anonId) ?? 0) + 1);
  return true;
}

/** Gives the question back when it failed on our side (not when the guest cancelled). */
export function refundFreeQuestion(anonId: string) {
  const n = used.get(anonId) ?? 0;
  if (n > 0) used.set(anonId, n - 1);
}
