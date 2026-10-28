"use server";

import { cookies } from "next/headers";
import { refresh } from "next/cache";
import { locales, type Locale } from "@/lib/i18n/dictionaries";
import { LOCALE_COOKIE } from "@/lib/i18n/server";

export async function setLocale(locale: Locale) {
  if (!locales.includes(locale)) return;
  (await cookies()).set(LOCALE_COOKIE, locale, { maxAge: 60 * 60 * 24 * 365, path: "/", sameSite: "lax" });
  refresh();
}
