import { useTranslations } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { use } from "react";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { cleanSteps } from "@/domain/clean-steps";
import type { AppLocale } from "@/i18n/routing";

export default function LandingPage({ params }: PageProps<"/[locale]">) {
  const { locale } = use(params);
  setRequestLocale(locale as AppLocale);
  const t = useTranslations("Landing");
  const common = useTranslations("Common");

  return (
    <>
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <span className="text-lg font-semibold tracking-wide">
            {common("appName")}
          </span>
          <LocaleSwitcher />
        </div>
      </header>

      <main id="main" className="mx-auto w-full max-w-5xl flex-1 px-4 py-12">
        <p className="text-sm font-medium text-accent">{t("eyebrow")}</p>
        <h1 className="mt-2 max-w-3xl text-3xl font-semibold text-balance sm:text-4xl">
          {t("headline")}
        </h1>
        <p className="mt-4 max-w-2xl text-lg text-muted-foreground">
          {t("lead")}
        </p>

        <section aria-labelledby="steps-title" className="mt-12">
          <h2 id="steps-title" className="text-xl font-semibold">
            {t("stepsTitle")}
          </h2>
          <ol className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {cleanSteps.map((step) => (
              <li
                key={step}
                className="rounded-lg border border-border bg-card p-4"
              >
                <span
                  aria-hidden="true"
                  className="inline-flex size-8 items-center justify-center rounded-md bg-accent font-semibold text-accent-foreground"
                >
                  {t(`steps.${step}.letter`)}
                </span>
                <h3 className="mt-3 font-medium">{t(`steps.${step}.name`)}</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  {t(`steps.${step}.description`)}
                </p>
              </li>
            ))}
          </ol>
        </section>

        <p className="mt-12 text-sm text-muted-foreground">{t("status")}</p>
      </main>
    </>
  );
}
