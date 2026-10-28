"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n/client";

export default function NotFound() {
  const t = useT();
  return (
    <div className="mx-auto flex max-w-md flex-1 flex-col items-center justify-center px-4 py-20 text-center">
      <p className="font-heading text-6xl font-semibold text-muted-foreground/50">404</p>
      <p className="mt-3 mb-6 text-muted-foreground">{t("common.notFound")}</p>
      <Button asChild className="rounded-full">
        <Link href="/dashboard">{t("common.goHome")}</Link>
      </Button>
    </div>
  );
}
