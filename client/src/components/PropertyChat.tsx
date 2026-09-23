import {
  Loader2Icon,
  MessageSquareOffIcon,
  RotateCcwIcon,
  SendIcon,
  SparklesIcon,
  SquareIcon,
  ThumbsDownIcon,
  ThumbsUpIcon,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { Link, useLocation } from "react-router";
import { toast } from "sonner";
import { ContactAgentButton } from "@/components/ContactAgentButton";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/context/AuthContext";
import { api, ApiError, askAboutListing, type ChatTurn, type QaStatus } from "@/lib/api";
import type { Listing } from "@/lib/types";
import { cn } from "@/lib/utils";

const MAX_CHARS = 500;
const MAX_TURNS = 20; // questions per chat before we suggest starting over or contacting the agent
const HISTORY_TURNS = 4; // question/answer pairs sent back as context

const SUGGESTIONS = [
  "What are the total monthly costs?",
  "How far is the nearest U-Bahn or S-Bahn?",
  "Are pets allowed?",
  "How do I book a viewing?",
];

interface ChatMessage extends ChatTurn {
  status: "streaming" | "done" | "error" | "stopped";
  answerId?: string;
  rating?: "up" | "down";
}

interface Notice {
  code: string;
  message: string;
}

/** Only fully answered question/answer pairs are sent back as context. */
function buildHistory(messages: ChatMessage[]): ChatTurn[] {
  const pairs: ChatTurn[][] = [];
  for (let i = 0; i + 1 < messages.length; i++) {
    const [q, a] = [messages[i], messages[i + 1]];
    if (q.role === "user" && a.role === "assistant" && a.status === "done" && a.content.trim()) {
      pairs.push([
        { role: "user", content: q.content },
        { role: "assistant", content: a.content.slice(0, 2000) },
      ]);
      i++;
    }
  }
  return pairs.slice(-HISTORY_TURNS).flat();
}

export function PropertyChat({ listing }: { listing: Listing }) {
  const { user } = useAuth();
  const location = useLocation();
  const [status, setStatus] = useState<QaStatus | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const loadStatus = useCallback(() => {
    api.qaStatus(listing.id).then(setStatus).catch(() => undefined);
  }, [listing.id]);

  // Reload when the listing or the signed-in user changes (limits differ for guests and users).
  useEffect(() => {
    loadStatus();
    setNotice(null);
  }, [loadStatus, user?.id]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages]);

  // Cancel any in-flight answer when leaving the page.
  useEffect(() => () => abortRef.current?.abort(), []);

  // A per-minute limit clears by itself.
  useEffect(() => {
    if (notice?.code !== "rate_limited" && notice?.code !== "busy") return;
    const timer = setTimeout(() => setNotice(null), 10_000);
    return () => clearTimeout(timer);
  }, [notice]);

  const questionsAsked = messages.filter((m) => m.role === "user").length;
  const threadFull = questionsAsked >= MAX_TURNS;
  const guestOut = !user && status?.remaining != null && (status.remaining.forListing === 0 || status.remaining.today === 0);
  const blockingNotice: Notice | null =
    notice ??
    (status && !status.available ? { code: "unavailable", message: "The AI assistant is paused for today. Please contact the agent directly." } : null) ??
    (guestOut ? { code: "login_required", message: "You've used your free questions. Sign in to keep asking, or contact the agent." } : null);

  const updateLast = (fn: (m: ChatMessage) => ChatMessage) =>
    setMessages((prev) => [...prev.slice(0, -1), fn(prev[prev.length - 1])]);

  async function ask(raw: string) {
    const question = raw.trim();
    if (!question || question.length > MAX_CHARS || streaming || threadFull || blockingNotice) return;

    const history = buildHistory(messages);
    setMessages((prev) => [
      ...prev,
      { role: "user", content: question, status: "done" },
      { role: "assistant", content: "", status: "streaming" },
    ]);
    setInput("");
    setStreaming(true);

    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const { answerId } = await askAboutListing(
        listing.id,
        question,
        history,
        (text) => updateLast((m) => ({ ...m, content: m.content + text })),
        controller.signal,
      );
      updateLast((m) => ({ ...m, status: "done", answerId: answerId ?? undefined }));
    } catch (err) {
      if (controller.signal.aborted) {
        updateLast((m) => ({ ...m, status: "stopped" }));
      } else if (err instanceof ApiError && err.code) {
        // A limit or availability rule: take the question back out and explain instead of showing an error.
        setMessages((prev) => prev.slice(0, -2));
        setInput(question);
        setNotice({ code: err.code, message: err.message });
      } else {
        const message = err instanceof Error ? err.message : "Something went wrong.";
        updateLast((m) => ({ ...m, status: "error", content: m.content || message }));
      }
    } finally {
      setStreaming(false);
      abortRef.current = null;
      loadStatus();
    }
  }

  async function rate(index: number, rating: "up" | "down") {
    const answerId = messages[index]?.answerId;
    if (!answerId) return;
    setMessages((prev) => prev.map((m, i) => (i === index ? { ...m, rating } : m)));
    try {
      await api.rateAnswer(answerId, rating);
    } catch {
      toast.error("Couldn't save your feedback.");
    }
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    void ask(input);
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void ask(input);
    }
  }

  function newChat() {
    setMessages([]);
    if (notice?.code !== "login_required") setNotice(null);
  }

  if (status && !status.qaEnabled) {
    return (
      <Card id="ask">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquareOffIcon className="size-4" /> AI questions are off
          </CardTitle>
          <CardDescription>The agent has turned off the AI assistant for this listing.</CardDescription>
        </CardHeader>
        <CardFooter>
          <ContactAgentButton listing={listing} className="w-full" label="Ask the agent directly" />
        </CardFooter>
      </Card>
    );
  }

  const remaining = MAX_CHARS - input.length;

  return (
    <Card id="ask" className="flex flex-col gap-0 py-0">
      <CardHeader className="border-b py-4">
        <CardTitle className="flex items-center gap-2">
          <SparklesIcon className="size-4 text-primary" /> Ask about this property
        </CardTitle>
        <CardDescription>AI answers based only on this listing's details.</CardDescription>
        <CardAction className="flex items-center gap-1">
          {messages.length > 0 && (
            <Button variant="ghost" size="icon-sm" onClick={newChat} disabled={streaming} aria-label="Start a new chat">
              <RotateCcwIcon />
            </Button>
          )}
          <ContactAgentButton listing={listing} size="sm" label="Agent" aria-label="Contact agent" />
        </CardAction>
      </CardHeader>

      <CardContent ref={scrollRef} className="h-[360px] space-y-3 overflow-y-auto px-4 py-4" aria-live="polite">
        {messages.length === 0 ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Try one of these, or ask your own question:</p>
            <div className="flex flex-col gap-2">
              {SUGGESTIONS.map((s) => (
                <Button
                  key={s}
                  variant="outline"
                  className="h-auto justify-start py-2 text-left whitespace-normal"
                  disabled={!!blockingNotice}
                  onClick={() => void ask(s)}
                >
                  {s}
                </Button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((m, i) => (
            <div key={i} className={cn("flex flex-col", m.role === "user" ? "items-end" : "items-start")}>
              <div
                className={cn(
                  // Plain text only: model output is never rendered as HTML.
                  "max-w-[85%] rounded-2xl px-3.5 py-2 text-sm whitespace-pre-wrap break-words",
                  m.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted",
                  m.status === "error" && "border border-destructive/40 bg-destructive/10 text-destructive",
                )}
              >
                {m.content}
                {m.status === "streaming" && !m.content && (
                  <span className="inline-flex items-center gap-2 text-muted-foreground">
                    <Loader2Icon className="size-3.5 animate-spin" /> Thinking…
                  </span>
                )}
                {m.status === "stopped" && <span className="block pt-1 text-xs text-muted-foreground italic">Stopped</span>}
              </div>
              {m.role === "assistant" && m.answerId && (
                <div className="mt-1 flex gap-1" role="group" aria-label="Rate this answer">
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    aria-label="Helpful"
                    aria-pressed={m.rating === "up"}
                    className={cn(m.rating === "up" && "text-emerald-600")}
                    onClick={() => void rate(i, "up")}
                  >
                    <ThumbsUpIcon />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    aria-label="Not helpful"
                    aria-pressed={m.rating === "down"}
                    className={cn(m.rating === "down" && "text-destructive")}
                    onClick={() => void rate(i, "down")}
                  >
                    <ThumbsDownIcon />
                  </Button>
                </div>
              )}
            </div>
          ))
        )}
      </CardContent>

      <CardFooter className="flex-col items-stretch gap-2 border-t py-3">
        {blockingNotice ? (
          <div className="space-y-3 rounded-lg bg-muted p-4 text-center">
            <p className="text-sm font-medium">{blockingNotice.message}</p>
            <div className="flex flex-wrap justify-center gap-2">
              {blockingNotice.code === "login_required" && (
                <Button asChild size="sm">
                  <Link to="/login" state={{ from: location.pathname }}>
                    Sign in to keep asking
                  </Link>
                </Button>
              )}
              <ContactAgentButton listing={listing} size="sm" />
            </div>
          </div>
        ) : threadFull ? (
          <div className="space-y-3 rounded-lg bg-muted p-4 text-center">
            <p className="text-sm font-medium">This chat has reached {MAX_TURNS} questions.</p>
            <div className="flex flex-wrap justify-center gap-2">
              <Button size="sm" onClick={newChat}>
                <RotateCcwIcon /> Start new chat
              </Button>
              <ContactAgentButton listing={listing} size="sm" />
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-2">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value.slice(0, MAX_CHARS))}
              onKeyDown={handleKeyDown}
              placeholder="e.g. Which floor is it on?"
              maxLength={MAX_CHARS}
              rows={2}
              className="max-h-32 resize-none"
              aria-label="Your question"
            />
            <div className="flex items-center justify-between gap-2">
              <span className={cn("text-xs text-muted-foreground tabular-nums", remaining < 50 && "text-amber-600")}>
                {input.length}/{MAX_CHARS}
              </span>
              {streaming ? (
                <Button type="button" variant="outline" size="sm" onClick={() => abortRef.current?.abort()}>
                  <SquareIcon /> Stop
                </Button>
              ) : (
                <Button type="submit" size="sm" disabled={!input.trim()}>
                  <SendIcon /> Ask
                </Button>
              )}
            </div>
            {!user && status?.remaining && (
              <p className="text-xs text-muted-foreground">
                Guest: {status.remaining.forListing} of {status.remaining.perListingLimit} free questions left for this property.{" "}
                <Link to="/login" state={{ from: location.pathname }} className="font-medium text-foreground underline underline-offset-4">
                  Sign in
                </Link>{" "}
                for more.
              </p>
            )}
          </form>
        )}
        <p className="text-xs text-muted-foreground">
          AI answers can be wrong; confirm important details with the agent. Questions are kept for {status?.retentionDays ?? 90} days and
          shared with the listing agent, so please don't include personal details.
        </p>
      </CardFooter>
    </Card>
  );
}
