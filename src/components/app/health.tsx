import { getFormatter, getTranslations } from "next-intl/server";
import type { Assessment, Band, Reason } from "@/domain/rules/common";

const COLOR: Record<Band, string> = {
  healthy: "var(--success)",
  watch: "var(--warning)",
  risk: "var(--danger)",
};
const PILL: Record<Band, string> = {
  healthy: "ios-pill-green",
  watch: "ios-pill-orange",
  risk: "ios-pill-red",
};

export async function HealthRing({
  health,
  large,
}: {
  health: Assessment;
  large?: boolean;
}) {
  const t = await getTranslations("Health");
  return (
    <span
      className={`ios-ring ${large ? "ios-ring-lg" : ""}`}
      style={{
        ["--p" as string]: health.score,
        ["--c" as string]: COLOR[health.band],
      }}
      role="img"
      aria-label={`${health.score} / 100 · ${t(health.band)}`}
    >
      <span>{health.score}</span>
    </span>
  );
}

export async function BandPill({ band }: { band: Band }) {
  const t = await getTranslations("Health");
  return <span className={`ios-pill ${PILL[band]}`}>{t(band)}</span>;
}

/** Every factor with its points, so the score always shows why (rule 4). */
export async function HealthReasons({ health }: { health: Assessment }) {
  const t = await getTranslations("Health");
  const format = await getFormatter();
  const detail = (r: Reason): string => {
    const d = r.detail;
    const v = (x: unknown) =>
      x === null || x === undefined ? "none" : String(x);
    switch (r.code) {
      case "next_step":
        return t("d_next_step", {
          date: d.date
            ? format.dateTime(new Date(`${d.date}T12:00:00Z`), {
                day: "numeric",
                month: "long",
              })
            : "none",
        });
      case "compelling_event":
        return t("d_compelling_event", { has: r.points > 0 ? "yes" : "no" });
      case "executive_contact":
      case "recency":
      case "renewal":
      case "plan_freshness":
        return t(`d_${r.code}`, { days: v(d.days) });
      case "coverage":
      case "qualification":
        return t(`d_${r.code}`, {
          covered: format.number(Number(d.covered)),
          total: Number(d.total),
        });
      default:
        return t(
          `d_${r.code}` as "d_risks",
          Object.fromEntries(
            Object.entries(d).map(([k, x]) => [k, Number(x ?? 0)]),
          ) as Record<string, number>,
        );
    }
  };
  return (
    <ul className="ios-reasons">
      {health.reasons.map((r) => {
        const state = r.points >= r.max ? "ok" : r.points > 0 ? "part" : "no";
        return (
          <li key={r.code}>
            <span className={`ios-${state}`} aria-hidden>
              {state === "ok" ? "✓" : state === "part" ? "◐" : "○"}
            </span>
            <span>
              {t(r.code as "coverage")}
              <br />
              <span className="ios-row-sub">{detail(r)}</span>
            </span>
            <span
              className="ios-row-sub"
              title={t("outOf", { points: r.points, max: r.max })}
            >
              {r.points}/{r.max}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
