import {
  ArrowLeftIcon,
  BikeIcon,
  CarIcon,
  GraduationCapIcon,
  MapPinIcon,
  ShoppingBagIcon,
  SparklesIcon,
  TrainFrontIcon,
  TreesIcon,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { Link, useParams } from "react-router";
import { ImageGallery } from "@/components/ImageGallery";
import { PropertyChat } from "@/components/PropertyChat";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { api, ApiError } from "@/lib/api";
import { formatEur, formatPrice, TYPE_LABELS } from "@/lib/format";
import type { Listing } from "@/lib/types";

export function ListingDetailPage() {
  const { id = "" } = useParams();
  const [listing, setListing] = useState<Listing | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setListing(null);
    setError(null);
    api
      .listing(id)
      .then(({ listing }) => setListing(listing))
      .catch((err: unknown) =>
        setError(err instanceof ApiError && (err.status === 404 || err.status === 400) ? "This listing doesn't exist." : "Couldn't load this listing."),
      );
  }, [id]);

  if (error) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center">
        <p className="mb-4 text-lg font-medium">{error}</p>
        <Button asChild variant="outline">
          <Link to="/">Back to listings</Link>
        </Button>
      </div>
    );
  }

  if (!listing) {
    return (
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-6 lg:grid-cols-[minmax(0,1fr)_400px]">
        <div className="space-y-4">
          <Skeleton className="aspect-[16/10] w-full rounded-xl" />
          <Skeleton className="h-8 w-2/3" />
          <Skeleton className="h-4 w-1/3" />
        </div>
        <Skeleton className="h-[520px] rounded-xl" />
      </div>
    );
  }

  const n = listing.neighborhood;

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <Link to="/" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeftIcon className="size-4" /> All listings
      </Link>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_400px]">
        <div className="min-w-0 space-y-8">
          <ImageGallery images={listing.images} title={listing.title} />

          <section className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <Badge className={listing.status === "rent" ? "bg-sky-600 text-white" : "bg-emerald-600 text-white"}>
                {listing.status === "rent" ? "For rent" : "For sale"}
              </Badge>
              <Badge variant="secondary">{TYPE_LABELS[listing.type]}</Badge>
              {listing.condition && <Badge variant="outline" className="capitalize">{listing.condition}</Badge>}
            </div>
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{listing.title}</h1>
            <p className="flex items-center gap-1 text-muted-foreground">
              <MapPinIcon className="size-4 shrink-0" />
              {listing.address.street}, {listing.address.postalCode} {listing.address.city} ({listing.address.district})
            </p>
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <div className="text-3xl font-semibold">{formatPrice(listing)}</div>
                {listing.monthlyCosts !== undefined && (
                  <div className="text-sm text-muted-foreground">
                    + {formatEur(listing.monthlyCosts)}/mo {listing.status === "rent" ? "Nebenkosten" : "Hausgeld"}
                  </div>
                )}
              </div>
              <Button asChild className="lg:hidden">
                <a href="#ask">
                  <SparklesIcon /> Ask the AI assistant
                </a>
              </Button>
            </div>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold">Key facts</h2>
            <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border bg-border sm:grid-cols-3">
              <Fact label="Living space" value={`${listing.sizeSqm} m²`} />
              <Fact label="Rooms" value={listing.rooms} />
              <Fact label="Bedrooms" value={listing.bedrooms} />
              <Fact label="Bathrooms" value={listing.bathrooms} />
              <Fact label="Floor" value={listing.floor !== undefined ? `${listing.floor}${listing.totalFloors ? ` of ${listing.totalFloors}` : ""}` : undefined} />
              <Fact label="Year built" value={listing.yearBuilt} />
              <Fact label="Energy rating" value={listing.energy?.rating} />
              <Fact label="Heating" value={listing.energy?.heating} />
              <Fact label="Elevator" value={listing.elevator === undefined ? undefined : listing.elevator ? "Yes" : "No"} />
              <Fact label="Parking" value={listing.parking} />
              <Fact label="Outdoor space" value={listing.outdoor} />
              <Fact label="Pets" value={listing.petPolicy} />
              <Fact label="Available from" value={listing.availableFrom} />
              {listing.deposit !== undefined && <Fact label="Deposit" value={formatEur(listing.deposit)} />}
            </dl>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold">About this home</h2>
            <p className="leading-relaxed whitespace-pre-line text-muted-foreground">{listing.description}</p>
            {listing.features.length > 0 && (
              <ul className="mt-4 flex flex-wrap gap-2">
                {listing.features.map((f) => (
                  <li key={f}>
                    <Badge variant="outline" className="font-normal">
                      {f}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="space-y-4">
            <h2 className="text-lg font-semibold">Neighbourhood</h2>
            <p className="text-muted-foreground">{n.description}</p>
            <div className="grid gap-4 sm:grid-cols-2">
              {n.commute && (
                <InfoCard icon={<TrainFrontIcon className="size-4" />} title={`Commute to ${n.commute.destination}`}>
                  <ul className="space-y-1">
                    <li className="flex items-center gap-2"><TrainFrontIcon className="size-3.5" /> {n.commute.transitMinutes} min by public transport</li>
                    <li className="flex items-center gap-2"><CarIcon className="size-3.5" /> {n.commute.carMinutes} min by car</li>
                    {n.commute.bikeMinutes !== undefined && (
                      <li className="flex items-center gap-2"><BikeIcon className="size-3.5" /> {n.commute.bikeMinutes} min by bike</li>
                    )}
                  </ul>
                </InfoCard>
              )}
              {n.transit.length > 0 && (
                <InfoCard icon={<TrainFrontIcon className="size-4" />} title="Public transport">
                  <ul className="space-y-1">
                    {n.transit.map((t) => (
                      <li key={t.line + t.stop}>
                        <span className="font-medium text-foreground">{t.line}</span> {t.stop} · {t.walkMinutes} min walk
                      </li>
                    ))}
                  </ul>
                </InfoCard>
              )}
              {n.schools.length > 0 && (
                <InfoCard icon={<GraduationCapIcon className="size-4" />} title="Schools & childcare">
                  <ul className="space-y-1">
                    {n.schools.map((s) => (
                      <li key={s.name}>
                        {s.name} <span className="text-xs">({s.type}, {s.distanceKm} km)</span>
                      </li>
                    ))}
                  </ul>
                </InfoCard>
              )}
              {(n.parks.length > 0 || n.shopping.length > 0) && (
                <InfoCard icon={<TreesIcon className="size-4" />} title="Parks & shopping">
                  <ul className="space-y-1">
                    {n.parks.map((p) => (
                      <li key={p} className="flex items-center gap-2"><TreesIcon className="size-3.5 shrink-0" /> {p}</li>
                    ))}
                    {n.shopping.map((s) => (
                      <li key={s} className="flex items-center gap-2"><ShoppingBagIcon className="size-3.5 shrink-0" /> {s}</li>
                    ))}
                  </ul>
                </InfoCard>
              )}
            </div>
          </section>
        </div>

        <aside className="lg:sticky lg:top-20 lg:self-start">
          <PropertyChat key={listing.id} listing={listing} />
        </aside>
      </div>
    </div>
  );
}

function Fact({ label, value }: { label: string; value: ReactNode }) {
  if (value === undefined || value === null || value === "") return null;
  return (
    <div className="bg-card p-3">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}

function InfoCard({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <Card size="sm" className="gap-2">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          {icon} {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground">{children}</CardContent>
    </Card>
  );
}
