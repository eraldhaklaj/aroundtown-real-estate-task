import { z } from "zod";

const EnvSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3001),
  ANTHROPIC_API_KEY: z
    .string("ANTHROPIC_API_KEY is missing")
    .trim()
    .min(1, "ANTHROPIC_API_KEY is missing. Get a key at https://console.anthropic.com/settings/keys"),
  // Q&A: fast, cheap default model plus a stronger fallback (errors, very long listings).
  QA_MODEL: z.string().min(1).default("claude-haiku-4-5-20251001"),
  QA_FALLBACK_MODEL: z.string().min(1).default("claude-sonnet-5"),
  GENERATOR_MODEL: z.string().min(1).default("claude-sonnet-5"),
  // Global kill switch: AI features pause for the rest of the UTC day once estimated spend hits this.
  AI_DAILY_SPEND_CAP_USD: z.coerce.number().positive().default(5),
  JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 characters"),
});

const parsed = EnvSchema.safeParse(process.env);

if (!parsed.success) {
  // Report which variables are wrong, never their values.
  const problems = parsed.error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`);
  console.error(`Invalid environment configuration:\n${problems.join("\n")}\nCopy .env.example to .env and fill it in.`);
  process.exit(1);
}

export const config = {
  ...parsed.data,
  isProd: parsed.data.NODE_ENV === "production",
};
