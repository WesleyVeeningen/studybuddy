"use client";

import { upload } from "@vercel/blob/client";
import { ClipboardPaste, Loader2, UploadCloud } from "lucide-react";
import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { addPastedText, registerUpload } from "@/app/actions/courses";
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
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { useT } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";

const MAX_BYTES = 50 * 1024 * 1024;
const ACCEPT = ".pdf,.pptx,.png,.jpg,.jpeg,.webp,.gif,.txt,.md";
const SUPPORTED = /\.(pdf|pptx|png|jpe?g|webp|gif|txt|md)$/i;

type Uploading = { name: string; percent: number };

export function Uploader({ courseId }: { courseId: string }) {
  const t = useT();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [uploads, setUploads] = useState<Uploading[]>([]);
  const [userId, setUserId] = useState<string | null>(null);

  async function getUserPrefix() {
    if (userId) return userId;
    const res = await fetch("/api/me");
    const { id } = (await res.json()) as { id: string };
    setUserId(id);
    return id;
  }

  async function handleFiles(list: FileList | File[]) {
    const files = Array.from(list);
    for (const file of files) {
      if (!SUPPORTED.test(file.name)) {
        toast.error(t("material.upload.unsupported", { name: file.name }));
        continue;
      }
      if (file.size > MAX_BYTES) {
        toast.error(t("material.upload.tooLarge", { name: file.name }));
        continue;
      }
      void uploadOne(file);
    }
  }

  async function uploadOne(file: File) {
    setUploads((u) => [...u, { name: file.name, percent: 0 }]);
    try {
      const prefix = await getUserPrefix();
      const safeName = file.name.replace(/[^\w.\- ]+/g, "_");
      const blob = await upload(`${prefix}/${courseId}/${safeName}`, file, {
        access: "private",
        handleUploadUrl: "/api/upload",
        clientPayload: JSON.stringify({ courseId }),
        multipart: file.size > 8 * 1024 * 1024,
        onUploadProgress: ({ percentage }) =>
          setUploads((u) => u.map((x) => (x.name === file.name ? { ...x, percent: percentage } : x))),
      });
      await registerUpload({ courseId, pathname: blob.pathname, name: file.name, size: file.size });
    } catch (err) {
      console.error(err);
      toast.error(`${file.name}: ${t("common.error")}`);
    } finally {
      setUploads((u) => u.filter((x) => x.name !== file.name));
    }
  }

  return (
    <section aria-label={t("material.upload.title")} className="space-y-3">
      <div
        role="button"
        tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          void handleFiles(e.dataTransfer.files);
        }}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed bg-card px-6 py-10 text-center transition-colors outline-none hover:border-primary/50 hover:bg-accent/40 focus-visible:ring-2 focus-visible:ring-ring",
          dragging && "border-primary bg-accent/60",
        )}
      >
        <div className="mb-3 grid size-12 place-items-center rounded-2xl bg-[var(--course-soft,var(--secondary))] text-secondary-foreground">
          <UploadCloud className="size-6" />
        </div>
        <p className="font-medium">{t("material.upload.drop")}</p>
        <p className="mt-1 text-sm text-muted-foreground">{t("material.upload.hint")}</p>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          multiple
          hidden
          onChange={(e) => {
            if (e.target.files) void handleFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      {uploads.length > 0 && (
        <ul className="space-y-2" aria-live="polite">
          {uploads.map((u) => (
            <li key={u.name} className="rounded-xl border bg-card px-4 py-3">
              <div className="mb-2 flex items-center gap-2 text-sm">
                <Loader2 className="size-4 animate-spin text-muted-foreground" />
                <span className="truncate">{t("material.upload.uploading", { name: u.name })}</span>
                <span className="ml-auto text-muted-foreground tabular-nums">{Math.round(u.percent)}%</span>
              </div>
              <Progress value={u.percent} className="h-1.5" />
            </li>
          ))}
        </ul>
      )}

      <PasteDialog courseId={courseId} />
    </section>
  );
}

function PasteDialog({ courseId }: { courseId: string }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="rounded-full">
          <ClipboardPaste /> {t("material.paste.button")}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t("material.paste.title")}</DialogTitle>
        </DialogHeader>
        <form
          className="grid gap-4"
          action={(form) =>
            startTransition(async () => {
              try {
                const res = await addPastedText({
                  courseId,
                  title: String(form.get("title") ?? ""),
                  text: String(form.get("text") ?? ""),
                });
                if (res.ok) setOpen(false);
                else toast.error(t(res.error === "too_short" ? "material.paste.tooShort" : "material.paste.tooLong"));
              } catch {
                toast.error(t("common.error"));
              }
            })
          }
        >
          <div className="grid gap-1.5">
            <Label htmlFor="paste-title">{t("material.paste.titleLabel")}</Label>
            <Input id="paste-title" name="title" maxLength={120} placeholder={t("material.paste.titlePlaceholder")} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="paste-text">{t("material.paste.textLabel")}</Label>
            <Textarea
              id="paste-text"
              name="text"
              required
              minLength={20}
              className="max-h-[50vh] min-h-56"
              placeholder={t("material.paste.textPlaceholder")}
            />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="animate-spin" />}
              {t("material.paste.save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
