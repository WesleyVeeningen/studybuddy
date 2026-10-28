"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { ArrowUp, Baby, FileText, Lightbulb, ListChecks, MessageCircle, RotateCcw, Square } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { useT } from "@/lib/i18n/client";
import type { ChatMetadata, ChatSource, ExplainMode } from "@/lib/tutor";
import { cn } from "@/lib/utils";

type TutorMessage = UIMessage<ChatMetadata>;

const storageKey = (courseId: string) => `sb-chat-${courseId}`;

export function TutorChat({ courseId, hasMaterial }: { courseId: string; hasMaterial: boolean }) {
  const t = useT();
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const transport = useMemo(
    () => new DefaultChatTransport<TutorMessage>({ api: "/api/chat", body: { courseId } }),
    [courseId],
  );
  const { messages, sendMessage, status, stop, error, regenerate, setMessages } = useChat<TutorMessage>({
    id: courseId,
    transport,
  });

  // Restore and persist the conversation per course (this device only).
  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey(courseId));
      if (saved) setMessages(JSON.parse(saved));
    } catch {}
  }, [courseId, setMessages]);
  useEffect(() => {
    if (status !== "ready") return;
    try {
      if (messages.length) localStorage.setItem(storageKey(courseId), JSON.stringify(messages.slice(-40)));
      else localStorage.removeItem(storageKey(courseId));
    } catch {}
  }, [messages, status, courseId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, status]);

  const busy = status === "submitted" || status === "streaming";

  function send(text: string, mode?: ExplainMode) {
    if (!text.trim() || busy) return;
    void sendMessage({ text: text.trim(), metadata: mode ? { mode } : undefined }, { body: { mode } });
    setInput("");
  }

  const modes: { mode: ExplainMode; label: string; prompt: string; icon: typeof Baby }[] = [
    { mode: "eli12", label: t("chat.mode.eli12"), prompt: t("chat.mode.eli12.prompt"), icon: Baby },
    { mode: "example", label: t("chat.mode.example"), prompt: t("chat.mode.example.prompt"), icon: Lightbulb },
    { mode: "quiz", label: t("chat.mode.quiz"), prompt: t("chat.mode.quiz.prompt"), icon: ListChecks },
  ];

  const lastAssistantId = messages.findLast((m) => m.role === "assistant")?.id;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col">
      <div className="flex-1 space-y-6 pb-4" aria-live="polite">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center py-12 text-center">
            <div className="mb-4 grid size-14 place-items-center rounded-2xl bg-secondary text-secondary-foreground">
              <MessageCircle className="size-7" />
            </div>
            <h2 className="text-xl font-semibold">{t("chat.empty.title")}</h2>
            <p className="mt-1 max-w-sm text-muted-foreground">
              {hasMaterial ? t("chat.empty.body") : t("chat.noMaterial")}
            </p>
            {hasMaterial ? (
              <div className="mt-6 flex flex-wrap justify-center gap-2">
                {(["chat.suggest.1", "chat.suggest.2", "chat.suggest.3"] as const).map((k) => (
                  <Button key={k} variant="outline" size="sm" className="rounded-full" onClick={() => send(t(k))}>
                    {t(k)}
                  </Button>
                ))}
              </div>
            ) : (
              <Button asChild className="mt-6 rounded-full">
                <Link href={`/courses/${courseId}`}>{t("material.upload.title")}</Link>
              </Button>
            )}
          </div>
        ) : (
          messages.map((m) => (
            <MessageBubble
              key={m.id}
              message={m}
              streaming={busy && m.id === lastAssistantId}
              footer={
                m.id === lastAssistantId && status === "ready" ? (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {modes.map(({ mode, label, prompt, icon: Icon }) => (
                      <Button
                        key={mode}
                        variant="secondary"
                        size="sm"
                        className="h-8 rounded-full text-xs"
                        onClick={() => send(prompt, mode)}
                      >
                        <Icon className="size-3.5" /> {label}
                      </Button>
                    ))}
                  </div>
                ) : null
              }
            />
          ))
        )}

        {status === "submitted" && <TypingIndicator />}

        {error && (
          <div className="flex items-center gap-3 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm">
            <span className="flex-1">{t("chat.error")}</span>
            <Button size="sm" variant="outline" onClick={() => regenerate()}>
              <RotateCcw /> {t("chat.retry")}
            </Button>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <form
        className="sticky bottom-0 -mx-4 bg-gradient-to-t from-background via-background to-background/0 px-4 pt-6 pb-4 sm:mx-0 sm:px-0"
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
      >
        <div className="flex items-end gap-2 rounded-2xl border bg-card p-2 shadow-sm focus-within:ring-2 focus-within:ring-ring/50">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                send(input);
              }
            }}
            placeholder={t("chat.placeholder")}
            aria-label={t("chat.placeholder")}
            rows={1}
            disabled={!hasMaterial}
            className="max-h-40 min-h-10 resize-none border-0 bg-transparent shadow-none focus-visible:ring-0 dark:bg-transparent"
          />
          {busy ? (
            <Button type="button" size="icon" variant="secondary" onClick={() => stop()} aria-label={t("chat.stop")}>
              <Square className="size-3.5 fill-current" />
            </Button>
          ) : (
            <Button type="submit" size="icon" disabled={!input.trim() || !hasMaterial} aria-label={t("chat.send")}>
              <ArrowUp />
            </Button>
          )}
        </div>
        {messages.length > 0 && (
          <div className="mt-2 flex justify-end">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 text-xs text-muted-foreground"
              onClick={() => setMessages([])}
              disabled={busy}
            >
              <RotateCcw className="size-3" /> {t("chat.clear")}
            </Button>
          </div>
        )}
      </form>
    </div>
  );
}

