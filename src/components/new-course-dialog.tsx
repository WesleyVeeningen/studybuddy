"use client";

import { Plus } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { createCourse } from "@/app/actions/courses";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useT } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";

const COLORS = ["sage", "sky", "lavender", "peach", "rose", "sand"] as const;

export function NewCourseDialog() {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [color, setColor] = useState<(typeof COLORS)[number]>("sage");
  const [pending, startTransition] = useTransition();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="rounded-full">
          <Plus /> {t("dashboard.newCourse")}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("course.new.title")}</DialogTitle>
        </DialogHeader>
        <form
          className="grid gap-4"
          action={(form) =>
            startTransition(async () => {
              try {
                await createCourse({
                  name: String(form.get("name") ?? ""),
                  description: String(form.get("description") ?? ""),
                  color,
                });
              } catch (err) {
                // redirect() throws a control-flow error that must propagate.
                if (err && typeof err === "object" && "digest" in err) throw err;
                toast.error(t("common.error"));
              }
            })
          }
        >
          <div className="grid gap-1.5">
            <Label htmlFor="course-name">{t("course.new.name")}</Label>
            <Input id="course-name" name="name" required maxLength={80} autoFocus placeholder={t("course.new.namePlaceholder")} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="course-description">{t("course.new.description")}</Label>
            <Input id="course-description" name="description" maxLength={300} placeholder={t("course.new.descriptionPlaceholder")} />
          </div>
          <fieldset className="grid gap-1.5">
            <legend className="mb-1.5 text-sm font-medium">{t("course.new.color")}</legend>
            <div className="flex gap-2">
              {COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-label={t(`course.color.${c}`)}
                  aria-pressed={color === c}
                  onClick={() => setColor(c)}
                  className={cn(
                    `course-${c}`,
                    "size-8 rounded-full bg-[var(--course)] ring-offset-2 ring-offset-background transition-shadow outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    color === c && "ring-2 ring-foreground",
                  )}
                />
              ))}
            </div>
          </fieldset>
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {t("course.new.create")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
