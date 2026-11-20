import { expect, test } from "@playwright/test";
import { SELLER, signInAs } from "./support/sign-in";

test("accounts list: tiers, health and next action; account page tabs", async ({
  page,
}) => {
  await signInAs(page, SELLER);
  await page.getByRole("link", { name: "Accounts" }).first().click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Accounts");
  const list = page.locator(".ios-list").last();
  await expect(list.locator(".ios-row")).toHaveCount(10);

  await page.locator(".ios-seg").getByRole("link", { name: "Key" }).click();
  await expect(list.locator(".ios-row")).toHaveCount(2);
  // highest-scored action for Arvalis
  await expect(list).toContainText(
    "Do the next step on Warehouse analytics expansion",
  );

  await list.getByRole("link", { name: /Arvalis Logistics/ }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Arvalis Logistics",
  );
  // Health shows its reasons (2 roles covered + 2 weak at half weight = 3 of 5).
  await expect(page.getByText("Key roles covered")).toBeVisible();
  await expect(page.getByText("3 of 5 key roles")).toBeVisible();

  await page.locator(".ios-seg").getByRole("link", { name: "People" }).click();
  await expect(page.getByRole("table", { name: "map" })).toContainText(
    "Karim Benali",
  );
  await expect(page.getByText("Technical evaluator · Missing")).toBeVisible();

  await page
    .locator(".ios-seg")
    .getByRole("link", { name: "Timeline" })
    .click();
  await expect(
    page.getByText("Quarterly business review · Arvalis"),
  ).toBeVisible();
  await expect(
    page.getByText(
      "Quarterly review with Nathalie: renewal on track, wants a roadmap for transport.",
    ),
  ).toBeVisible();

  await page.locator(".ios-seg").getByRole("link", { name: "Deals" }).click();
  await expect(page.getByText("Warehouse analytics expansion")).toBeVisible();
});

test("account page in French, and search", async ({ page }) => {
  await signInAs(page, SELLER, "fr");
  await page.goto("/fr/accounts?q=esker");
  const list = page.locator(".ios-list").last();
  await expect(list.locator(".ios-row")).toHaveCount(1);
  await list.getByRole("link", { name: /Eskerfield Bank/ }).click();
  await expect(page.getByText("Santé du compte")).toBeVisible();
  await page
    .locator(".ios-seg")
    .getByRole("link", { name: "Personnes" })
    .click();
  await expect(page.getByText("Décideur budgétaire · Fragile")).toBeVisible();
});

test("someone else's account is not found", async ({ page }) => {
  await signInAs(page, SELLER);
  const res = await page.goto(
    "/en/accounts/00000000-0000-4000-8000-000000000000",
  );
  expect(res?.status()).toBe(404);
});