function MessageBubble({
  message,
  streaming,
  footer,
}: {
  message: TutorMessage;
  streaming: boolean;
  footer: React.ReactNode;
}) {
  const t = useT();
  const text = message.parts.map((p) => (p.type === "text" ? p.text : "")).join("");
  const sources = message.metadata?.sources ?? [];

  if (message.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-2xl rounded-br-md bg-primary px-4 py-2.5 whitespace-pre-wrap text-primary-foreground">
          {text}
        </div>
      </div>
    );
  }

  // Only show sources that the answer actually cites.
  const cited = new Set(Array.from(text.matchAll(/\[(\d{1,2})\]/g), (m) => Number(m[1])));
  const usedSources = sources.filter((s) => cited.has(s.id));

  return (
    <div className="max-w-full">
      <div className={cn("prose-tutor", streaming && "after:ml-0.5 after:animate-pulse after:content-['▍']")}>
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            a: ({ href, children }) => {
              const id = href?.startsWith("#cite-") ? Number(href.slice(6)) : null;
              const source = id ? sources.find((s) => s.id === id) : undefined;
              if (id && source) return <Citation source={source} />;
              if (id) return <sup className="text-muted-foreground">[{id}]</sup>;
              return (
                <a href={href} target="_blank" rel="noreferrer" className="underline underline-offset-2">
                  {children}
                </a>
              );
            },
          }}
        >
          {text.replace(/\[(\d{1,2})\](?!\()/g, "[$1](#cite-$1)")}
        </ReactMarkdown>
      </div>
      {!streaming && usedSources.length > 0 && (
        <div className="mt-3 rounded-xl border bg-muted/40 px-3 py-2">
          <p className="mb-1 text-xs font-medium text-muted-foreground">{t("chat.sources")}</p>
          <ul className="space-y-0.5 text-xs">
            {usedSources.map((s) => (
              <li key={s.id} className="flex items-center gap-1.5">
                <span className="grid size-4 shrink-0 place-items-center rounded bg-primary/15 text-[10px] font-semibold text-primary">
                  {s.id}
                </span>
                <FileText className="size-3 shrink-0 text-muted-foreground" />
                <span className="truncate">{s.fileName}</span>
                <span className="shrink-0 text-muted-foreground">· {s.location}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {footer}
    </div>
  );
}

function Citation({ source }: { source: ChatSource }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="mx-0.5 inline-grid h-4.5 min-w-4.5 translate-y-[-1px] place-items-center rounded bg-primary/15 px-1 align-middle text-[10px] font-semibold text-primary hover:bg-primary/25"
          aria-label={`${source.fileName}, ${source.location}`}
        >
          {source.id}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80 text-sm" side="top">
        <p className="font-medium">{source.fileName}</p>
        <p className="mb-2 text-xs text-muted-foreground">{source.location}</p>
        <p className="line-clamp-6 text-muted-foreground">{source.excerpt}…</p>
      </PopoverContent>
    </Popover>
  );
}

function TypingIndicator() {
  return (
    <div className="flex gap-1 py-2" aria-label="…">
      {[0, 150, 300].map((d) => (
        <span
          key={d}
          className="size-2 animate-bounce rounded-full bg-muted-foreground/50"
          style={{ animationDelay: `${d}ms` }}
        />
      ))}
    </div>
  );
}
