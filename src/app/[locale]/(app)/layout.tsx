import { setRequestLocale } from "next-intl/server";
import { TabBar } from "@/components/app/tab-bar";
import { Link } from "@/i18n/navigation";
import { asLocale } from "@/server/navigation";
import { requireMember } from "@/server/session";

/** Signed-in app shell: avatar (settings) at the top, tab bar at the bottom (top on wide screens). */
export default async function AppLayout({
  children,
  params,
}: LayoutProps<"/[locale]">) {
  const locale = asLocale((await params).locale);
  setRequestLocale(locale);
  const member = await requireMember(locale);
  const initials = (member.name || member.email)
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");
  return (
    <>
      <div className="ios-topbar">
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
