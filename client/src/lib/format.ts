import type { Listing } from "./types";

const eur = new Intl.NumberFormat("en-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });

export const formatEur = (n: number) => eur.format(n);

export function formatPrice(listing: Pick<Listing, "price" | "status">) {
  return listing.status === "rent" ? `${eur.format(listing.price)}/mo` : eur.format(listing.price);
}

export const TYPE_LABELS: Record<Listing["type"], string> = {
  apartment: "Apartment",
  house: "House",
  townhouse: "Townhouse",
  penthouse: "Penthouse",
  loft: "Loft",
};
