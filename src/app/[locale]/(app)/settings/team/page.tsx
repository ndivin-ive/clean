import {
  getFormatter,
  getTranslations,
  setRequestLocale,
} from "next-intl/server";
import { redirect } from "next/navigation";
import { AutoSubmitSwitch } from "@/components/app/auto-submit-switch";
import { BackChevron } from "@/components/ios/icons";
import { Group, LargeTitle } from "@/components/ios/list";
import { can, type Role } from "@/domain/permissions";
import { Link } from "@/i18n/navigation";
import { getDb } from "@/server/db/client";
import { asLocale } from "@/server/navigation";
import { listMembers } from "@/server/services/team";
import { requireMember } from "@/server/session";
import { inviteAction, updateMemberAction, visibilityAction } from "./actions";

const ROLES: Role[] = ["seller", "manager", "admin", "specialist"];
const ERRORS = ["forbidden", "invalidEmail", "ownAdmin", "error"] as const;

export default async function TeamPage({
  params,
  searchParams,
}: PageProps<"/[locale]/settings/team">) {
  const locale = asLocale((await params).locale);
  setRequestLocale(locale);
  const member = await requireMember(locale);
  if (!can(member.roles, "team.view")) redirect(`/${locale}/settings`);
  const sp = await searchParams;
  const t = await getTranslations("Team");
  const tr = await getTranslations("Roles");
  const ts = await getTranslations("Settings");
  const common = await getTranslations("Common");
  const format = await getFormatter();
  const { members, invitations, organization } = await listMembers(
    getDb(),
    member.ctx,
    member.roles,
  );
  const isAdmin = can(member.roles, "team.edit_roles");
  const error =
    typeof sp.error === "string" &&
    (ERRORS as readonly string[]).includes(sp.error)
      ? (sp.error as (typeof ERRORS)[number])
      : null;

  return (
    <>
      <Link href="/settings" className="ios-back">
        <BackChevron />
        {ts("title")}
      </Link>
      <LargeTitle title={t("title")} subtitle={organization.name} />
      {error ? (
        <p className="ios-notice ios-notice-error" role="alert">
          {t(error)}
        </p>
      ) : null}
      {typeof sp.invited === "string" ? (
        <p className="ios-notice" role="status">
          {t("invited", { email: sp.invited })}
        </p>
      ) : null}
      {sp.saved ? (
        <p className="ios-notice" role="status">
          {common("saved")}
        </p>
      ) : null}

      <Group header={t("visibility")} footer={t("visibilityFoot")}>
        {isAdmin ? (
          <form action={visibilityAction} className="ios-row">
            <input type="hidden" name="locale" value={locale} />
            <span className="ios-row-main">{t("visibilityOn")}</span>
            <AutoSubmitSwitch
              name="teamVisibility"
              defaultChecked={organization.teamVisibility}
              label={t("visibility")}
            />
            <noscript>
              <button type="submit">{common("save")}</button>
            </noscript>
          </form>
        ) : (
          <div className="ios-row">
            <span className="ios-row-main">{t("visibilityOn")}</span>
            <span className="ios-row-value">
              {organization.teamVisibility ? "✓" : "—"}
            </span>
          </div>
        )}
      </Group>

      {isAdmin ? (
        <Group header={t("invite")}>
          <form action={inviteAction}>
            <input type="hidden" name="locale" value={locale} />
            <label className="ios-row">
              <span className="sr-only">{t("inviteEmail")}</span>
              <input
                name="email"
                type="email"
                required
                className="ios-input"
                placeholder={t("inviteEmail")}
                style={{ padding: 0 }}
              />
            </label>
            <fieldset
              className="ios-row"
              style={{ border: 0, flexWrap: "wrap", gap: "8px 16px" }}
            >
              <legend className="sr-only">{t("inviteRoles")}</legend>
              {ROLES.filter((r) => r !== "specialist").map((r) => (
                <label
                  key={r}
                  style={{
                    display: "inline-flex",
                    gap: 6,
                    alignItems: "center",
                    fontSize: 15,
                  }}
                >
                  <input
                    type="checkbox"
                    name="roles"
                    value={r}
                    defaultChecked={r === "seller"}
                  />
                  {tr(r)}
                </label>
              ))}
            </fieldset>
            <div className="ios-row">
              <button type="submit" className="ios-btn ios-btn-secondary">
                {t("inviteSend")}
              </button>
            </div>
          </form>
        </Group>
      ) : null}

      <Group header={t("members")}>
        {members.map((m) =>
          isAdmin ? (
            <form
              key={m.userId}
              action={updateMemberAction}
              className="ios-row"
              style={{ flexDirection: "column", alignItems: "stretch", gap: 8 }}
            >
              <input type="hidden" name="locale" value={locale} />
              <input type="hidden" name="userId" value={m.userId} />
              <span className="ios-row-main">
                <span>
                  {m.name || m.email}
                  {m.userId === member.id ? ` (${common("you")})` : ""}
                </span>
                <span className="ios-row-sub">{m.email}</span>
              </span>
              <span
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "6px 14px",
                  fontSize: 15,
                }}
              >
                {ROLES.map((r) => (
                  <label
                    key={r}
                    style={{
                      display: "inline-flex",
                      gap: 6,
                      alignItems: "center",
                    }}
                  >
                    <input
                      type="checkbox"
                      name="roles"
                      value={r}
                      defaultChecked={m.roles.includes(r)}
                    />
                    {tr(r)}
                  </label>
                ))}
              </span>
              <span
                style={{
                  display: "flex",
                  gap: 8,
                  alignItems: "center",
                  flexWrap: "wrap",
                }}
              >
                <label className="ios-row-sub" htmlFor={`mgr-${m.userId}`}>
                  {t("manager")}
                </label>
                <select
                  id={`mgr-${m.userId}`}
                  name="managerUserId"
                  className="ios-select"
                  defaultValue={m.managerUserId ?? ""}
                >
                  <option value="">{t("noManager")}</option>
                  {members
                    .filter((x) => x.userId !== m.userId)
                    .map((x) => (
                      <option key={x.userId} value={x.userId}>
                        {x.name || x.email}
                      </option>
                    ))}
                </select>
                <button
                  type="submit"
                  className="ios-btn ios-btn-sm ios-btn-secondary"
                >
                  {t("edit")}
                </button>
              </span>
            </form>
          ) : (
            <div key={m.userId} className="ios-row">
              <span className="ios-row-main">
                <span>{m.name || m.email}</span>
                <span className="ios-row-sub">
                  {m.roles.map((r) => tr(r)).join(" · ")}
                </span>
              </span>
            </div>
          ),
        )}
      </Group>

      {invitations.length ? (
        <Group header={t("pending")}>
          {invitations.map((i) => (
            <div key={i.id} className="ios-row">
              <span className="ios-row-main">
                <span>{i.email}</span>
                <span className="ios-row-sub">
                  {i.roles.map((r) => tr(r)).join(" · ")} ·{" "}
                  {t("expires", {
                    date: format.dateTime(i.expiresAt, {
                      day: "numeric",
                      month: "short",
                    }),
                  })}
                </span>
              </span>
            </div>
          ))}
        </Group>
      ) : null}
    </>
  );
}
