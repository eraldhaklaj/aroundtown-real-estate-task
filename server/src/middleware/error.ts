import type { NextFunction, Request, Response } from "express";
import { log } from "../log.js";

/** An error whose message is safe to show to the client. */
export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export function notFound(_req: Request, res: Response) {
  res.status(404).json({ error: "Not found" });
}

// Express recognises error handlers by their 4-argument signature.
export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  let status = 500;
  let message = "Something went wrong. Please try again.";

  if (err instanceof HttpError) {
    status = err.status;
    message = err.message;
  } else if (isClientError(err)) {
    // body-parser errors (malformed JSON, payload too large) carry a 4xx status.
    status = err.status;
    message = status === 413 ? "Request body too large" : "Malformed request";
  }

  if (status >= 500) {
    log.error("http.unhandled_error", {
      method: req.method,
      path: req.path,
      error: err instanceof Error ? err.message : String(err),
    });
  }

  if (res.headersSent) {
    res.end();
    return;
  }
  res.status(status).json({ error: message });
}

function isClientError(err: unknown): err is { status: number } {
  const status = (err as { status?: unknown } | null)?.status;
  return typeof status === "number" && status >= 400 && status < 500;
}
