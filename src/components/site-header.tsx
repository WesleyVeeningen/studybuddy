"use client";

import Link from "next/link";
import { Show, UserButton } from "@clerk/nextjs";
import { Check, Languages, Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useTransition } from "react";
import { setLocale } from "@/app/actions/preferences";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useLocale, useT } from "@/lib/i18n/client";
import { Logo } from "@/components/logo";

export function SiteHeader() {
  const t = useT();
  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/70">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-2 px-4 sm:px-6">
        <Link href="/" className="mr-auto flex items-center gap-2 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <Logo />
        </Link>
        <PreferencesMenu />
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

function PreferencesMenu() {
  const t = useT();
  const locale = useLocale();
  const { theme, setTheme } = useTheme();
  const [, startTransition] = useTransition();

  const themes = [
    { value: "light", label: t("theme.light"), icon: Sun },
    { value: "dark", label: t("theme.dark"), icon: Moon },
    { value: "system", label: t("theme.system"), icon: Monitor },
  ];
  const languages = [
    { value: "en" as const, label: "English" },
    { value: "nl" as const, label: "Nederlands" },
  ];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={`${t("nav.language")} / ${t("nav.theme")}`}>
          <Languages className="size-4.5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuLabel>{t("nav.language")}</DropdownMenuLabel>
        {languages.map((l) => (
          <DropdownMenuItem key={l.value} onSelect={() => startTransition(() => setLocale(l.value))}>
            {l.label}
            {locale === l.value && <Check className="ml-auto size-4" />}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuLabel>{t("nav.theme")}</DropdownMenuLabel>
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
