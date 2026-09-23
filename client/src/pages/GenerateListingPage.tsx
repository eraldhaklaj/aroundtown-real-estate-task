import { CopyIcon, Loader2Icon, SaveIcon, WandSparklesIcon } from "lucide-react";
import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { api, type GenerateListingInput, type ListingDraft } from "@/lib/api";
import { TYPE_LABELS } from "@/lib/format";

const HIGHLIGHTS_MAX = 300;

const INITIAL: GenerateListingInput = {
  type: "apartment",
  status: "sale",
  bedrooms: 2,
  bathrooms: 1,
  sizeSqm: 75,
  district: "",
  price: 450000,
  highlights: "",
};

export function GenerateListingPage() {
  const navigate = useNavigate();
  const [details, setDetails] = useState(INITIAL);
  const [draft, setDraft] = useState<ListingDraft | null>(null);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const set = (patch: Partial<GenerateListingInput>) => setDetails((d) => ({ ...d, ...patch }));

  async function generate(e?: FormEvent) {
    e?.preventDefault();
    setGenerating(true);
    try {
      const { draft } = await api.generateListing(details);
      setDraft(draft);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Generation failed");
    } finally {
      setGenerating(false);
    }
  }

  async function save() {
    if (!draft) return;
    setSaving(true);
    try {
      const { highlights: _highlights, ...facts } = details;
      const { listing } = await api.createListing({ ...facts, ...draft });
      toast.success("Listing published");
      navigate(`/listings/${listing.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Saving failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:py-8">
      <div className="mb-6 space-y-1">
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight sm:text-3xl">
          <WandSparklesIcon className="size-6 text-primary" /> Smart listing writer
        </h1>
        <p className="text-muted-foreground">Enter the basics and Claude drafts a polished listing. Review and edit before publishing.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Property details</CardTitle>
          </CardHeader>
          <CardContent>
            <form id="details" onSubmit={generate} className="grid grid-cols-2 gap-4">
              <Field label="Type">
                <Select value={details.type} onValueChange={(type) => set({ type: type as GenerateListingInput["type"] })}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(TYPE_LABELS).map(([v, l]) => (
                      <SelectItem key={v} value={v}>{l}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Offer">
                <Select value={details.status} onValueChange={(status) => set({ status: status as GenerateListingInput["status"] })}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sale">For sale</SelectItem>
                    <SelectItem value="rent">For rent</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Bedrooms" htmlFor="bedrooms">
                <Input id="bedrooms" type="number" min={0} max={20} value={details.bedrooms} onChange={(e) => set({ bedrooms: e.target.valueAsNumber || 0 })} />
              </Field>
              <Field label="Bathrooms" htmlFor="bathrooms">
                <Input id="bathrooms" type="number" min={1} max={10} value={details.bathrooms} onChange={(e) => set({ bathrooms: e.target.valueAsNumber || 0 })} />
              </Field>
              <Field label="Size (m²)" htmlFor="size">
                <Input id="size" type="number" min={10} max={2000} value={details.sizeSqm} onChange={(e) => set({ sizeSqm: e.target.valueAsNumber || 0 })} />
              </Field>
              <Field label={details.status === "rent" ? "Cold rent (€/mo)" : "Price (€)"} htmlFor="price">
                <Input id="price" type="number" min={1} value={details.price} onChange={(e) => set({ price: e.target.valueAsNumber || 0 })} />
              </Field>
              <Field label="District" htmlFor="district" className="col-span-2">
                <Input id="district" placeholder="e.g. Prenzlauer Berg" maxLength={60} value={details.district} onChange={(e) => set({ district: e.target.value })} required />
              </Field>
              <Field label="Highlights (optional)" htmlFor="highlights" className="col-span-2">
                <Textarea
                  id="highlights"
                  rows={3}
                  maxLength={HIGHLIGHTS_MAX}
                  placeholder="e.g. south-facing balcony, renovated 2024, Altbau ceilings, quiet courtyard"
                  value={details.highlights}
                  onChange={(e) => set({ highlights: e.target.value.slice(0, HIGHLIGHTS_MAX) })}
                />
                <span className="text-right text-xs text-muted-foreground tabular-nums">
                  {details.highlights.length}/{HIGHLIGHTS_MAX}
                </span>
              </Field>
            </form>
          </CardContent>
          <CardFooter>
            <Button type="submit" form="details" className="w-full" disabled={generating || details.district.trim().length < 2}>
              {generating ? <Loader2Icon className="animate-spin" /> : <WandSparklesIcon />}
              {draft ? "Regenerate" : "Generate listing"}
            </Button>
          </CardFooter>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Draft</CardTitle>
            <CardDescription>AI-generated. Check every claim before publishing.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!draft ? (
              <div className="flex min-h-64 items-center justify-center rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                {generating ? (
                  <span className="flex items-center gap-2"><Loader2Icon className="size-4 animate-spin" /> Writing your listing…</span>
                ) : (
                  "Your generated listing will appear here."
                )}
              </div>
            ) : (
              <>
                <Field label="Title" htmlFor="title">
                  <Input id="title" maxLength={120} value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
                </Field>
                <Field label="Description" htmlFor="description">
                  <Textarea id="description" rows={10} maxLength={2000} value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
                </Field>
                <div className="flex flex-wrap gap-2">
                  {draft.features.map((f) => (
                    <Badge key={f} variant="outline" className="font-normal">{f}</Badge>
                  ))}
                </div>
              </>
            )}
          </CardContent>
          {draft && (
            <CardFooter className="gap-2">
              <Button
                variant="outline"
                onClick={() =>
                  navigator.clipboard
                    .writeText(`${draft.title}\n\n${draft.description}\n\n${draft.features.map((f) => `- ${f}`).join("\n")}`)
                    .then(() => toast.success("Copied to clipboard"))
                    .catch(() => toast.error("Couldn't copy"))
                }
              >
                <CopyIcon /> Copy
              </Button>
              <Button className="flex-1" onClick={save} disabled={saving || !draft.title.trim() || !draft.description.trim()}>
                {saving ? <Loader2Icon className="animate-spin" /> : <SaveIcon />} Publish listing
              </Button>
            </CardFooter>
          )}
        </Card>
      </div>
    </div>
  );
}

function Field({ label, htmlFor, className, children }: { label: string; htmlFor?: string; className?: string; children: React.ReactNode }) {
  return (
    <div className={`flex flex-col gap-2 ${className ?? ""}`}>
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
    </div>
  );
}
