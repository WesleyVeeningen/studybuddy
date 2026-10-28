import "server-only";
import { cookies, headers } from "next/headers";
import { dictionaries, locales, translate, type DictKey, type Locale } from "./dictionaries";

export const LOCALE_COOKIE = "sb-locale";

export async function getLocale(): Promise<Locale> {
  const fromCookie = (await cookies()).get(LOCALE_COOKIE)?.value;
  if (fromCookie && (locales as readonly string[]).includes(fromCookie)) return fromCookie as Locale;
  const accept = (await headers()).get("accept-language") ?? "";
  return accept.split(",")[0]?.trim().toLowerCase().startsWith("nl") ? "nl" : "en";
}

export async function getT() {
  const locale = await getLocale();
  const dict = dictionaries[locale];
  return {
    locale,
    t: (key: DictKey, vars?: Record<string, string | number>) => translate(dict, key, vars),
  };
}
