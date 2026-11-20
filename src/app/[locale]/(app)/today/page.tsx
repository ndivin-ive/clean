import {
  getFormatter,
  getTranslations,
  setRequestLocale,
} from "next-intl/server";
import { ActionList } from "@/components/app/action-list";
import { Group, LargeTitle } from "@/components/ios/list";
import { rankActions } from "@/domain/rules/today";
import { getDb } from "@/server/db/client";
import { asLocale } from "@/server/navigation";
import { loadBook } from "@/server/services/book";
import { requireMember } from "@/server/session";

export default async function TodayPage({
  params,
}: PageProps<"/[locale]/today">) {
  const locale = asLocale((await params).locale);
  setRequestLocale(locale);
  const member = await requireMember(locale);
  const t = await getTranslations("Today");
  const format = await getFormatter();
  const { book, labels } = await loadBook(getDb(), member.ctx);
  const actions = rankActions(book);
  return (
    <>
      <LargeTitle
        title={t("title")}
        subtitle={format.dateTime(new Date(), {
          weekday: "long",
          day: "numeric",
          month: "long",
        })}
      />
      {actions.length ? (
        <Group header={t("focus")} footer={t("footer")}>
          <ActionList actions={actions} labels={labels} />
        </Group>
      ) : (
        <Group footer={t("emptyBody")}>
          <p className="ios-empty">{t("emptyTitle")}</p>
        </Group>
      )}
    </>
  );
}
