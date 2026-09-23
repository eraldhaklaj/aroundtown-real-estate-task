import { z } from "zod";
import { HttpError } from "./middleware/error.js";

export const QUESTION_MAX_CHARS = 500;
export const HISTORY_MAX_MESSAGES = 6;

/** Parses untrusted input, turning validation failures into a 400 with a safe message. */
export function parse<T extends z.ZodType>(schema: T, data: unknown): z.output<T> {
  const result = schema.safeParse(data);
  if (!result.success) {
    // No body means the request wasn't JSON at all; otherwise the first issue's message is safe to show.
    throw new HttpError(400, data === undefined ? "Invalid request" : (result.error.issues[0]?.message ?? "Invalid request"));
  }
  return result.data;
}

export const LoginSchema = z.object({
  email: z.email("Enter a valid email address").max(254),
  password: z.string().min(1, "Password is required").max(128),
});

export const ListingIdSchema = z.string().regex(/^lst-[a-z0-9]{3,12}$/, "Invalid listing id");

export const AskSchema = z.object({
  question: z
    .string()
    .trim()
    .min(1, "Please type a question")
    .max(QUESTION_MAX_CHARS, `Questions are limited to ${QUESTION_MAX_CHARS} characters`),
  history: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().trim().min(1).max(2000),
      }),
    )
    .max(HISTORY_MAX_MESSAGES)
    .refine(
      (h) => h.every((m, i) => m.role === (i % 2 === 0 ? "user" : "assistant")),
      "Conversation history must alternate user and assistant turns",
    )
    .default([]),
});

const PropertyTypeSchema = z.enum(["apartment", "house", "townhouse", "penthouse", "loft"]);
const StatusSchema = z.enum(["sale", "rent"]);

export const GenerateListingSchema = z.object({
  type: PropertyTypeSchema,
  status: StatusSchema,
  bedrooms: z.int().min(0).max(20),
  bathrooms: z.int().min(1).max(10),
  sizeSqm: z.number().min(10).max(2000),
  district: z.string().trim().min(2, "District is required").max(60),
  price: z.number().positive().max(50_000_000),
  highlights: z.string().trim().max(300, "Highlights are limited to 300 characters").default(""),
});

export const GeneratedDraftSchema = z.object({
  title: z.string().trim().min(1).max(120),
  description: z.string().trim().min(1).max(2000),
  features: z.array(z.string().trim().min(1).max(80)).max(12),
});

export const CreateListingSchema = GenerateListingSchema.omit({ highlights: true }).extend(GeneratedDraftSchema.shape);
export type CreateListingInput = z.output<typeof CreateListingSchema>;
