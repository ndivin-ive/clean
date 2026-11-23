import { setRequestLocale } from "next-intl/server";
import { TabBar } from "@/components/app/tab-bar";
import { brandCss, brandInitials } from "@/domain/branding";
import { Link } from "@/i18n/navigation";
import { getDb } from "@/server/db/client";
import { asLocale } from "@/server/navigation";
import { getOrganizationBrand } from "@/server/services/organizations";
import { requireMember } from "@/server/session";

/**
 * Signed-in app shell: organisation brand mark and avatar (settings) at the
 * top, tab bar at the bottom (top on wide screens). The organisation's brand
 * colours, if set, replace the default accent (D-058).
 */
export default async function AppLayout({
  children,
  params,
}: LayoutProps<"/[locale]">) {
  const locale = asLocale((await params).locale);
  setRequestLocale(locale);
  const member = await requireMember(locale);
  const org = await getOrganizationBrand(getDb(), member.ctx);
  const initials = (member.name || member.email)
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");
  return (
    <>
      {org?.brand ? (
        // Only validated #rrggbb values reach this CSS (domain check + DB CHECK constraint).
        <style
          data-brand=""
          dangerouslySetInnerHTML={{ __html: brandCss(org.brand) }}
        />
      ) : null}
      <div className="ios-topbar">
        {org ? (
          <div className="ios-brand" data-branded={org.brand ? "" : undefined}>
            <span className="ios-brand-mark" aria-hidden="true">
              {brandInitials(org.name)}
            </span>
            <span className="ios-brand-name">{org.name}</span>
          </div>
        ) : null}
        <Link href="/settings" className="ios-avatar" aria-label={member.email}>
          {initials}
        </Link>
      </div>
      <main id="main" className="ios-page">
        {children}
      </main>
      <TabBar />
    </>
  );
}
