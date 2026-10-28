import { ClerkProvider } from "@clerk/nextjs";
import { enUS, nlNL } from "@clerk/localizations";
import { LocaleProvider } from "@/lib/i18n/client";
import { getLocale } from "@/lib/i18n/server";

const CLERK_LOCALIZATIONS = { en: enUS, nl: nlNL };

/** Resolves the chosen language once and applies it to our UI and Clerk's sign-in screens. */
export async function LocaleRoot({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  return (
    <ClerkProvider localization={CLERK_LOCALIZATIONS[locale]}>
      <LocaleProvider locale={locale}>{children}</LocaleProvider>
    </ClerkProvider>
  );
}
