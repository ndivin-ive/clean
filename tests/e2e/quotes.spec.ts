import { expect, test } from "@playwright/test";
import { signInAs } from "./support/sign-in";

/** Quotes (D-060): seller creates and sends; the customer, without an account, accepts. */
const JULIEN = "julien.morel@meca-inox.example";

test("quote: create from a deal, send, customer accepts, seller marks the deal won", async ({
  page,
  browser,
}) => {
  await signInAs(page, JULIEN, "fr");
  await page.goto("/fr/deals");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Affaires");
  // Seeded quotes are listed with their status.
  await expect(
    page.getByRole("link", { name: /DEV-2026-0003 · Accepté/ }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: /DEV-2026-0001 · Expiré/ }),
  ).toBeVisible();

  const row = page.locator(".deal-row", { hasText: "Électrolyseur 20 MW" });
  await row.getByRole("button", { name: "Nouveau devis" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Devis en brouillon",
  );

  // Edit the prefilled line and add one: totals update live.
  const first = page.locator(".quote-line-card").first();
  await first
    .getByPlaceholder("Désignation")
    .fill("Vanne sur mesure DN600 classe 300");
  await first.getByLabel("Qté").fill("4");
  await first.getByLabel("Prix unitaire HT").fill("48500");
  await page.getByRole("button", { name: "Ajouter une ligne" }).click();
  const second = page.locator(".quote-line-card").nth(1);
  await second
    .getByPlaceholder("Désignation")
    .fill("Essais hydrauliques et rapport");
  await second.getByLabel("Prix unitaire HT").fill("6000");
  await expect(page.locator(".quote-grand")).toContainText("240 000,00");
  await page.screenshot({
    path: "test-results/quote-editor.png",
    fullPage: true,
  });

  await page.getByRole("button", { name: "Envoyer au client" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    /^Devis DEV-2026-0004$/,
  );
  await expect(page.getByText("Envoyé", { exact: true })).toBeVisible();
  const link = await page.getByLabel("Lien client").inputValue();
  expect(link).toMatch(/\/fr\/q\/[A-Za-z0-9_-]{43}$/);
  await expect(page.getByText("Pas encore consulté")).toBeVisible();
  await page.screenshot({
    path: "test-results/quote-sent.png",
    fullPage: true,
  });

  // The customer: a fresh browser context, no session.
  const customer = await browser.newContext();
  const c = await customer.newPage();
  await c.goto(new URL(link).pathname);
  await expect(
    c.getByText("Meca-Inox (démo) SAS vous a adressé ce devis."),
  ).toBeVisible();
  await expect(c.locator(".quote-doc-grand")).toContainText("240 000,00");
  await c.screenshot({
    path: "test-results/quote-customer.png",
    fullPage: true,
  });
  await c.getByLabel("Votre nom").first().fill("Antoine Perrin");
  await c.getByLabel("Votre fonction (facultatif)").fill("Directeur technique");
  await c
    .getByLabel("Bon pour accord : j’accepte ce devis et ses conditions.")
    .check();
  await c.getByRole("button", { name: "Accepter le devis" }).click();
  await expect(
    c.getByText(/Ce devis a été accepté le .* par Antoine Perrin\./),
  ).toBeVisible();
  await expect(
    c.getByRole("button", { name: "Accepter le devis" }),
  ).toHaveCount(0);
  await c.screenshot({
    path: "test-results/quote-customer-accepted.png",
    fullPage: true,
  });
  // The customer page never exposes the app.
  await c.goto("/fr/deals");
  await expect(c).toHaveURL(/\/fr\/(sign-in|start)/);
  await customer.close();

  // Back to the seller: accepted, viewed; the deal moves only on the seller's decision.
  await page.reload();
  await expect(page.getByText("Accepté", { exact: true })).toBeVisible();
  await expect(page.getByText(/Accepté par Antoine Perrin le/)).toBeVisible();
  await expect(page.getByText(/Consulté par le client le/)).toBeVisible();
  await page
    .getByRole("button", { name: "Passer l’affaire en gagnée" })
    .click();
  await expect(page.getByText("Affaire passée en gagnée.")).toBeVisible();
  await page.goto("/fr/deals");
  const won = page.locator(".ios-group", { hasText: "Clôturées" });
  await expect(won).toContainText("Électrolyseur 20 MW");
});

test("quote: an invalid or replaced link shows a clear message", async ({
  page,
}) => {
  await page.goto("/fr/q/" + "a".repeat(43));
  await expect(
    page.getByText("Ce lien n’est pas valide.", { exact: false }),
  ).toBeVisible();
});
