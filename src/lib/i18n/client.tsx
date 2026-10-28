"use client";

import { createContext, useCallback, useContext, useEffect } from "react";
import { TZ_COOKIE } from "@/lib/time";
import { dictionaries, translate, type DictKey, type Locale } from "./dictionaries";

const LocaleContext = createContext<Locale>("en");

export function LocaleProvider({ locale, children }: { locale: Locale; children: React.ReactNode }) {
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);
  useEffect(() => {
    // Lets the server compute "due today" in the student's own timezone.
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (tz && !document.cookie.includes(`${TZ_COOKIE}=${encodeURIComponent(tz)}`)) {
      document.cookie = `${TZ_COOKIE}=${encodeURIComponent(tz)}; path=/; max-age=31536000; samesite=lax`;
    }
  }, []);
  return <LocaleContext.Provider value={locale}>{children}</LocaleContext.Provider>;
}

export function useLocale() {
  return useContext(LocaleContext);
}

export function useT() {
  const locale = useContext(LocaleContext);
  return useCallback(
    (key: DictKey, vars?: Record<string, string | number>) => translate(dictionaries[locale], key, vars),
    [locale],
  );
}
