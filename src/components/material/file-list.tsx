"use client";

import { AlertCircle, FileImage, FileText, Loader2, MoreHorizontal, Presentation, RotateCw, ScrollText, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useTransition } from "react";
import { deleteFile, retryFile } from "@/app/actions/courses";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useT } from "@/lib/i18n/client";
import type { DictKey } from "@/lib/i18n/dictionaries";

export type FileItem = {
  id: string;
  name: string;
  kind: "pdf" | "pptx" | "image" | "text";
  status: "processing" | "ready" | "error";
  error: string | null;
  pageCount: number | null;
  createdAt: string;
};

const ICONS = { pdf: FileText, pptx: Presentation, image: FileImage, text: ScrollText };

export function FileList({ files }: { files: FileItem[] }) {
  const t = useT();
  const router = useRouter();
  const processing = files.some((f) => f.status === "processing");

  // Poll while any file is still being read.
  useEffect(() => {
    if (!processing) return;
    const id = setInterval(() => router.refresh(), 2500);
    return () => clearInterval(id);
  }, [processing, router]);

  if (files.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed px-6 py-10 text-center">
        <p className="font-medium">{t("material.empty.title")}</p>
        <p className="mt-1 text-sm text-muted-foreground">{t("material.empty.body")}</p>
      </div>
    );
  }

  return (
    <ul className="divide-y overflow-hidden rounded-2xl border bg-card">
      {files.map((f) => (
        <FileRow key={f.id} file={f} />
      ))}
    </ul>
  );
}

function FileRow({ file }: { file: FileItem }) {
  const t = useT();
  const [pending, startTransition] = useTransition();
  const Icon = ICONS[file.kind];
  const countKey: DictKey = file.kind === "pptx" ? "material.slides" : file.kind === "text" ? "material.sections" : "material.pages";

  return (
    <li className="flex items-center gap-3 px-4 py-3" aria-busy={pending}>
      <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-muted text-muted-foreground">
        <Icon className="size-5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{file.name}</p>
        <p className="truncate text-sm text-muted-foreground">
          {t(`material.kind.${file.kind}`)}
          {file.status === "ready" && file.pageCount && file.kind !== "image" && <> · {t(countKey, { count: file.pageCount })}</>}
          {file.status === "error" && file.error && <span className="text-destructive"> · {file.error}</span>}
        </p>
      </div>
      {file.status === "processing" && (
        <Badge variant="secondary" className="gap-1">
          <Loader2 className="size-3 animate-spin" /> {t("material.status.processing")}
        </Badge>
      )}
      {file.status === "error" && (
        <Badge variant="destructive" className="gap-1">
          <AlertCircle className="size-3" /> {t("material.status.error")}
        </Badge>
      )}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label="File options" disabled={pending}>
            {pending ? <Loader2 className="animate-spin" /> : <MoreHorizontal />}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {file.status === "error" && (
            <DropdownMenuItem onSelect={() => startTransition(() => retryFile(file.id))}>
              <RotateCw /> {t("material.retry")}
            </DropdownMenuItem>
          )}
          <DropdownMenuItem variant="destructive" onSelect={() => startTransition(() => deleteFile(file.id))}>
            <Trash2 /> {t("material.delete")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </li>
  );
}
