"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, FolderOpen, Layers, ListChecks, MessageCircle } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";

export function CourseTabs({ courseId }: { courseId: string }) {
  const t = useT();
  const pathname = usePathname();
  const base = `/courses/${courseId}`;
  const tabs = [
    { href: base, label: t("course.tabs.material"), icon: FolderOpen, exact: true },
    { href: `${base}/chat`, label: t("course.tabs.chat"), icon: MessageCircle },
    { href: `${base}/quiz`, label: t("course.tabs.quiz"), icon: ListChecks },
    { href: `${base}/flashcards`, label: t("course.tabs.flashcards"), icon: Layers },
    { href: `${base}/progress`, label: t("course.tabs.progress"), icon: BarChart3 },
  ];

  return (
    <nav className="-mx-4 mt-5 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:px-0">
      <ul className="flex w-max gap-1 rounded-full bg-muted p-1">
        {tabs.map(({ href, label, icon: Icon, exact }) => {
          const active = exact ? pathname === href : pathname.startsWith(href);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-medium whitespace-nowrap text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring",
                  active && "bg-background text-foreground shadow-sm",
                )}
              >
                <Icon className="size-4" />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
