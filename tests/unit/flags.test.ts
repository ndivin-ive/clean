import { describe, expect, it } from "vitest";
import { FLAGS, resolveFlag } from "@/domain/flags";

describe("feature flags", () => {
  it("support requests are parked (off) by default", () => {
    expect(FLAGS.support_requests).toBe(false);
    expect(resolveFlag("support_requests", new Map())).toBe(false);
  });
  it("a stored value overrides the default", () => {
    expect(
      resolveFlag("support_requests", new Map([["support_requests", true]])),
    ).toBe(true);
  });
});
