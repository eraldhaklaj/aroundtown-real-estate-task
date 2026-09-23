import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import cookieParser from "cookie-parser";
import express from "express";
import helmet from "helmet";
import { config } from "./config.js";
import { log } from "./log.js";
import { identify } from "./middleware/auth.js";
import { errorHandler, notFound } from "./middleware/error.js";
import { aiRouter } from "./routes/ai.js";
import { authRouter } from "./routes/auth.js";
import { listingsRouter } from "./routes/listings.js";

const app = express();

app.disable("x-powered-by");
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        "img-src": ["'self'", "data:", "https://images.unsplash.com"],
        "connect-src": ["'self'"],
        // The demo runs over plain HTTP on localhost; enable this when served behind TLS.
        "upgrade-insecure-requests": null,
      },
    },
  }),
);
app.use(express.json({ limit: "10kb" }));
app.use(cookieParser());

// Every API request is resolved to a signed-in user ("token" cookie) or an anonymous guest ("a" cookie).
// Access rules live on the routes: browsing is public, AI is quota-limited for guests, agent tools need a role.
app.use("/api", identify);
app.use("/api/auth", authRouter);
app.use("/api/listings", listingsRouter);
app.use("/api/ai", aiRouter);
app.use("/api", notFound);

// In production the API also serves the built client (same origin, so the CSP above applies).
const clientDist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../client/dist");
if (config.isProd && existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get("/{*splat}", (_req, res) => res.sendFile(path.join(clientDist, "index.html")));
}

app.use(errorHandler);

app.listen(config.PORT, () => {
  log.info("server.started", { port: config.PORT, env: config.NODE_ENV, qaModel: config.QA_MODEL, qaFallbackModel: config.QA_FALLBACK_MODEL });
});
