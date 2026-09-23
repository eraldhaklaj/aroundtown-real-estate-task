// Preflight for `npm run dev`, `npm run build` and `npm start`:
// stops early with clear instructions when the Claude API key is missing.
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseEnv } from "node:util";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const envPath = path.join(root, ".env");

function fail(title, steps) {
  console.error(`\n✖ ${title}\n\n${steps.map((s, i) => `  ${i + 1}. ${s}`).join("\n")}\n`);
  process.exit(1);
}

const HOW_TO_GET_A_KEY = "Get an API key from the Anthropic Console: https://console.anthropic.com/settings/keys";

// Like the server, a variable already set in the shell takes precedence over .env.
let key = process.env.ANTHROPIC_API_KEY?.trim();

if (!key) {
  if (!existsSync(envPath)) {
    fail("No .env file found. The app needs a Claude API key to run.", [
      "Create it from the template:  cp .env.example .env",
      HOW_TO_GET_A_KEY,
      "Paste it into .env:  ANTHROPIC_API_KEY=sk-ant-...",
      "Run the command again.",
    ]);
  }
  key = parseEnv(readFileSync(envPath, "utf8")).ANTHROPIC_API_KEY?.trim();
}

if (!key) {
  fail("ANTHROPIC_API_KEY is missing. The app needs a Claude API key to run.", [
    HOW_TO_GET_A_KEY,
    "Open .env in the project root and set:  ANTHROPIC_API_KEY=sk-ant-...",
    "Run the command again.",
  ]);
}

if (!key.startsWith("sk-ant-")) {
  console.warn("\n⚠ ANTHROPIC_API_KEY doesn't look like an Anthropic key (they start with \"sk-ant-\"). Continuing anyway.\n");
}
