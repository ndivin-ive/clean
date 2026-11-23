import { expect, test } from "@playwright/test";
import { signInAs } from "./support/sign-in";

/** Use case: Meca-Inox (docs/USE_CASE_MECA_INOX.md), French, industrial profile. */
const JULIEN = "julien.morel@meca-inox.example";

test("Meca-Inox: Today ranks the industrial book in French", async ({
  page,
}) => {
  await signInAs(page, JULIEN, "fr");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Aujourd’hui",
  );
  const main = page.locator("main");
  await expect(main).toContainText("Audit fournisseur à Gisors");
  await page.screenshot({
    path: "test-results/meca-inox-today.png",
    fullPage: true,
  });
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
