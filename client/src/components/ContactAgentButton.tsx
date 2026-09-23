import { MailIcon, PhoneIcon, UserRoundIcon } from "lucide-react";
import type { ComponentProps } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import type { Listing } from "@/lib/types";

// Mocked agent contact details (all demo listings belong to the same agent).
const AGENT = { name: "Alex Wagner", company: "KiezHomes Berlin", phone: "+49 30 1234 5678", email: "agent@demo.com" };

export function ContactAgentButton({ listing, label = "Contact agent", ...props }: { listing: Listing; label?: string } & ComponentProps<typeof Button>) {
  const subject = encodeURIComponent(`Viewing request: ${listing.title}`);

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" {...props}>
          <PhoneIcon /> {label}
        </Button>
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Contact the agent</SheetTitle>
          <SheetDescription>About: {listing.title}</SheetDescription>
        </SheetHeader>
        <div className="space-y-4 px-4">
          <div className="flex items-center gap-3 rounded-lg border p-3">
            <span className="flex size-10 items-center justify-center rounded-full bg-muted">
              <UserRoundIcon className="size-5" />
            </span>
            <div>
              <div className="font-medium">{AGENT.name}</div>
              <div className="text-sm text-muted-foreground">{AGENT.company}</div>
            </div>
          </div>
          <p className="text-sm text-muted-foreground">
            Ask about anything the listing doesn't cover, book a viewing, or discuss offers and next steps.
          </p>
          <div className="grid gap-2">
            <Button asChild>
              <a href={`mailto:${AGENT.email}?subject=${subject}`}>
                <MailIcon /> Email {AGENT.email}
              </a>
            </Button>
            <Button asChild variant="outline">
              <a href={`tel:${AGENT.phone.replace(/\s/g, "")}`}>
                <PhoneIcon /> Call {AGENT.phone}
              </a>
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
