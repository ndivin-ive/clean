import { describe, expect, it } from "vitest";
import {
  brandCss,
  brandInitials,
  brandTokens,
  contrast,
  isHex,
} from "@/domain/branding";

describe("branding", () => {
  it("computes WCAG contrast ratios", () => {
    expect(contrast("#ffffff", "#000000")).toBeCloseTo(21, 0);
    expect(contrast("#007aff", "#007aff")).toBe(1);
  });

  it("keeps AA contrast for the accent on light and dark cards", () => {
    for (const color of [
      "#EC001B",
      "#ffd60a",
      "#34c759",
      "#233044",
      "#007aff",
    ]) {
      const t = brandTokens({ color });
      expect(contrast(t.light.accent, "#ffffff")).toBeGreaterThanOrEqual(4.5);
      expect(contrast(t.dark.accent, "#1c1c1e")).toBeGreaterThanOrEqual(4.5);
      expect(
        contrast(t.light.foreground, t.light.accent),
      ).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("keeps a brand colour that already passes (Meca-Inox red on white)", () => {
    const t = brandTokens({ color: "#EC001B", ink: "#233044" });
    expect(t.light.accent).toBe("#ec001b");
    expect(t.light.foreground).toBe("#ffffff");
    expect(t.mark).toEqual({ background: "#233044", foreground: "#ffffff" });
    expect(t.dark.accent).not.toBe("#ec001b"); // lightened for the dark theme
  });

  it("rejects anything but #rrggbb, so CSS cannot be injected", () => {
    expect(isHex("#EC001B")).toBe(true);
    for (const bad of ["red", "#fff", "#EC001B;}body{x:y", "", null, undefined])
      expect(isHex(bad)).toBe(false);
    expect(() => brandCss({ color: "#000;}*{display:none" })).toThrow();
  });

  it("emits overrides for light, system-dark and dark themes", () => {
    const css = brandCss({ color: "#EC001B" });
    expect(css).toContain(":root{--accent:#ec001b;");
    expect(css).toContain(':root:not([data-theme="light"])');
    expect(css).toContain(':root[data-theme="dark"]');
  });

  it("derives initials for the brand mark", () => {
    expect(brandInitials("Meca-Inox (démo)")).toBe("MI");
    expect(brandInitials("Lumen Data (demo)")).toBe("LD");
    expect(brandInitials("Éclat")).toBe("É");
  });
});
