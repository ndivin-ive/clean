import { getTranslations } from "next-intl/server";
import type { RoleCoverage } from "@/domain/rules/coverage";
import { daysBetween } from "@/domain/time";

const COV: Record<RoleCoverage["status"], string> = {
  filled: "ios-pill-green",
  weak: "ios-pill-orange",
  missing: "ios-pill-missing",
};
const STANCES = ["supporter", "neutral", "sceptic", "unknown"] as const;
const MAP_ROLES = [
  "economic_buyer",
  "decision_maker",
  "champion",
  "influencer",
  "technical_evaluator",
  "user",
  "procurement",
  "blocker",
] as const;

export function StrengthDots({ n, label }: { n: number; label: string }) {
  return (
    <span className="ios-dots" role="img" aria-label={label}>
      {[1, 2, 3, 4, 5].map((i) => (
        <i key={i} className={i <= n ? "on" : ""} />
      ))}
    </span>
  );
}

export async function CoveragePills({
  coverage,
}: {
  coverage: RoleCoverage[];
}) {
  const tr = await getTranslations("DecisionRole");
  const tc = await getTranslations("Coverage");
  return (
    <div className="ios-pills" style={{ padding: "12px 16px" }}>
      {coverage.map((c) => (
        <span key={c.role} className={`ios-pill ${COV[c.status]}`}>
          {c.status === "filled" ? "✓ " : c.status === "weak" ? "! " : "○ "}
          {tr(c.role)} · {tc(c.status)}
        </span>
      ))}
    </div>
  );
}

export interface MapPerson {
  id: string;
  name: string;
  title: string | null;
  role: string;
  stance: string;
  strength: number;
  lastInteractionAt: Date | null;
}

export async function RelationshipMap({
  people,
  now,
}: {
  people: MapPerson[];
  now: Date;
}) {
  const tr = await getTranslations("DecisionRole");
  const ts = await getTranslations("Stance");
  const tc = await getTranslations("Contact");
  const roles = MAP_ROLES.filter(
    (r) =>
      people.some((p) => p.role === r) ||
      [
        "economic_buyer",
        "decision_maker",
        "champion",
        "technical_evaluator",
        "procurement",
      ].includes(r),
  );
  const others = people.filter(
    (p) => !(MAP_ROLES as readonly string[]).includes(p.role),
  );
  const rows = [
    ...roles.map((r) => ({
      key: r,
      label: tr(r),
      people: people.filter((p) => p.role === r),
    })),
    ...(others.length
      ? [{ key: "unknown", label: tr("unknown"), people: others }]
      : []),
  ];
  return (
    <>
      <div className="ios-rmap" role="table" aria-label="map">
        <div className="h" role="columnheader" />
        {STANCES.map((s) => (
          <div key={s} className="h" role="columnheader">
            {ts(s)}
          </div>
        ))}
        {rows.map((row) => [
          <div key={`${row.key}-h`} className="rl" role="rowheader">
            {row.label}
          </div>,
          ...STANCES.map((s) => (
            <div key={`${row.key}-${s}`} role="cell">
              {row.people
                .filter((p) =>
                  p.stance === s
                    ? true
                    : s === "unknown" &&
                      !(STANCES as readonly string[]).includes(p.stance),
                )
                .map((p) => {
                  const days = p.lastInteractionAt
                    ? daysBetween(p.lastInteractionAt, now)
                    : null;
                  return (
                    <span
                      key={p.id}
                      className={`ios-chip st-${s} ${days === null || days > 60 ? "stale" : ""}`}
                      title={p.title ?? undefined}
                    >
                      <b>{p.name}</b>
                      <span className="stx">{ts(s)}</span>
                      <StrengthDots
                        n={p.strength}
                        label={tc("strength", { n: p.strength })}
                      />
                      <span className="ios-row-sub" style={{ fontSize: 12 }}>
                        {days === null ? tc("never") : tc("ago", { days })}
                      </span>
                    </span>
                  );
                })}
            </div>
          )),
        ])}
      </div>
      <div className="ios-legend">
        {STANCES.map((s) => (
          <span key={s}>
            <b className={`st-${s}`} />
            {ts(s)}
          </span>
        ))}
      </div>
    </>
  );
}
