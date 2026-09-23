import { randomBytes } from "node:crypto";
import type { CreateListingInput } from "../validation.js";
import type { Listing } from "../types.js";
import { listings } from "./listings.js";

// In-memory store: agent-created listings live until the server restarts.
export function getListings(): Listing[] {
  return listings;
}

export function findListing(id: string): Listing | undefined {
  return listings.find((l) => l.id === id);
}

export function addListing(input: CreateListingInput, agentId: string): Listing {
  const listing: Listing = {
    id: `lst-${randomBytes(4).toString("hex")}`,
    title: input.title,
    type: input.type,
    status: input.status,
    price: input.price,
    address: { street: "Address on request", district: input.district, city: "Berlin", postalCode: "" },
    sizeSqm: input.sizeSqm,
    rooms: input.bedrooms + 1,
    bedrooms: input.bedrooms,
    bathrooms: input.bathrooms,
    description: input.description,
    features: input.features,
    images: [],
    neighborhood: { description: "Neighbourhood details have not been added yet.", schools: [], transit: [], parks: [], shopping: [] },
    agentId,
    listedAt: new Date().toISOString(),
  };
  listings.unshift(listing);
  return listing;
}
