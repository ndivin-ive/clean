import { expect, test, type Page } from "@playwright/test";
import { firstLink, waitForMail } from "./support/mail-sink";

const unique = (tag: string) =>
  `${tag}-${Date.now()}-${Math.floor(Math.random() * 1e4)}@example.test`;

/** Request a magic link on the sign-in page and follow it from the email. */
async function signIn(
  page: Page,
  locale: "en" | "fr",
  email: string,
  path = `/${locale}/sign-in`,
) {
  await page.goto(path);
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
  await expect(page.getByRole("status")).toContainText(email);
  const mail = await waitForMail(email, since);
  expect(mail.subject).toBe(
    locale === "en"
      ? "Your CLEAN sign-in link"
      : "Votre lien de connexion CLEAN",
  );
  await page.goto(firstLink(mail));
}

for (const locale of ["en", "fr"] as const) {
  test(`sign in with a magic link and create an organisation (${locale})`, async ({
    page,
  }) => {
    const L =
      locale === "en"
        ? {
            onboarding: "Create your organisation",
            name: "Organisation name",
            submit: "Create organisation",
            today: "Today",
            accounts: "Accounts",
          }
        : {
            onboarding: "Créez votre organisation",
            name: "Nom de l’organisation",
            submit: "Créer l’organisation",
            today: "Aujourd’hui",
            accounts: "Comptes",
          };
    await signIn(page, locale, unique(`owner-${locale}`));
    await expect(page).toHaveURL(new RegExp(`/${locale}/onboarding$`));
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      L.onboarding,
    );
    await page.getByLabel(L.name).fill(`Demo ${locale.toUpperCase()}`);
    await page.getByRole("button", { name: L.submit }).click();
    await expect(page).toHaveURL(new RegExp(`/${locale}/today$`));
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(L.today);
    await page.getByRole("link", { name: L.accounts }).click();
    await expect(page).toHaveURL(new RegExp(`/${locale}/accounts$`));
    await expect(page.locator('.ios-tab[aria-current="page"]')).toContainText(
      L.accounts,
    );
  });
}

test("signed-out visitors are sent to sign-in", async ({ page }) => {
  await page.goto("/en/today");
  await expect(page).toHaveURL(/\/en\/sign-in$/);
});

test("appearance and language are saved per user", async ({ page }) => {
  await signIn(page, "en", unique("prefs"));
  await page.getByLabel("Organisation name").fill("Prefs Ltd");
  await page.getByRole("button", { name: "Create organisation" }).click();
  await expect(page).toHaveURL(/\/en\/today$/);
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.goto("/en/settings");
  await page.getByRole("button", { name: "Dark" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.getByRole("button", { name: "Français" }).click();
  await expect(page).toHaveURL(/\/fr\/settings$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Réglages");
});

test("an admin invites a seller who signs in and joins", async ({
  page,
  browser,
}) => {
  const adminEmail = unique("admin");
  const sellerEmail = unique("seller");
  await signIn(page, "en", adminEmail);
  await page.getByLabel("Organisation name").fill("Invite Co");
  await page.getByRole("button", { name: "Create organisation" }).click();
  await expect(page).toHaveURL(/\/en\/today$/);
  await page.goto("/en/settings/team");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Team and access",
  );

  const since = Date.now();
  await page.getByPlaceholder("Email").fill(sellerEmail);
  await page.getByRole("button", { name: "Send invitation" }).click();
  await expect(page.getByRole("status")).toContainText(sellerEmail);
  const invite = await waitForMail(sellerEmail, since);
  expect(invite.subject).toBe("Join Invite Co on CLEAN");

  const seller = await (await browser.newContext()).newPage();
  await seller.goto(firstLink(invite));
  await seller.getByRole("link", { name: "Sign in" }).click();
  await expect(seller).toHaveURL(/\/en\/sign-in\?next=/);
  const since2 = Date.now();
  await seller.getByLabel("Work email").fill(sellerEmail);
  await seller.getByRole("button", { name: "Email me a sign-in link" }).click();
  await seller.goto(firstLink(await waitForMail(sellerEmail, since2)));
  await expect(seller).toHaveURL(/\/en\/invite\//);
  await seller.getByRole("button", { name: "Accept the invitation" }).click();
  await expect(seller).toHaveURL(/\/en\/today$/);

  await page.reload();
  await expect(page.getByText(sellerEmail).first()).toBeVisible();
  // Team visibility switch (admin only) saves immediately.
  await page.getByRole("checkbox", { name: "Team visibility" }).check();
  await expect(page.getByRole("status")).toContainText("Saved");
  await expect(
    page.getByRole("checkbox", { name: "Team visibility" }),
  ).toBeChecked();
});
