"use client";

import { useLocale, useTranslations } from "next-intl";
import { useId, useState } from "react";
import { authClient } from "@/lib/auth-client";

/** Magic-link sign-in. `next` is a same-site path to return to (validated server-side). */
export function SignInForm({ next }: { next: string }) {
  const t = useTranslations("Auth");
  const locale = useLocale();
  const id = useId();
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">(
    "idle",
  );

  if (state === "sent")
    return (
      <div className="ios-group">
        <div className="ios-notice" role="status">
          <strong>{t("checkTitle")}</strong>
          <p style={{ margin: "4px 0 0" }}>{t("checkBody", { email })}</p>
        </div>
        <button
          type="button"
          className="ios-btn ios-btn-plain"
          onClick={() => setState("idle")}
        >
          {t("useOther")}
        </button>
      </div>
    );

  return (
    <form
      className="ios-group"
      onSubmit={async (e) => {
        e.preventDefault();
        setState("sending");
        const { error } = await authClient.signIn.magicLink({
          email,
          callbackURL: next || `/${locale}/start`,
        });
        setState(error ? "error" : "sent");
      }}
    >
      <label htmlFor={id} className="ios-group-header">
        {t("email")}
      </label>
      <div className="ios-list">
        <input
          id={id}
          className="ios-input"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>
      {state === "error" ? (
        <p className="ios-notice ios-notice-error" role="alert">
          {t("error")}
        </p>
      ) : null}
      <button
        type="submit"
        className="ios-btn"
        disabled={state === "sending"}
        style={{ marginTop: 14 }}
      >
        {state === "sending" ? t("sending") : t("submit")}
      </button>
      <p className="ios-group-footer">{t("later")}</p>
    </form>
  );
}
