import { expect, test } from "@playwright/test";
import { firstLink, waitForMail } from "./support/mail-sink";

const SELLER = "camille.martin@lumendata.example";

for (const locale of ["en", "fr"] as const) {
  test(`the demo seller sees today's ranked actions with reasons (${locale})`, async ({
    page,
  }) => {
    await page.goto(`/${locale}/sign-in`);
    const since = Date.now();
    await page
      .getByLabel(locale === "en" ? "Work email" : "E-mail professionnel")
      .fill(SELLER);
    await page
      .getByRole("button", {
        name:
          locale === "en"
            ? "Email me a sign-in link"
            : "Recevoir un lien de connexion",
      })
      .click();
    await page.goto(firstLink(await waitForMail(SELLER, since)));
    await expect(page).toHaveURL(new RegExp(`/${locale}/today$`));

    const focus = page.locator(".ios-group", {
      has: page.getByRole("heading", {
        name: locale === "en" ? "Focus" : "Priorités",
      }),
    });
    await expect(focus.locator(".ios-row")).toHaveCount(7);
    // The story: the stalled Halden deal and the Eskerfield workshop are on the list, each with a reason.
    await expect(focus).toContainText(
      locale === "en"
        ? "Unblock Claims data modernisation: 41 days in Discovery"
        : "Débloquer Claims data modernisation : 41 jours en Découverte",
    );
    await expect(focus).toContainText(
      locale === "en"
        ? "Typical time in Discovery: 21 days."
        : "Durée habituelle en Découverte : 21 jours.",
    );
    await expect(focus).toContainText(
      locale === "en"
        ? "Prepare for Discovery workshop · Eskerfield Bank"
        : "Préparer Discovery workshop · Eskerfield Bank",
    );
  });
}
