// Masks contact details users type, before anything is written to logs or the Q&A record.
const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
// 8+ chars of digits/phone punctuation, optionally starting with + or 00 (e.g. "+49 30 1234 5678", "0176-12345678").
const PHONE = /(?:\+|\b00)?\d[\d ()./-]{6,}\d/g;

export function maskPii(text: string): string {
  return text.replace(EMAIL, "[email]").replace(PHONE, "[phone]");
}

/** Keeps enough of an email for incident review without logging it in full: "b***@demo.com". */
export function maskEmail(email: string): string {
  const [local = "", domain = ""] = email.split("@");
  return `${local.slice(0, 1)}***@${domain}`;
}
