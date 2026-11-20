import { getFormatter, getLocale, getTranslations } from "next-intl/server";
import { Row } from "@/components/ios/list";
import type { Candidate } from "@/domain/rules/today";
import type { BookLabels } from "@/server/services/book";

const HREF: Record<string, string> = {
  deal: "/deals",
  account: "/accounts",
  plan: "/accounts",
  person: "/accounts",
  meeting: "/today",
  proposals: "/capture",
};

/** Today's ranked actions: title, the reason in plain words, and the score. */
export async function ActionList({
  actions,
  labels,
}: {
  actions: Candidate[];
  labels: BookLabels;
}) {
  const t = await getTranslations("Actions");
  const tRole = await getTranslations("DecisionRole");
  const tToday = await getTranslations("Today");
  const format = await getFormatter();
  const fr = (await getLocale()) === "fr";
  const stageName = (id: unknown) => {
    const st = labels.stages.get(String(id));
    return st ? (fr ? st.nameFr : st.nameEn) : "";
  };

  return actions.map((a, i) => {
    const p = a.reason.params;
    const code =
      a.reason.code === "renewal_plan_stale" && p.planAge === -1
        ? "renewal_plan_never"
        : a.reason.code;
    const values: Record<string, string | number> = {
      ...p,
      deal: String(p.deal ?? ""),
      stage: stageName(p.stageId),
      criterion: (() => {
        const c = labels.criteria.get(String(p.criterion));
        return c ? (fr ? c.labelFr : c.labelEn).toLowerCase() : "";
      })(),
      role: p.role ? tRole(String(p.role) as "champion") : "",
      account: p.account
        ? String(p.account)
        : (labels.accounts.get(String(p.accountId)) ?? ""),
      amount:
        typeof p.amount === "number"
          ? format.number(p.amount, {
              style: "currency",
              currency: "EUR",
              maximumFractionDigits: 0,
            })
          : "",
      date: p.date
        ? format.dateTime(new Date(`${p.date}T12:00:00Z`), {
            day: "numeric",
            month: "long",
          })
        : "",
      when: p.startsAt
        ? format.dateTime(new Date(String(p.startsAt)), {
            weekday: "short",
            hour: "2-digit",
            minute: "2-digit",
          })
        : "",
    };
    const key = code as "stalled";
    return (
      <Row
        key={`${a.ruleKey}:${a.subjectKey}`}
        href={HREF[a.target.kind] ?? "/today"}
        lead={
          <span className={`ios-rank ${i === 0 ? "ios-rank-top" : ""}`}>
            {i + 1}
          </span>
        }
        title={t(`${key}.title`, values)}
        sub={t(`${key}.reason`, values)}
        value={
          <span className="ios-pill" title={tToday("score", { n: a.score })}>
            {a.score}
          </span>
        }
      />
    );
  });
}
