import { expect, type Page } from "@playwright/test";
import { firstLink, waitForMail } from "./mail-sink";

export const SELLER = "camille.martin@lumendata.example";

/** Sign in with a magic link from the local mail sink and wait for Today. */
export async function signInAs(
  page: Page,
  email: string,
  locale: "en" | "fr" = "en",
) {
  await page.goto(`/${locale}/sign-in`);
  const since = Date.now();
  await page
    .getByLabel(locale === "en" ? "Work email" : "E-mail professionnel")
    .fill(email);
  await page
    .getByRole("button", {
      name:
        locale === "en"
          ? "Email me a sign-in link"
          : "Recevoir un lien de connexion",
    })
    .click();
  await page.goto(firstLink(await waitForMail(email, since)));
  await expect(page).toHaveURL(new RegExp(`/${locale}/today$`));
}
