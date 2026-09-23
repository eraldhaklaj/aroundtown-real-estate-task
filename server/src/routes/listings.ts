import { Router } from "express";
import { addListing, findListing, getListings } from "../data/store.js";
import { log } from "../log.js";
import { requireRole } from "../middleware/auth.js";
import { HttpError } from "../middleware/error.js";
import { CreateListingSchema, ListingIdSchema, parse } from "../validation.js";

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
