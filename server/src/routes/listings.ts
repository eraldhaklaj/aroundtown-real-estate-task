import { Router, type Request } from "express";
import { listingInsights } from "../data/qaLog.js";
import { privateListingData } from "../data/privateListingData.js";
import { addListing, findListing, getListings } from "../data/store.js";
import { log } from "../log.js";
import { requireRole } from "../middleware/auth.js";
import { HttpError } from "../middleware/error.js";
import { CreateListingSchema, ListingIdSchema, parse, QaToggleSchema } from "../validation.js";

// Browsing is public (guests included); creating and managing listings is for agents only.
export const listingsRouter = Router();

listingsRouter.get("/", (_req, res) => {
  res.json({ listings: getListings() });
});

listingsRouter.get("/:id", (req, res) => {
  const listing = findListing(parse(ListingIdSchema, req.params.id));
  if (!listing) throw new HttpError(404, "Listing not found");
  res.json({ listing });
});

listingsRouter.post("/", requireRole("agent"), (req, res) => {
  const input = parse(CreateListingSchema, req.body);
  const listing = addListing(input, req.user!.id);
  log.info("listing.created", { userId: req.user!.id, listingId: listing.id });
  res.status(201).json({ listing });
});

/** The listing's own agent only. Other agents get a 404 so listing ownership isn't revealed. */
function ownListing(req: Request) {
  const listing = findListing(parse(ListingIdSchema, req.params.id));
  if (!listing || listing.agentId !== req.user!.id) throw new HttpError(404, "Listing not found");
  return listing;
}

listingsRouter.patch("/:id/qa", requireRole("agent"), (req, res) => {
  const listing = ownListing(req);
  const { enabled } = parse(QaToggleSchema, req.body);
  listing.qaEnabled = enabled;
  log.info("listing.qa_toggled", { userId: req.user!.id, listingId: listing.id, enabled });
  res.json({ qaEnabled: enabled });
});

/** Q&A stats, questions the listing couldn't answer, and the agent's private notes (never shown to buyers or the AI). */
listingsRouter.get("/:id/qa-insights", requireRole("agent"), (req, res) => {
  const listing = ownListing(req);
  res.json({ ...listingInsights(listing.id), privateData: privateListingData[listing.id] ?? null });
});
