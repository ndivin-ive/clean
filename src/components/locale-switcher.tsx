"use client";

import { useLocale, useTranslations } from "next-intl";
import { useId, useTransition } from "react";
import { usePathname, useRouter } from "@/i18n/navigation";
import { routing, type AppLocale } from "@/i18n/routing";

export function LocaleSwitcher() {
  const t = useTranslations("Common");
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();
  const id = useId();

  return (
    <div className="flex items-center gap-2 text-sm">
      <label htmlFor={id} className="text-muted-foreground">
        {t("language")}
      </label>
      <select
        id={id}
        value={locale}
        disabled={isPending}
        onChange={(event) => {
          const next = event.target.value as AppLocale;
          startTransition(() => router.replace(pathname, { locale: next }));
        }}
        className="rounded-md border border-border bg-card px-2 py-1"
      >
        {routing.locales.map((value) => (
          <option key={value} value={value}>
            {t("localeName", { locale: value })}
          </option>
        ))}
      </select>
    </div>
  );
}
