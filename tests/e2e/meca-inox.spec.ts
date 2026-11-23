import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { signInAs } from "./support/sign-in";

/** Computed background colour (read in the page; toHaveCSS missed the late-injected brand style in dev). */
const background = (page: Page, selector: string) =>
  page.locator(selector).evaluate((e) => getComputedStyle(e).backgroundColor);

/** Use case: Meca-Inox (docs/USE_CASE_MECA_INOX.md), French, industrial profile. */
const JULIEN = "julien.morel@meca-inox.example";

test("Meca-Inox: Today ranks the industrial book in French", async ({
  page,
}) => {
  await signInAs(page, JULIEN, "fr");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Aujourd’hui",
  );
  // Brand (D-058): Meca-Inox red accent and navy brand mark, from public colours.
  await expect(page.locator(".ios-brand-name")).toHaveText("Meca-Inox (démo)");
  await expect(page.locator(".ios-brand-mark")).toHaveText("MI");
  await expect
    .poll(() => background(page, ".ios-brand-mark"))
    .toBe("rgb(35, 48, 68)");
  await expect
    .poll(() => background(page, ".ios-avatar"))
    .toBe("rgb(236, 0, 27)");
  const main = page.locator("main");
  await expect(main).toContainText("Audit fournisseur à Gisors");
  await page.screenshot({
    path: "test-results/meca-inox-today.png",
    fullPage: true,
  });
  // Visual record for docs/USE_CASE_MECA_INOX.md: dark theme and phone width.
  await page.evaluate(() =>
    document.documentElement.setAttribute("data-theme", "dark"),
  );
  await page.screenshot({ path: "test-results/meca-inox-today-dark.png" });
  await page.evaluate(() =>
    document.documentElement.setAttribute("data-theme", "light"),
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: "test-results/meca-inox-today-phone.png" });
});

test("Meca-Inox: key account, relationship map and deals", async ({ page }) => {
  await signInAs(page, JULIEN, "fr");
  await page.goto("/fr/accounts");
  const list = page.locator(".ios-list").last();
  await expect(list.locator(".ios-row")).toHaveCount(10);
  await expect(list).toContainText("Robinetterie Industrielle du Nord");
  await list.getByRole("link", { name: /Chimelys Normandie/ }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Chimelys Normandie",
  );
  await expect(page.getByText("Santé du compte")).toBeVisible();
  await page.screenshot({
    path: "test-results/meca-inox-account.png",
    fullPage: true,
  });
  await page
    .locator(".ios-seg")
    .getByRole("link", { name: "Personnes" })
    .click();
  await expect(page.getByRole("table")).toContainText("Nadia Benkacem");
  await page
    .locator(".ios-seg")
    .getByRole("link", { name: "Affaires" })
    .click();
  await expect(
    page.getByText("Contrat-cadre maintenance 2027 (MRO)"),
  ).toBeVisible();
});

test("an organisation without branding keeps the default accent", async ({
  page,
}) => {
  await signInAs(page, "camille.martin@lumendata.example");
  await expect(page.locator("style[data-brand]")).toHaveCount(0);
  await expect(page.locator(".ios-brand-name")).toHaveText("Lumen Data (demo)");
  await expect
    .poll(() => background(page, ".ios-avatar"))
    .toBe("rgb(0, 122, 255)");
});
