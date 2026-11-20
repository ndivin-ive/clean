import {
  parse,
  TYPE,
  type MessageFormatElement,
} from "@formatjs/icu-messageformat-parser";
import { describe, expect, it } from "vitest";
import en from "../../messages/en.json";
import fr from "../../messages/fr.json";

type Tree = { [key: string]: string | Tree };

function flatten(tree: Tree, prefix = ""): Record<string, string> {
  return Object.entries(tree).reduce<Record<string, string>>((acc, [k, v]) => {
    const key = prefix ? `${prefix}.${k}` : k;
    if (typeof v === "string") acc[key] = v;
    else Object.assign(acc, flatten(v, key));
    return acc;
  }, {});
}

const enFlat = flatten(en as Tree);
const frFlat = flatten(fr as Tree);

/** Argument names used by an ICU message, e.g. {count} or {locale, select, ...}. */
function placeholders(message: string): string[] {
  const names = new Set<string>();
  const walk = (elements: MessageFormatElement[]) => {
    for (const el of elements) {
      if (el.type === TYPE.literal || el.type === TYPE.pound) continue;
      names.add(el.value);
      if (el.type === TYPE.select || el.type === TYPE.plural) {
        for (const option of Object.values(el.options)) walk(option.value);
      }
      if (el.type === TYPE.tag) walk(el.children);
    }
  };
  walk(parse(message));
  return [...names].sort();
}

describe("message catalogues (rule 3: bilingual)", () => {
  it("English and French define exactly the same keys", () => {
    expect(Object.keys(frFlat).sort()).toEqual(Object.keys(enFlat).sort());
  });

  it("no message is empty", () => {
    for (const [key, value] of Object.entries({ ...enFlat, ...frFlat })) {
      expect(value.trim(), key).not.toBe("");
    }
  });

  it("every message is valid ICU syntax", () => {
    for (const [key, value] of Object.entries({ ...enFlat, ...frFlat })) {
      expect(() => parse(value), key).not.toThrow();
    }
  });

  it("every message uses the same placeholders in both languages", () => {
    for (const key of Object.keys(enFlat)) {
      expect(placeholders(frFlat[key]!), key).toEqual(
        placeholders(enFlat[key]!),
      );
    }
  });
});
