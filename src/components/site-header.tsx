"use client";

import Link from "next/link";
import { Show, UserButton } from "@clerk/nextjs";
import { Check, Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useOptimistic, useTransition } from "react";
import { setLocale } from "@/app/actions/preferences";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useLocale, useT } from "@/lib/i18n/client";
import type { Locale } from "@/lib/i18n/dictionaries";
import { Logo } from "@/components/logo";
import { cn } from "@/lib/utils";

export function SiteHeader() {
  const t = useT();
  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/70">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-2 px-4 sm:px-6">
        <Link href="/" className="mr-auto flex items-center gap-2 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <Logo />
        </Link>
        <LanguageToggle />
        <ThemeMenu />
        <Show when="signed-in">
          <UserButton />
        </Show>
        <Show when="signed-out">
          <Button asChild size="sm">
            <Link href="/sign-in">{t("nav.signIn")}</Link>
          </Button>
        </Show>
      </div>
    </header>
  );
}

const LANGUAGES: { value: Locale; short: string; label: string }[] = [
  { value: "en", short: "EN", label: "English" },
  { value: "nl", short: "NL", label: "Nederlands" },
];

/** Visible EN | NL switch. Applies to the whole site, including the AI tutor's replies. */
function LanguageToggle() {
  const t = useT();
  const locale = useLocale();
  const [pending, startTransition] = useTransition();
  const [current, setCurrent] = useOptimistic(locale);

  return (
    <div
      role="radiogroup"
      aria-label={t("nav.language")}
      className={cn("flex rounded-full bg-muted p-0.5 text-xs font-semibold", pending && "opacity-80")}
    >
      {LANGUAGES.map((l) => {
        const active = current === l.value;
        return (
          <button
            key={l.value}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={l.label}
            title={l.label}
            onClick={() => {
              if (active) return;
              startTransition(async () => {
                setCurrent(l.value);
                await setLocale(l.value);
              });
            }}
            className={cn(
              "rounded-full px-2.5 py-1 text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring",
              active && "bg-background text-foreground shadow-sm",
            )}
          >
            {l.short}
          </button>
        );
      })}
    </div>
  );
}

function ThemeMenu() {
  const t = useT();
  const { theme, setTheme } = useTheme();
  const themes = [
    { value: "light", label: t("theme.light"), icon: Sun },
    { value: "dark", label: t("theme.dark"), icon: Moon },
    { value: "system", label: t("theme.system"), icon: Monitor },
  ];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={t("nav.theme")}>
          <Sun className="size-4.5 dark:hidden" />
          <Moon className="hidden size-4.5 dark:block" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40">
        {themes.map(({ value, label, icon: Icon }) => (
          <DropdownMenuItem key={value} onSelect={() => setTheme(value)}>
            <Icon className="size-4" />
            {label}
            {theme === value && <Check className="ml-auto size-4" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
