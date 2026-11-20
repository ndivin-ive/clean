import {
  getFormatter,
  getTranslations,
  setRequestLocale,
} from "next-intl/server";
import { Group, LargeTitle } from "@/components/ios/list";
import { asLocale } from "@/server/navigation";

export default async function TodayPage({
  params,
}: PageProps<"/[locale]/today">) {
  const locale = asLocale((await params).locale);
  setRequestLocale(locale);
  const t = await getTranslations("Today");
  const format = await getFormatter();
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
      <Group footer={t("emptyBody")}>
        <p className="ios-empty">{t("emptyTitle")}</p>
      </Group>
    </>
  );
}
