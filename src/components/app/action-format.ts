import { getFormatter, getLocale, getTranslations } from "next-intl/server";
import type { Candidate } from "@/domain/rules/today";
import type { BookLabels } from "@/server/services/book";

export const ACTION_HREF: Record<string, string> = {
  deal: "/deals",
  account: "/accounts",
  plan: "/accounts",
  person: "/accounts",
  meeting: "/today",
  proposals: "/capture",
};

/** Where an action leads: the account page for account-scoped actions when known. */
export function actionHref(a: Candidate): string {
  if (a.target.kind === "deal") return "/deals";
  if (a.accountId && ["account", "plan", "person"].includes(a.target.kind))
    return `/accounts/${a.accountId}`;
  return ACTION_HREF[a.target.kind] ?? "/today";
}

/** Translate an action's reason code and parameters into a title and a plain-words reason. */
export async function getActionFormatter(labels: BookLabels) {
  const t = await getTranslations("Actions");
  const tRole = await getTranslations("DecisionRole");
  const format = await getFormatter();
  const fr = (await getLocale()) === "fr";
  return (a: Candidate) => {
    const p = a.reason.params;
    const code = (
      a.reason.code === "renewal_plan_stale" && p.planAge === -1
        ? "renewal_plan_never"
        : a.reason.code
    ) as "stalled";
    const stage = labels.stages.get(String(p.stageId));
    const crit = labels.criteria.get(String(p.criterion));
    const values: Record<string, string | number> = {
      ...p,
      deal: String(p.deal ?? ""),
      stage: stage ? (fr ? stage.nameFr : stage.nameEn) : "",
      criterion: crit ? (fr ? crit.labelFr : crit.labelEn).toLowerCase() : "",
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
    return {
      title: t(`${code}.title`, values),
      reason: t(`${code}.reason`, values),
    };
  };
}
