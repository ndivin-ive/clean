import { expect, test } from "@playwright/test";

test("root redirects to a locale", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/(en|fr)$/);
});

test.describe("landing page in both languages", () => {
  test("English", async ({ page }) => {
    await page.goto("/en");
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      "Know what matters today",
    );
    await expect(page.getByRole("heading", { name: "Capture" })).toBeVisible();
  });

  test("French", async ({ page }) => {
    await page.goto("/fr");
    await expect(page.locator("html")).toHaveAttribute("lang", "fr");
    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      "Savoir ce qui compte",
    );
    await expect(page.getByRole("heading", { name: "Capter" })).toBeVisible();
  });

  test("language switcher changes locale and keeps the page", async ({
    page,
  }) => {
    await page.goto("/en");
    await page.getByLabel("Language").selectOption("fr");
    await expect(page).toHaveURL(/\/fr$/);
    await expect(page.getByLabel("Langue")).toHaveValue("fr");
  });
});
