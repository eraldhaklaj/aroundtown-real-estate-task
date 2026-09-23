import { SearchIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ListingCard } from "@/components/ListingCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import { TYPE_LABELS } from "@/lib/format";
import type { Listing } from "@/lib/types";

type Sort = "newest" | "price-asc" | "price-desc" | "size-desc";

const DEFAULT_FILTERS = { query: "", status: "all", type: "all", minBeds: "0", sort: "newest" as Sort };

export function ListingsPage() {
  const [listings, setListings] = useState<Listing[] | null>(null);
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const set = (patch: Partial<typeof DEFAULT_FILTERS>) => setFilters((f) => ({ ...f, ...patch }));

  useEffect(() => {
    api
      .listings()
      .then(({ listings }) => setListings(listings))
      .catch((err: Error) => {
        toast.error(err.message);
        setListings([]);
      });
  }, []);

  const visible = useMemo(() => {
    if (!listings) return [];
    const q = filters.query.trim().toLowerCase();
    const result = listings.filter(
      (l) =>
        (!q || `${l.title} ${l.address.district} ${l.address.street} ${l.address.city}`.toLowerCase().includes(q)) &&
        (filters.status === "all" || l.status === filters.status) &&
        (filters.type === "all" || l.type === filters.type) &&
        l.bedrooms >= Number(filters.minBeds),
    );
    const sorters: Record<Sort, (a: Listing, b: Listing) => number> = {
      newest: (a, b) => b.listedAt.localeCompare(a.listedAt),
      "price-asc": (a, b) => a.price - b.price,
      "price-desc": (a, b) => b.price - a.price,
      "size-desc": (a, b) => b.sizeSqm - a.sizeSqm,
    };
    return [...result].sort(sorters[filters.sort]);
  }, [listings, filters]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:py-8">
      <div className="mb-6 space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Homes in Berlin</h1>
        <p className="text-muted-foreground">Open any listing and ask the AI assistant about it: commute, costs, family fit, and more.</p>
      </div>

      <div className="mb-6 grid gap-2 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_repeat(4,auto)]">
        <div className="relative sm:col-span-2 lg:col-span-1">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by district, street or title"
            value={filters.query}
            onChange={(e) => set({ query: e.target.value })}
            maxLength={100}
            className="pl-8"
            aria-label="Search listings"
          />
        </div>
        <Select value={filters.status} onValueChange={(status) => set({ status })}>
          <SelectTrigger className="w-full lg:w-32" aria-label="Buy or rent">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Buy or rent</SelectItem>
            <SelectItem value="sale">For sale</SelectItem>
            <SelectItem value="rent">For rent</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filters.type} onValueChange={(type) => set({ type })}>
          <SelectTrigger className="w-full lg:w-36" aria-label="Property type">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Any type</SelectItem>
            {Object.entries(TYPE_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filters.minBeds} onValueChange={(minBeds) => set({ minBeds })}>
          <SelectTrigger className="w-full lg:w-32" aria-label="Minimum bedrooms">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="0">Any beds</SelectItem>
            {[1, 2, 3, 4].map((n) => (
              <SelectItem key={n} value={String(n)}>
                {n}+ beds
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filters.sort} onValueChange={(sort) => set({ sort: sort as Sort })}>
          <SelectTrigger className="w-full lg:w-40" aria-label="Sort by">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="newest">Newest first</SelectItem>
            <SelectItem value="price-asc">Price: low to high</SelectItem>
            <SelectItem value="price-desc">Price: high to low</SelectItem>
            <SelectItem value="size-desc">Largest first</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {listings === null ? (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="space-y-3">
              <Skeleton className="aspect-[4/3] w-full rounded-xl" />
              <Skeleton className="h-5 w-1/3" />
              <Skeleton className="h-4 w-2/3" />
            </div>
          ))}
        </div>
      ) : visible.length === 0 ? (
        <div className="rounded-xl border border-dashed p-10 text-center">
          <p className="font-medium">No listings match your filters.</p>
          <Button variant="link" onClick={() => setFilters(DEFAULT_FILTERS)}>
            Clear filters
          </Button>
        </div>
      ) : (
        <>
          <p className="mb-3 text-sm text-muted-foreground">
            {visible.length} {visible.length === 1 ? "listing" : "listings"}
          </p>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {visible.map((l) => (
              <ListingCard key={l.id} listing={l} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
