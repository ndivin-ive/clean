import { describe, expect, it } from "vitest";
import { acronym, cleanSteps } from "@/domain/clean-steps";
import en from "../../messages/en.json";
import fr from "../../messages/fr.json";

describe("CLEAN steps", () => {
  it("has five steps in order", () => {
    expect(cleanSteps).toEqual([
      "capture",
      "link",
      "engage",
      "analyse",
      "negotiate",
    ]);
  });

  it.each([
    ["en", en],
    ["fr", fr],
  ])("spells CLEAN in %s", (_locale, messages) => {
    const letters = Object.fromEntries(
      cleanSteps.map((s) => [s, messages.Landing.steps[s].letter]),
    ) as Record<(typeof cleanSteps)[number], string>;
    expect(acronym(letters)).toBe("CLEAN");
  });

  it.each([
    ["en", en],
    ["fr", fr],
  ])("each step name starts with its letter in %s", (_locale, messages) => {
    for (const step of cleanSteps) {
      const { letter, name } = messages.Landing.steps[step];
      expect(name.startsWith(letter)).toBe(true);
    }
  });
});
