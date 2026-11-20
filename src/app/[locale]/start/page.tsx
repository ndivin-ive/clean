import { getTranslations, setRequestLocale } from "next-intl/server";
import { redirect } from "next/navigation";
import { Group, LargeTitle } from "@/components/ios/list";
import { getDb } from "@/server/db/client";
import { asLocale } from "@/server/navigation";
import {
  listMyOrganizations,
  selectOrganization,
} from "@/server/services/organizations";
import { getCurrentMember, requireUser } from "@/server/session";
import { chooseOrganization } from "./actions";

/** After sign-in: route to onboarding, straight into the only organisation, or show a picker. */
export default async function StartPage({
  params,
}: PageProps<"/[locale]/start">) {
  const locale = asLocale((await params).locale);
  setRequestLocale(locale);
  const user = await requireUser(locale);
  if (await getCurrentMember()) redirect(`/${locale}/today`);
  const orgs = await listMyOrganizations(getDb(), user.id);
  if (orgs.length === 0) redirect(`/${locale}/onboarding`);
  if (orgs.length === 1) {
    await selectOrganization(getDb(), user, orgs[0]!.id);
    redirect(`/${locale}/today`);
  }
  const t = await getTranslations("Start");
  const roles = await getTranslations("Roles");
  return (
    <main
      id="main"
      className="ios-page"
      style={{ maxWidth: 520, paddingTop: 48 }}
    >
      <LargeTitle title={t("title")} subtitle={t("lead")} />
      <Group>
        {orgs.map((o) => (
          <form key={o.id} action={chooseOrganization}>
            <input type="hidden" name="locale" value={locale} />
            <input type="hidden" name="organizationId" value={o.id} />
            <button
              type="submit"
              className="ios-row"
              style={{ cursor: "pointer" }}
            >
              <span className="ios-row-main">
                <span>{o.name}</span>
                <span className="ios-row-sub">
                  {o.roles.map((r) => roles(r as "seller")).join(" · ")}
                </span>
              </span>
            </button>
          </form>
        ))}
      </Group>
    </main>
  );
}
