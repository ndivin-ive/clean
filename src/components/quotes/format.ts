/** Locale-aware money and date formatting for quote documents. */
export const intlLocale = (l: "en" | "fr") => (l === "fr" ? "fr-FR" : "en-GB");

export function money(n: number, currency: string, locale: "en" | "fr") {
  return new Intl.NumberFormat(intlLocale(locale), {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

export function number(n: number, locale: "en" | "fr") {
  return new Intl.NumberFormat(intlLocale(locale), {
    maximumFractionDigits: 2,
  }).format(n);
}

export function longDate(d: string | Date, locale: "en" | "fr") {
  const date =
    typeof d === "string" ? new Date(`${d.slice(0, 10)}T12:00:00Z`) : d;
  return new Intl.DateTimeFormat(intlLocale(locale), {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Europe/Paris",
  }).format(date);
}

export function dateTime(d: string | Date, locale: "en" | "fr") {
  return new Intl.DateTimeFormat(intlLocale(locale), {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Paris",
  }).format(typeof d === "string" ? new Date(d) : d);
}
