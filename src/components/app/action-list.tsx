import { getTranslations } from "next-intl/server";
import { Row } from "@/components/ios/list";
import type { Candidate } from "@/domain/rules/today";
import type { BookLabels } from "@/server/services/book";
import { actionHref, getActionFormatter } from "./action-format";

/** Today's ranked actions: title, the reason in plain words, and the score. */
export async function ActionList({
  actions,
  labels,
}: {
  actions: Candidate[];
  labels: BookLabels;
}) {
  const fmt = await getActionFormatter(labels);
  const tToday = await getTranslations("Today");
  return actions.map((a, i) => {
    const { title, reason } = fmt(a);
    return (
      <Row
        key={`${a.ruleKey}:${a.subjectKey}`}
        href={actionHref(a)}
        lead={
          <span className={`ios-rank ${i === 0 ? "ios-rank-top" : ""}`}>
            {i + 1}
          </span>
        }
        title={title}
        sub={reason}
        value={
          <span className="ios-pill" title={tToday("score", { n: a.score })}>
            {a.score}
          </span>
        }
      />
    );
  });
}
