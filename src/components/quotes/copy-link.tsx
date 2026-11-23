"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

/** Read-only link field with a copy button (the link is shown once, D-060). */
export function CopyLink({ url }: { url: string }) {
  const t = useTranslations("Quotes");
  const [copied, setCopied] = useState(false);
  return (
    <div className="ios-row" style={{ gap: 8, flexWrap: "wrap" }}>
      <input
        className="ios-input quote-link"
        readOnly
        value={url}
        aria-label={t("linkTitle")}
        onFocus={(e) => e.currentTarget.select()}
      />
      <button
        type="button"
        className="ios-btn ios-btn-sm"
        onClick={async () => {
          await navigator.clipboard?.writeText(url).catch(() => undefined);
          setCopied(true);
        }}
      >
        {copied ? t("copied") : t("copy")}
      </button>
    </div>
  );
}

/** Opens the browser's print dialog (print stylesheet keeps only the document). */
export function PrintButton({ label }: { label: string }) {
  return (
    <button
      type="button"
      className="ios-btn ios-btn-plain no-print"
      onClick={() => window.print()}
    >
      {label}
    </button>
  );
}
