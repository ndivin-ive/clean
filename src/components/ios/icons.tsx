/** Icons drawn for CLEAN (no SF Symbols, D-040). Decorative: aria-hidden. */
const base = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  "aria-hidden": true,
} as const;

export const IconToday = () => (
  <svg {...base} strokeWidth={1.8} strokeLinecap="round">
    <circle cx="12" cy="12" r="4.2" />
    <path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M5.3 18.7l1.6-1.6M17.1 6.9l1.6-1.6" />
  </svg>
);
export const IconAccounts = () => (
  <svg {...base} strokeWidth={1.8} strokeLinejoin="round">
    <path d="M4 21V5.5L12 3v18M12 8h8v13M2.5 21h19" />
    <path d="M7 8h2M7 12h2M7 16h2M15 12h2M15 16h2" strokeLinecap="round" />
  </svg>
);
export const IconDeals = () => (
  <svg {...base} strokeWidth={1.8} strokeLinejoin="round">
    <rect x="3" y="7" width="18" height="13" rx="2.5" />
    <path d="M8.5 7V5.5A1.5 1.5 0 0 1 10 4h4a1.5 1.5 0 0 1 1.5 1.5V7M3 12.5h18" />
  </svg>
);
export const IconPipeline = () => (
  <svg {...base} strokeWidth={1.8} strokeLinecap="round">
    <path d="M4 6h16M4 10.5h11M4 15h7M4 19.5h4" />
  </svg>
);
export const IconPlus = () => (
  <svg {...base} strokeWidth={2.4} strokeLinecap="round">
    <path d="M12 5v14M5 12h14" />
  </svg>
);
export const Chevron = () => (
  <svg
    className="ios-chevron"
    viewBox="0 0 8 13"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    <path d="M1.5 1.5 6.5 6.5 1.5 11.5" />
  </svg>
);
export const BackChevron = () => (
  <svg
    width="12"
    height="20"
    viewBox="0 0 13 22"
    fill="none"
    stroke="currentColor"
    strokeWidth={2.6}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    <path d="M11 2 2 11l9 9" />
  </svg>
);
