"use client";

import { MoreHorizontal, Trash2 } from "lucide-react";
import { useTransition } from "react";
import { deleteCourse } from "@/app/actions/courses";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useT } from "@/lib/i18n/client";

export function CourseActions({ courseId }: { courseId: string }) {
  const t = useT();
  const [pending, startTransition] = useTransition();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Course options" disabled={pending}>
          <MoreHorizontal />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem
          variant="destructive"
          onSelect={() => {
            if (confirm(t("course.delete.confirm"))) startTransition(() => deleteCourse(courseId));
          }}
        >
          <Trash2 /> {t("course.delete")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
