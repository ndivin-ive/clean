"use client";

import { useTranslations } from "next-intl";
import { useTransition } from "react";
import { authClient } from "@/lib/auth-client";
import { useRouter } from "@/i18n/navigation";

export function SignOutButton() {
  const t = useTranslations("Common");
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      className="ios-btn ios-btn-danger"
      disabled={pending}
      onClick={() =>
        start(async () => {
          await authClient.signOut();
          router.replace("/sign-in");
          router.refresh();
        })
      }
    >
      {t("signOut")}
    </button>
  );
}
