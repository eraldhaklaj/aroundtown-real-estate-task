import { LockIcon, Loader2Icon, RotateCcwIcon, SendIcon, SparklesIcon, SquareIcon } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { Link, useLocation } from "react-router";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/context/AuthContext";
import { ApiError, askAboutListing, type ChatTurn } from "@/lib/api";
import type { Listing } from "@/lib/types";
import { cn } from "@/lib/utils";

const MAX_CHARS = 500;
const HISTORY_PAIRS = 3; // server accepts at most 6 prior messages

const SUGGESTIONS = [
  "Is this a good home for a family with kids?",
  "How long is the commute to Alexanderplatz?",
  "What would I pay per month in total?",
  "Are pets allowed?",
];

interface ChatMessage extends ChatTurn {
  status: "streaming" | "done" | "error" | "stopped";
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
  return pairs.slice(-HISTORY_PAIRS).flat();
}

export function PropertyChat({ listing }: { listing: Listing }) {
  const { user, freeQuestionsLeft, refresh } = useAuth();
  const location = useLocation();
  const isGuest = !user;
  // Guests get one free question (enforced server-side); after that the chat asks them to sign in.
  const locked = isGuest && freeQuestionsLeft === 0;
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages]);

  // Cancel any in-flight answer when leaving the page.
  useEffect(() => () => abortRef.current?.abort(), []);

  const updateLast = (fn: (m: ChatMessage) => ChatMessage) =>
    setMessages((prev) => [...prev.slice(0, -1), fn(prev[prev.length - 1])]);

  async function ask(raw: string) {
    const question = raw.trim();
    if (!question || question.length > MAX_CHARS || streaming || locked) return;

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
      await askAboutListing(
        listing.id,
        question,
        history,
        (text) => updateLast((m) => ({ ...m, content: m.content + text })),
        controller.signal,
      );
      updateLast((m) => ({ ...m, status: "done" }));
    } catch (err) {
      if (controller.signal.aborted) {
        updateLast((m) => ({ ...m, status: "stopped" }));
      } else if (err instanceof ApiError && err.code === "login_required") {
        updateLast((m) => ({ ...m, status: "error", content: err.message }));
      } else {
        const message = err instanceof Error ? err.message : "Something went wrong.";
        updateLast((m) => ({ ...m, status: "error", content: m.content || message }));
        toast.error(message);
      }
    } finally {
      setStreaming(false);
      abortRef.current = null;
      // Sync the guest's remaining free questions with the server.
      if (isGuest) void refresh();
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

  const remaining = MAX_CHARS - input.length;

  return (
    <Card id="ask" className="flex flex-col gap-0 py-0">
      <CardHeader className="border-b py-4">
        <CardTitle className="flex items-center gap-2">
          <SparklesIcon className="size-4 text-primary" /> Ask about this property
        </CardTitle>
        <CardDescription>Answers are based on this listing's data, powered by Claude.</CardDescription>
        {messages.length > 0 && (
          <CardAction>
            <Button variant="ghost" size="icon-sm" onClick={() => setMessages([])} disabled={streaming} aria-label="Start a new conversation">
              <RotateCcwIcon />
            </Button>
          </CardAction>
        )}
      </CardHeader>

      <CardContent ref={scrollRef} className="h-[380px] space-y-3 overflow-y-auto px-4 py-4" aria-live="polite">
        {messages.length === 0 ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Try one of these, or ask your own question:</p>
            <div className="flex flex-col gap-2">
              {SUGGESTIONS.map((s) => (
                <Button key={s} variant="outline" className="h-auto justify-start py-2 text-left whitespace-normal" disabled={locked} onClick={() => void ask(s)}>
                  {s}
                </Button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((m, i) => (
            <div key={i} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
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
            </div>
          ))
        )}
      </CardContent>

      <CardFooter className="flex-col items-stretch gap-2 border-t py-3">
        {locked ? (
          <div className="space-y-3 rounded-lg bg-muted p-4 text-center">
            <p className="flex items-center justify-center gap-2 text-sm font-medium">
              <LockIcon className="size-4" /> You've used your free question
            </p>
            <p className="text-sm text-muted-foreground">Sign in to keep asking about this and every other property.</p>
            <Button asChild className="w-full">
              <Link to="/login" state={{ from: location.pathname }}>
                Sign in to continue
              </Link>
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-2">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value.slice(0, MAX_CHARS))}
              onKeyDown={handleKeyDown}
              placeholder="e.g. Is the area quiet at night?"
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
            {isGuest && freeQuestionsLeft !== null && (
              <p className="text-xs text-muted-foreground">
                Guest access: {freeQuestionsLeft} free question{freeQuestionsLeft === 1 ? "" : "s"}.{" "}
                <Link to="/login" state={{ from: location.pathname }} className="font-medium text-foreground underline underline-offset-4">
                  Sign in
                </Link>{" "}
                for unlimited questions.
              </p>
            )}
          </form>
        )}
        <p className="text-xs text-muted-foreground">AI answers can be wrong. Confirm important details with the agent.</p>
      </CardFooter>
    </Card>
  );
}
