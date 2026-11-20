"use client";

import { useTranslations } from "next-intl";
import {
  IconAccounts,
  IconDeals,
  IconPipeline,
  IconPlus,
  IconToday,
} from "@/components/ios/icons";
import { Link, usePathname } from "@/i18n/navigation";

const TABS = [
  { key: "today", href: "/today", Icon: IconToday },
  { key: "accounts", href: "/accounts", Icon: IconAccounts },
  { key: "capture", href: "/capture", Icon: null },
  { key: "deals", href: "/deals", Icon: IconDeals },
  { key: "pipeline", href: "/pipeline", Icon: IconPipeline },
] as const;

export function TabBar() {
  const t = useTranslations("Tabs");
  const pathname = usePathname();
  return (
    <nav className="ios-tabbar" aria-label="CLEAN">
      {TABS.map(({ key, href, Icon }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={key}
            href={href}
            className={`ios-tab ${key === "capture" ? "ios-tab-capture" : ""}`}
            aria-current={active ? "page" : undefined}
          >
            {Icon ? (
              <Icon />
            ) : (
              <span className="ios-plus">
                <IconPlus />
              </span>
            )}
            <span>{t(key)}</span>
          </Link>
        );
      })}
    </nav>
  );
}
