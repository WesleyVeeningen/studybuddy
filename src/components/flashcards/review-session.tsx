"use client";

import { PartyPopper, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { reviewFlashcard } from "@/app/actions/flashcards";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useT } from "@/lib/i18n/client";
import type { GradeName } from "@/lib/sm2";
import { cn } from "@/lib/utils";

export type ReviewCard = { id: string; front: string; back: string; topic: string | null };

const BUTTONS: { grade: GradeName; key: string; className: string }[] = [
  { grade: "again", key: "1", className: "border-destructive/40 hover:bg-destructive/10" },
  { grade: "hard", key: "2", className: "border-warning/50 hover:bg-warning/15" },
  { grade: "good", key: "3", className: "border-primary/40 hover:bg-accent" },
  { grade: "easy", key: "4", className: "border-success/40 hover:bg-success/10" },
];

export function ReviewSession({ cards, onExit }: { cards: ReviewCard[]; onExit: () => void }) {
  const t = useT();
  const [queue, setQueue] = useState(cards);
  const [flipped, setFlipped] = useState(false);
  const [completed, setCompleted] = useState(0);
  const card = queue[0];
  const total = completed + queue.length;

  const grade = useCallback(
    (g: GradeName) => {
      if (!card || !flipped) return;
      // Optimistic: move on immediately, save in the background.
      reviewFlashcard({ cardId: card.id, grade: g }).catch(() => toast.error(t("common.error")));
      setFlipped(false);
      setQueue((q) => (g === "again" ? [...q.slice(1), q[0]] : q.slice(1)));
      if (g !== "again") setCompleted((c) => c + 1);
    },
    [card, flipped, t],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLElement && e.target.closest("input, textarea")) return;
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        setFlipped(true);
      }
      const b = BUTTONS.find((x) => x.key === e.key);
      if (b) grade(b.grade);
      if (e.key === "Escape") onExit();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [grade, onExit]);

  if (!card) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center py-12 text-center">
        <div className="mb-4 grid size-16 place-items-center rounded-2xl bg-secondary text-secondary-foreground">
          <PartyPopper className="size-8" />
        </div>
        <h2 className="text-2xl font-semibold">{t("flash.allDone.title")}</h2>
        <p className="mt-1.5 mb-6 text-muted-foreground">{t("flash.allDone.body")}</p>
        <Button className="rounded-full" onClick={onExit}>
          {t("course.tabs.flashcards")}
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-xl">
      <div className="mb-4 flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onExit} aria-label={t("common.cancel")}>
          <X />
        </Button>
        <Progress value={(completed / total) * 100} className="h-1.5 flex-1" />
        <span className="text-sm text-muted-foreground tabular-nums">{t("flash.remaining", { count: queue.length })}</span>
      </div>

      <button
        type="button"
        onClick={() => setFlipped((f) => !f)}
        className="group block w-full [perspective:1200px] outline-none"
        aria-label={flipped ? card.back : card.front}
      >
        <div
          className={cn(
            "relative min-h-72 w-full transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] [transform-style:preserve-3d] motion-reduce:transition-none",
            flipped && "[transform:rotateY(180deg)]",
          )}
        >
          <Face>
            {card.topic && <span className="mb-3 text-xs font-medium tracking-wide text-muted-foreground uppercase">{card.topic}</span>}
            <p className="font-heading text-2xl font-medium text-balance">{card.front}</p>
            <span className="mt-6 text-xs text-muted-foreground">{t("flash.show")} · Space</span>
          </Face>
          <Face back>
            <p className="mb-4 text-sm text-muted-foreground">{card.front}</p>
            <p className="text-lg text-pretty">{card.back}</p>
          </Face>
        </div>
      </button>

      <div className={cn("mt-5 grid grid-cols-4 gap-2 transition-opacity", !flipped && "pointer-events-none opacity-0")} aria-hidden={!flipped}>
        {BUTTONS.map((b) => (
          <Button
            key={b.grade}
            variant="outline"
            className={cn("h-auto flex-col gap-0 rounded-xl py-2.5", b.className)}
            onClick={() => grade(b.grade)}
            tabIndex={flipped ? 0 : -1}
          >
            <span className="font-semibold">{t(`flash.${b.grade}`)}</span>
            <span className="hidden text-[10px] text-muted-foreground sm:block">{b.key}</span>
          </Button>
        ))}
      </div>
    </div>
  );
}

function Face({ children, back }: { children: React.ReactNode; back?: boolean }) {
  return (
    <div
      className={cn(
        "absolute inset-0 flex flex-col items-center justify-center rounded-3xl border bg-card p-8 text-center shadow-sm [backface-visibility:hidden]",
        back && "[transform:rotateY(180deg)]",
      )}
    >
      {children}
    </div>
  );
}
