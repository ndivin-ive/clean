/**
 * Per-organisation branding (D-058): an accent colour and a dark "ink" colour,
 * applied to the app shell. Colours are adjusted so that text and controls keep
 * WCAG AA contrast (4.5:1) on the light and dark grouped backgrounds. No logos
 * are stored or copied: the brand mark is the organisation's initials.
 */

export const HEX = /^#[0-9a-f]{6}$/i;

export interface Brand {
  /** Accent: buttons, links, selected tab. */
  color: string;
  /** Dark brand colour for the brand mark (optional). */
  ink?: string | null;
}

export interface BrandTokens {
  light: { accent: string; soft: string; foreground: string };
  dark: { accent: string; soft: string; foreground: string };
  mark: { background: string; foreground: string };
}

const LIGHT_CARD = "#ffffff";
const DARK_CARD = "#1c1c1e";
const AA = 4.5;

export function isHex(v: unknown): v is string {
  return typeof v === "string" && HEX.test(v);
}

function rgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function toHex([r, g, b]: [number, number, number]): string {
  return `#${[r, g, b].map((c) => Math.round(c).toString(16).padStart(2, "0")).join("")}`;
}

/** WCAG relative luminance. */
export function luminance(hex: string): number {
  const [r, g, b] = rgb(hex).map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio between two colours (1–21). */
export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [
    number,
    number,
  ];
  return (hi + 0.05) / (lo + 0.05);
}

/** Mix `hex` towards `target` until it reaches `ratio` against `bg` (small steps, keeps the hue). */
function reach(hex: string, target: string, bg: string, ratio = AA): string {
  const from = rgb(hex);
  const to = rgb(target);
  for (let t = 0; t <= 1.0001; t += 0.02) {
    const c = toHex(
      [0, 1, 2].map((i) => from[i]! + (to[i]! - from[i]!) * t) as [
        number,
        number,
        number,
      ],
    );
    if (contrast(c, bg) >= ratio) return c;
  }
  return target;
}

function softOf(hex: string, alpha: number): string {
  const [r, g, b] = rgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** Text colour (white or black) with the better contrast on `bg`. */
export function onColor(bg: string): string {
  return contrast("#ffffff", bg) >= contrast("#000000", bg)
    ? "#ffffff"
    : "#000000";
}

export function brandTokens(brand: Brand): BrandTokens {
  if (!isHex(brand.color)) throw new Error("Brand colour must be #rrggbb");
  const light = reach(brand.color.toLowerCase(), "#000000", LIGHT_CARD);
  const dark = reach(brand.color.toLowerCase(), "#ffffff", DARK_CARD);
  const ink = isHex(brand.ink) ? brand.ink.toLowerCase() : light;
  return {
    light: {
      accent: light,
      soft: softOf(light, 0.12),
      foreground: onColor(light),
    },
    dark: { accent: dark, soft: softOf(dark, 0.2), foreground: onColor(dark) },
    mark: { background: ink, foreground: onColor(ink) },
  };
}

/**
 * CSS overriding the default accent tokens, using the same selectors as
 * globals.css. Only validated hex values reach this string.
 */
export function brandCss(brand: Brand): string {
  const t = brandTokens(brand);
  const vars = (v: BrandTokens["light"]) =>
    `--accent:${v.accent};--accent-soft:${v.soft};--accent-foreground:${v.foreground};`;
  const mark = `--brand-mark:${t.mark.background};--brand-mark-foreground:${t.mark.foreground};`;
  return [
    `:root{${vars(t.light)}${mark}}`,
    `@media (prefers-color-scheme: dark){:root:not([data-theme="light"]){${vars(t.dark)}}}`,
    `:root[data-theme="dark"]{${vars(t.dark)}}`,
  ].join("");
}

/** Up to two initials for the brand mark ("Meca-Inox (démo)" → "MI"). */
export function brandInitials(name: string): string {
  return name
    .replace(/\(.*?\)/g, "")
    .split(/[\s\-–_]+/)
    .filter((w) => /\p{L}/u.test(w))
    .slice(0, 2)
    .map((w) => w.match(/\p{L}/u)![0]!.toUpperCase())
    .join("");
}
