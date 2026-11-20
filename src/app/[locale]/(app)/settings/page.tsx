import { eq } from "drizzle-orm";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { SignOutButton } from "@/components/app/sign-out-button";
import { Group, LargeTitle, Row } from "@/components/ios/list";
import { can } from "@/domain/permissions";
import { getDb } from "@/server/db/client";
import { organization } from "@/server/db/schema";
import { withTenant } from "@/server/db/tenant";
import { asLocale } from "@/server/navigation";
import { listMyOrganizations } from "@/server/services/organizations";
import { requireMember } from "@/server/session";
import { setLanguage, setTheme, switchOrganization } from "./actions";

export default async function SettingsPage({
  params,
}: PageProps<"/[locale]/settings">) {
  const locale = asLocale((await params).locale);
  setRequestLocale(locale);
  const member = await requireMember(locale);
  const t = await getTranslations("Settings");
  const roles = await getTranslations("Roles");
  const common = await getTranslations("Common");
  const db = getDb();
  const [org] = await withTenant(db, member.ctx, (tx) =>
    tx
      .select({ name: organization.name })
      .from(organization)
      .where(eq(organization.id, member.organizationId)),
  );
  const orgCount = (await listMyOrganizations(db, member.id)).length;
  const themes = [
    ["light", t("themeLight")],
    ["dark", t("themeDark")],
    ["system", t("themeSystem")],
  ] as const;
  return (
    <>
      <LargeTitle title={t("title")} />
      <Group header={t("profile")}>
        <Row title={member.name || member.email} sub={member.email} />
      </Group>
      <Group header={t("language")}>
        <form action={setLanguage} className="ios-row">
          <input type="hidden" name="locale" value={locale} />
          <div className="ios-seg" role="group" aria-label={t("language")}>
            {(["en", "fr"] as const).map((l) => (
              <button
                key={l}
                type="submit"
                name="language"
                value={l}
                aria-pressed={l === locale}
              >
                {common("localeName", { locale: l })}
              </button>
            ))}
          </div>
        </form>
      </Group>
      <Group header={t("theme")}>
        <form action={setTheme} className="ios-row">
          <input type="hidden" name="locale" value={locale} />
          <div className="ios-seg" role="group" aria-label={t("theme")}>
            {themes.map(([value, label]) => (
              <button
                key={value}
                type="submit"
                name="theme"
                value={value}
                aria-pressed={member.theme === value}
              >
                {label}
              </button>
            ))}
          </div>
        </form>
      </Group>
      <Group header={t("organization")}>
        <Row
          title={org?.name}
          sub={`${t("roles")}: ${member.roles.map((r) => roles(r)).join(" · ")}`}
        />
        {can(member.roles, "team.view") ? (
          <Row href="/settings/team" title={t("team")} />
        ) : null}
        {orgCount > 1 ? (
          <form action={switchOrganization}>
            <input type="hidden" name="locale" value={locale} />
            <button
              type="submit"
              className="ios-row"
              style={{ color: "var(--accent)", cursor: "pointer" }}
            >
              {t("switchOrg")}
            </button>
          </form>
        ) : null}
      </Group>
      <SignOutButton />
    </>
  );
}
