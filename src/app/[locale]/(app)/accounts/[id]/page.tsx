import {
  getFormatter,
  getLocale,
  getTranslations,
  setRequestLocale,
} from "next-intl/server";
import { notFound } from "next/navigation";
import { actionHref, getActionFormatter } from "@/components/app/action-format";
import { BandPill, HealthReasons, HealthRing } from "@/components/app/health";
import {
  CoveragePills,
  RelationshipMap,
  StrengthDots,
} from "@/components/app/people";
import { BackChevron } from "@/components/ios/icons";
import { Group, Row } from "@/components/ios/list";
import { daysBetween } from "@/domain/time";
import { Link } from "@/i18n/navigation";
import { getDb } from "@/server/db/client";
import { asLocale } from "@/server/navigation";
import { getAccountDetail } from "@/server/services/accounts";
import { requireMember } from "@/server/session";

const TABS = ["overview", "people", "deals", "timeline"] as const;

export default async function AccountPage({
  params,
  searchParams,
}: PageProps<"/[locale]/accounts/[id]">) {
  const { locale: raw, id } = await params;
  const locale = asLocale(raw);
  setRequestLocale(locale);
  const member = await requireMember(locale);
  const now = new Date();
  const detail = await getAccountDetail(getDb(), member.ctx, id, now);
  if (!detail) notFound();
  const sp = await searchParams;
  const tab = TABS.find((x) => x === sp.tab) ?? "overview";
  const t = await getTranslations("Accounts");
  const tr = await getTranslations("DecisionRole");
  const ts = await getTranslations("Stance");
  const tc = await getTranslations("Contact");
  const ti = await getTranslations("Interaction");
  const tf = await getTranslations("Forecast");
  const format = await getFormatter();
  const fr = (await getLocale()) === "fr";
  const fmt = await getActionFormatter(detail.labels);
  const { account: a, health } = detail;
  const renewal = a.renewalDate ? daysBetween(now, a.renewalDate) : null;
  const money = (n: number | null) =>
    n === null
      ? "—"
      : format.number(n, {
          style: "currency",
          currency: a.currency,
          maximumFractionDigits: 0,
        });
  const date = (d: Date | string) =>
    format.dateTime(typeof d === "string" ? new Date(`${d}T12:00:00Z`) : d, {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  const stageName = (sid: string) => {
    const st = detail.labels.stages.get(sid);
    return st ? (fr ? st.nameFr : st.nameEn) : "";
  };
  const upcoming = detail.interactions
    .filter((i) => i.occurredAt > now)
    .reverse();
  const past = detail.interactions.filter((i) => i.occurredAt <= now);
  const next = detail.nextAction ? fmt(detail.nextAction) : null;

  return (
    <>
      <Link href="/accounts" className="ios-back">
        <BackChevron />
        {t("title")}
      </Link>
      <div className="ios-large-title">
        <h1>{a.name}</h1>
        <div className="ios-pills" style={{ marginTop: 10 }}>
          <span
            className={`ios-pill ${a.tier === "key" ? "ios-pill-blue" : ""}`}
          >
            {t(a.tier)}
          </span>
          <span className="ios-pill">
            {a.relationship === "customer" ? t("customer") : t("prospect")}
          </span>
          {renewal !== null && renewal >= 0 ? (
            <span
              className={`ios-pill ${renewal <= 90 ? "ios-pill-orange" : ""}`}
            >
              {t("renewalIn", { days: renewal })}
            </span>
          ) : null}
        </div>
      </div>
      <nav className="ios-seg" aria-label={a.name}>
        {TABS.map((x) => (
          <Link
            key={x}
            href={{
              pathname: `/accounts/${a.id}`,
              query: x === "overview" ? {} : { tab: x },
            }}
            aria-current={tab === x ? "true" : undefined}
          >
            {t(x)}
          </Link>
        ))}
      </nav>

      {tab === "overview" ? (
        <>
          <Group header={t("health")} footer={t("healthFoot")}>
            <div className="ios-row">
              <HealthRing health={health} large />
              <BandPill band={health.band} />
            </div>
            <HealthReasons health={health} />
          </Group>
          {next && detail.nextAction ? (
            <Group header={t("nextAction")}>
              <Row
                href={actionHref(detail.nextAction)}
                title={next.title}
                sub={next.reason}
              />
            </Group>
          ) : null}
          {detail.plan || a.tier === "key" ? (
            <Group header={t("plan")} footer={t("planSoon")}>
              <Row
                title={t("plan")}
                sub={
                  detail.plan?.lastReviewedAt
                    ? t("planReviewed", {
                        days: daysBetween(detail.plan.lastReviewedAt, now),
                      })
                    : t("planNever")
                }
              />
            </Group>
          ) : null}
          <Group header={t("signals")}>
            {detail.signals.length ? (
              detail.signals.map((g) => (
                <Row key={g.id} title={g.title} sub={date(g.detectedAt)} />
              ))
            ) : (
              <p className="ios-empty">{t("noSignals")}</p>
            )}
          </Group>
          <Group header={t("details")}>
            <Row
              title={t("relationship")}
              value={
                a.relationship === "customer" ? t("customer") : t("prospect")
              }
            />
            <Row title={t("industry")} value={a.industry ?? "—"} />
            <Row title={t("segment")} value={a.segment ?? "—"} />
            <Row title={t("country")} value={a.country ?? "—"} />
            <Row title={t("annual")} value={money(a.annualValue)} />
            <Row
              title={t("renewal")}
              value={a.renewalDate ? date(a.renewalDate) : "—"}
            />
            <Row title={t("domain")} value={a.domain ?? "—"} />
          </Group>
        </>
      ) : null}

      {tab === "people" ? (
        <>
          <Group header={t("coverage")} footer={t("coverageFoot")}>
            <CoveragePills coverage={health.coverage} />
          </Group>
          <section className="ios-group">
            <h2 className="ios-group-header">{t("map")}</h2>
            <RelationshipMap people={detail.people} now={now} />
            <p className="ios-group-footer">{t("mapFoot")}</p>
          </section>
          <Group header={t("people")}>
            {detail.people.map((p) => (
              <Row
                key={p.id}
                title={p.name}
                sub={`${p.title ?? ""} · ${tr(p.role as "champion")} · ${ts(p.stance as "neutral")} · ${p.lastInteractionAt ? tc("ago", { days: daysBetween(p.lastInteractionAt, now) }) : tc("never")}`}
                value={
                  <StrengthDots
                    n={p.strength}
                    label={tc("strength", { n: p.strength })}
                  />
                }
              />
            ))}
          </Group>
        </>
      ) : null}

      {tab === "deals" ? (
        <Group>
          {detail.deals.length ? (
            detail.deals.map((d) => (
              <Row
                key={d.id}
                href="/deals"
                lead={d.health ? <HealthRing health={d.health} /> : undefined}
                title={d.name}
                sub={`${stageName(d.stageId)} · ${money(d.amount)} · ${d.closeDate ? date(d.closeDate) : "—"}`}
                value={
                  d.open ? (
                    <span className="ios-pill">
                      {d.forecastCategory
                        ? tf(d.forecastCategory as "commit")
                        : tf("none")}
                    </span>
                  ) : undefined
                }
              />
            ))
          ) : (
            <p className="ios-empty">{t("noDeals")}</p>
          )}
        </Group>
      ) : null}

      {tab === "timeline" ? (
        <>
          {upcoming.length ? (
            <Group header={t("upcoming")}>
              {upcoming.map((i) => (
                <Row
                  key={i.id}
                  title={i.title || ti(i.type as "meeting")}
                  sub={`${format.dateTime(i.occurredAt, { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })} · ${t("with", { names: i.people.join(", ") })}`}
                />
              ))}
            </Group>
          ) : null}
          <Group header={t("past")}>
            {past.length ? (
              past.map((i) => (
                <Row
                  key={i.id}
                  title={i.summary || i.title || ti(i.type as "meeting")}
                  sub={`${ti(i.type as "meeting")} · ${date(i.occurredAt)}${i.people.length ? ` · ${i.people.join(", ")}` : ""}`}
                />
              ))
            ) : (
              <p className="ios-empty">{t("noInteractions")}</p>
            )}
          </Group>
        </>
      ) : null}
    </>
  );
}
