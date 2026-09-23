import { BathIcon, BedDoubleIcon, MapPinIcon, RulerIcon } from "lucide-react";
import { Link } from "react-router";
import { ImageWithFallback } from "@/components/ImageWithFallback";
import { Badge } from "@/components/ui/badge";
import { formatPrice, TYPE_LABELS } from "@/lib/format";
import type { Listing } from "@/lib/types";

export function ListingCard({ listing }: { listing: Listing }) {
  return (
    <Link
      to={`/listings/${listing.id}`}
      className="group overflow-hidden rounded-xl border bg-card shadow-xs transition-shadow hover:shadow-md focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-muted">
        <ImageWithFallback
          src={listing.images[0]}
          alt={listing.title}
          className="size-full object-cover transition-transform duration-300 group-hover:scale-105"
        />
        <div className="absolute top-3 left-3 flex gap-1.5">
          <Badge className={listing.status === "rent" ? "bg-sky-600 text-white" : "bg-emerald-600 text-white"}>
            {listing.status === "rent" ? "For rent" : "For sale"}
          </Badge>
          <Badge variant="secondary">{TYPE_LABELS[listing.type]}</Badge>
        </div>
      </div>
      <div className="space-y-2 p-4">
        <div className="text-lg font-semibold">{formatPrice(listing)}</div>
        <h3 className="line-clamp-1 font-medium">{listing.title}</h3>
        <p className="flex items-center gap-1 text-sm text-muted-foreground">
          <MapPinIcon className="size-3.5 shrink-0" />
          <span className="line-clamp-1">
            {listing.address.district}, {listing.address.city}
          </span>
        </p>
        <div className="flex flex-wrap gap-x-4 gap-y-1 pt-1 text-sm text-muted-foreground">
          <span className="flex items-center gap-1">
            <BedDoubleIcon className="size-4" /> {listing.bedrooms} bd
          </span>
          <span className="flex items-center gap-1">
            <BathIcon className="size-4" /> {listing.bathrooms} ba
          </span>
          <span className="flex items-center gap-1">
            <RulerIcon className="size-4" /> {listing.sizeSqm} m²
          </span>
        </div>
      </div>
    </Link>
  );
}
