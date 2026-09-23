import { EyeOffIcon, Loader2Icon, MessageSquareIcon, ThumbsDownIcon, ThumbsUpIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { api, type QaInsights } from "@/lib/api";
import { formatEur } from "@/lib/format";
import type { Listing } from "@/lib/types";

/** Shown only to the listing's own agent: Q&A switch, buyer question stats, and gaps the listing couldn't answer. */
export function AgentQaPanel({ listing, onQaChange }: { listing: Listing; onQaChange: (enabled: boolean) => void }) {
  const [insights, setInsights] = useState<QaInsights | null>(null);
  const [saving, setSaving] = useState(false);
  const enabled = listing.qaEnabled !== false;

  useEffect(() => {
    api.qaInsights(listing.id).then(setInsights).catch(() => toast.error("Couldn't load Q&A insights"));
  }, [listing.id]);

  async function toggle() {
    setSaving(true);
    try {
      const { qaEnabled } = await api.setQaEnabled(listing.id, !enabled);
      onQaChange(qaEnabled);
      toast.success(qaEnabled ? "AI Q&A turned on" : "AI Q&A turned off");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't update the listing");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle>Agent tools</CardTitle>
        <CardDescription>Only you see this. Your own test questions aren't counted.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <div className="flex items-center justify-between gap-3">
          <span>
            AI Q&A is <strong>{enabled ? "on" : "off"}</strong>
          </span>
          <Button size="sm" variant={enabled ? "outline" : "default"} onClick={toggle} disabled={saving}>
            {saving && <Loader2Icon className="animate-spin" />}
            {enabled ? "Turn off" : "Turn on"}
          </Button>
        </div>

        {insights && (
          <>
            <div className="flex gap-4 text-muted-foreground">
              <span className="flex items-center gap-1"><MessageSquareIcon className="size-4" /> {insights.questions} questions</span>
              <span className="flex items-center gap-1"><ThumbsUpIcon className="size-4" /> {insights.thumbsUp}</span>
              <span className="flex items-center gap-1"><ThumbsDownIcon className="size-4" /> {insights.thumbsDown}</span>
            </div>
            <div>
              <div className="mb-1 font-medium">Buyers asked, but the listing doesn't say</div>
              {insights.missingInfo.length === 0 ? (
                <p className="text-muted-foreground">Nothing yet.</p>
              ) : (
                <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
                  {insights.missingInfo.map((q) => (
                    <li key={q.askedAt + q.question}>{q.question}</li>
                  ))}
                </ul>
              )}
            </div>
            {insights.privateData && (
              <div className="rounded-md border border-dashed p-3">
                <div className="mb-1 flex items-center gap-1.5 font-medium">
                  <EyeOffIcon className="size-4" /> Private notes (never shared with buyers or the AI)
                </div>
                <p className="text-muted-foreground">
                  Seller: {insights.privateData.sellerName}, {insights.privateData.sellerPhone}
                  {insights.privateData.minimumPrice !== undefined && <> · Minimum: {formatEur(insights.privateData.minimumPrice)}</>}
                </p>
                <p className="text-muted-foreground">{insights.privateData.agentNotes}</p>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
