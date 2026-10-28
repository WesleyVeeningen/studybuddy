import { LocaleProvider } from "@/lib/i18n/client";
import { getLocale } from "@/lib/i18n/server";

export async function LocaleRoot({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  return <LocaleProvider locale={locale}>{children}</LocaleProvider>;
}
