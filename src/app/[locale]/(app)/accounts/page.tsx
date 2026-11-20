import { getTranslations, setRequestLocale } from "next-intl/server";
import { getActionFormatter } from "@/components/app/action-format";
import { HealthRing } from "@/components/app/health";
import { Group, LargeTitle, Row } from "@/components/ios/list";
import { Link } from "@/i18n/navigation";
import { daysBetween } from "@/domain/time";
import { getDb } from "@/server/db/client";
import { asLocale } from "@/server/navigation";
import { listAccounts } from "@/server/services/accounts";
import { requireMember } from "@/server/session";

const TIERS = ["all", "key", "growth", "maintain"] as const;

export default async function AccountsPage({
  params,
  searchParams,
}: PageProps<"/[locale]/accounts">) {
  const locale = asLocale((await params).locale);
  setRequestLocale(locale);
  const member = await requireMember(locale);
  const sp = await searchParams;
  const tier = TIERS.find((x) => x === sp.tier) ?? "all";
  const q = typeof sp.q === "string" ? sp.q.trim().toLowerCase() : "";
  const t = await getTranslations("Accounts");
  const now = new Date();
  const { accounts, labels } = await listAccounts(getDb(), member.ctx, now);
  const fmt = await getActionFormatter(labels);
  const shown = accounts.filter(
    (a) =>
      (tier === "all" || a.tier === tier) &&
      (!q || a.name.toLowerCase().includes(q)),
  );

  return (
    <>
      <LargeTitle title={t("title")} />
      <form role="search" className="ios-search">
        <input type="hidden" name="tier" value={tier} />
        <input
          name="q"
          type="search"
          defaultValue={q}
          placeholder={t("search")}
          aria-label={t("search")}
          autoComplete="off"
        />
      </form>
      <nav className="ios-seg" aria-label={t("title")}>
        {TIERS.map((x) => (
          <Link
            key={x}
            href={{
              pathname: "/accounts",
              query: {
                ...(x === "all" ? {} : { tier: x }),
                ...(q ? { q } : {}),
              },
            }}
            aria-current={tier === x ? "true" : undefined}
          >
            {t(x)}
          </Link>
        ))}
      </nav>
      <Group>
        {shown.length ? (
          shown.map((a) => {
            const action = a.nextAction ? fmt(a.nextAction) : null;
            const renewal = a.renewalDate
              ? daysBetween(now, a.renewalDate)
              : null;
            return (
              <Row
                key={a.id}
                href={`/accounts/${a.id}`}
                lead={<HealthRing health={a.health} />}
                title={
                  <>
                    {a.name}{" "}
                    {a.tier === "key" ? (
                      <span className="ios-pill ios-pill-blue">{t("key")}</span>
                    ) : null}
                  </>
                }
                sub={
                  <>
                    {a.relationship === "customer"
                      ? t("customer")
                      : t("prospect")}
                    {renewal !== null && renewal >= 0
                      ? ` · ${t("renewalIn", { days: renewal })}`
                      : ""}{" "}
                    · {t("openDeals", { n: a.openDeals })}
                    <br />
                    <span style={{ color: "var(--accent)" }}>
                      {action ? action.title : t("noAction")}
                    </span>
                  </>
                }
              />
            );
          })
        ) : (
          <p className="ios-empty">{t("empty")}</p>
        )}
      </Group>
    </>
  );
}
