"use client";

import { Layers, Loader2, Play, Sparkles, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { deleteFlashcard, generateFlashcards } from "@/app/actions/flashcards";
import { FilePicker, type PickableFile } from "@/components/material/file-picker";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useLocale, useT } from "@/lib/i18n/client";
import { ReviewSession, type ReviewCard } from "./review-session";

type ListCard = ReviewCard & { dueAt: string; interval: number };

export function FlashcardsView({
  courseId,
  stats,
  files,
  due,
  cards,
}: {
  courseId: string;
  stats: { total: number; due: number; mastered: number };
  files: PickableFile[];
  due: ReviewCard[];
  cards: ListCard[];
}) {
  const t = useT();
  const router = useRouter();
  const [reviewing, setReviewing] = useState(false);

  if (reviewing) {
    return (
      <ReviewSession
        cards={due}
        onExit={() => {
          setReviewing(false);
          router.refresh();
        }}
      />
    );
  }

  return (
    <div className="space-y-6">
      <dl className="grid grid-cols-3 gap-3">
        <Stat label={t("flash.due")} value={stats.due} highlight />
        <Stat label={t("flash.total")} value={stats.total} />
        <Stat label={t("flash.mastered")} value={stats.mastered} />
      </dl>

      {stats.total === 0 ? (
        <div className="flex flex-col items-center rounded-2xl border border-dashed px-6 py-12 text-center">
          <div className="mb-4 grid size-14 place-items-center rounded-2xl bg-secondary text-secondary-foreground">
            <Layers className="size-7" />
          </div>
          <p className="text-lg font-semibold">{t("flash.empty.title")}</p>
          <p className="mt-1 mb-6 max-w-sm text-sm text-muted-foreground">{t("flash.empty.body")}</p>
          {files.length > 0 ? (
            <GenerateDialog courseId={courseId} files={files} />
          ) : (
            <Button asChild className="rounded-full">
              <Link href={`/courses/${courseId}`}>{t("material.upload.title")}</Link>
            </Button>
          )}
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            {stats.due > 0 ? (
              <Button size="lg" className="rounded-full" onClick={() => setReviewing(true)}>
                <Play className="fill-current" /> {t("flash.start")} ({stats.due})
              </Button>
            ) : (
              <div className="rounded-2xl bg-secondary px-4 py-3 text-sm text-secondary-foreground">
                <span className="font-semibold">{t("flash.allDone.title")}.</span> {t("flash.allDone.body")}
              </div>
            )}
            <div className="ml-auto">{files.length > 0 && <GenerateDialog courseId={courseId} files={files} variant="outline" />}</div>
          </div>
          <CardList cards={cards} />
        </>
      )}
    </div>
  );
}

function Stat({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) {
  return (
    <div className={highlight ? "rounded-2xl bg-primary p-4 text-primary-foreground" : "rounded-2xl border bg-card p-4"}>
      <dt className={highlight ? "text-sm opacity-85" : "text-sm text-muted-foreground"}>{label}</dt>
      <dd className="mt-1 font-heading text-3xl font-semibold">{value}</dd>
    </div>
  );
}

function GenerateDialog({
  courseId,
  files,
  variant = "default",
}: {
  courseId: string;
  files: PickableFile[];
  variant?: "default" | "outline";
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [fileIds, setFileIds] = useState<string[]>([]);
  const [count, setCount] = useState(15);
  const [pending, startTransition] = useTransition();

  return (
    <Dialog open={open} onOpenChange={(o) => !pending && setOpen(o)}>
      <DialogTrigger asChild>
        <Button variant={variant} className="rounded-full">
          <Sparkles /> {t("flash.generate")}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("flash.generate.title")}</DialogTitle>
        </DialogHeader>
        <form
          className="space-y-5"
          onSubmit={(e) => {
            e.preventDefault();
            startTransition(async () => {
              const res = await generateFlashcards({ courseId, fileIds, count });
              if (res.ok) setOpen(false);
              else toast.error(res.error === "no_material" ? t("material.empty.body") : t("common.error"));
            });
          }}
        >
          <FilePicker files={files} value={fileIds} onChange={setFileIds} label={t("quiz.new.files")} />
          <div>
            <div className="mb-2 flex items-center justify-between">
              <Label htmlFor="card-count">{t("flash.generate.count")}</Label>
              <span className="text-sm font-semibold tabular-nums">{count}</span>
            </div>
            <input
              id="card-count"
              type="range"
              min={5}
              max={40}
              step={5}
              value={count}
              onChange={(e) => setCount(Number(e.target.value))}
              className="w-full accent-[var(--primary)]"
            />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={pending} className="rounded-full">
              {pending ? <Loader2 className="animate-spin" /> : <Sparkles />}
              {pending ? t("flash.generating") : t("flash.generate")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function CardList({ cards }: { cards: ListCard[] }) {
  const t = useT();
  const locale = useLocale();
  const fmt = new Intl.DateTimeFormat(locale, { day: "numeric", month: "short" });
  return (
    <section>
      <h2 className="mb-3 font-sans text-sm font-semibold tracking-normal text-muted-foreground uppercase">
        {t("flash.list")}
      </h2>
      <ul className="grid gap-2 sm:grid-cols-2">
        {cards.map((c) => (
          <CardRow key={c.id} card={c} due={t("flash.nextDue", { date: fmt.format(new Date(c.dueAt)) })} />
        ))}
      </ul>
    </section>
  );
}

function CardRow({ card, due }: { card: ListCard; due: string }) {
  const t = useT();
  const [pending, startTransition] = useTransition();
  return (
    <li className="group flex gap-3 rounded-xl border bg-card p-3 text-sm" aria-busy={pending}>
      <div className="min-w-0 flex-1">
        <p className="font-medium">{card.front}</p>
        <p className="mt-0.5 line-clamp-2 text-muted-foreground">{card.back}</p>
        <p className="mt-1.5 text-xs text-muted-foreground">
          {card.topic && <span>{card.topic} · </span>}
          {due}
        </p>
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="size-8 shrink-0 text-muted-foreground opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100"
        aria-label={t("flash.delete")}
        disabled={pending}
        onClick={() => startTransition(() => deleteFlashcard(card.id))}
      >
        {pending ? <Loader2 className="animate-spin" /> : <Trash2 />}
      </Button>
    </li>
  );
}
