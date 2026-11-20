import { getTranslations } from "next-intl/server";
import { Group, LargeTitle } from "@/components/ios/list";

export async function Placeholder({
  screen,
}: {
  screen: "accounts" | "deals" | "pipeline" | "capture";
}) {
  const t = await getTranslations("Placeholder");
  return (
    <>
      <LargeTitle title={t(screen)} />
      <Group>
        <p className="ios-empty">{t("body")}</p>
      </Group>
    </>
  );
}
