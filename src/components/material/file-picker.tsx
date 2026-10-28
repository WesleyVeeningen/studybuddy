"use client";

import { Checkbox } from "@/components/ui/checkbox";
import { useT } from "@/lib/i18n/client";

export type PickableFile = { id: string; name: string; kind: string; pageCount: number | null };

/** Multi-select of course files. An empty selection means "all material". */
export function FilePicker({
  files,
  value,
  onChange,
  label,
}: {
  files: PickableFile[];
  value: string[];
  onChange: (ids: string[]) => void;
  label: string;
}) {
  const t = useT();
  const all = value.length === 0;
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-medium">{label}</legend>
      <div className="max-h-56 space-y-1 overflow-y-auto rounded-xl border p-2">
        <label className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm hover:bg-muted/60">
          <Checkbox checked={all} onCheckedChange={() => onChange([])} />
          <span className="font-medium">{t("quiz.new.allFiles")}</span>
        </label>
        {files.map((f) => (
          <label key={f.id} className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm hover:bg-muted/60">
            <Checkbox
              checked={value.includes(f.id)}
              onCheckedChange={(v) => onChange(v ? [...value, f.id] : value.filter((id) => id !== f.id))}
            />
            <span className="truncate">{f.name}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
