/** The five CLEAN steps, in order. Labels live in the message catalogues. */
export const cleanSteps = [
  "capture",
  "link",
  "engage",
  "analyse",
  "negotiate",
] as const;

export type CleanStep = (typeof cleanSteps)[number];

/** The acronym is the first letter of each step (same in EN and FR). */
export function acronym(letters: Record<CleanStep, string>): string {
  return cleanSteps.map((step) => letters[step]).join("");
}
