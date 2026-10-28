import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { BookOpenCheck, Layers, Quote } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getT } from "@/lib/i18n/server";

export default async function LandingPage() {
  const { userId } = await auth();
  if (userId) redirect("/dashboard");
  const { t } = await getT();

  const features = [
    { icon: Quote, title: t("landing.f1.title"), body: t("landing.f1.body") },
    { icon: BookOpenCheck, title: t("landing.f2.title"), body: t("landing.f2.body") },
    { icon: Layers, title: t("landing.f3.title"), body: t("landing.f3.body") },
  ];

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-4 sm:px-6">
      <section className="flex flex-col items-center py-16 text-center sm:py-24">
        <h1 className="max-w-3xl text-4xl font-semibold text-balance sm:text-6xl">{t("landing.title")}</h1>
        <p className="mt-5 max-w-2xl text-lg text-pretty text-muted-foreground">{t("landing.subtitle")}</p>
        <Button asChild size="lg" className="mt-8 h-12 rounded-full px-7 text-base">
          <Link href="/sign-up">{t("landing.cta")}</Link>
        </Button>
      </section>
      <section className="grid gap-4 pb-20 sm:grid-cols-3">
        {features.map(({ icon: Icon, title, body }) => (
          <div key={title} className="rounded-2xl border bg-card p-6">
            <div className="mb-4 grid size-10 place-items-center rounded-xl bg-secondary text-secondary-foreground">
              <Icon className="size-5" />
            </div>
            <h2 className="font-sans text-base font-semibold">{title}</h2>
            <p className="mt-1.5 text-sm text-muted-foreground">{body}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
