"use client";

import { RotateCcw } from "lucide-react";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n/client";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useT();
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <div className="mx-auto flex max-w-md flex-1 flex-col items-center justify-center px-4 py-20 text-center">
      <h1 className="text-2xl font-semibold">{t("common.error")}</h1>
      <p className="mt-2 mb-6 text-muted-foreground">{t("chat.error")}</p>
      <Button onClick={reset} className="rounded-full">
        <RotateCcw /> {t("common.tryAgain")}
      </Button>
    </div>
  );
}
