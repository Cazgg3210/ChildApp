import { expect, test, type Browser } from "@playwright/test";
import { ACCOUNTS, login, register, uniqueEmail } from "./helpers";

async function asUser(browser: Browser, email: string) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  await login(page, email);
  return { ctx, page };
}

/**
 * Platform administration: a guardian cannot reach /admin; the platform admin
 * verifies a freshly created institution from the panel and the badge shows up
 * for the institution's own admin.
 */
test("platform admin verifies an institution from /admin", async ({ page, browser }) => {
  // A new institution admin creates an institution (unverified by default).
  const email = uniqueEmail("kinder");
  await register(page, "Directora Prueba", email);
  await page.goto("/institution/new");
  const name = `Kinder Panel ${Date.now()}`;
  await page.getByLabel("Nombre").fill(name);
  await page.getByRole("button", { name: "Crear institución" }).click();
  await page.waitForURL(/\/institution\/(?!new)[a-z0-9]+$/);
  const institutionUrl = page.url();
  await expect(page.getByText("Sin verificar").first()).toBeVisible();
  // Guardians / institution admins get a 404 on the platform area.
  await page.goto("/admin");
  await expect(page.getByText(/No encontramos lo que buscas|This page could not be found|404/)).toBeVisible();

  const admin = await asUser(browser, ACCOUNTS.platformAdmin);
  await admin.page.goto("/admin");
  await expect(admin.page.getByRole("heading", { level: 1, name: "Plataforma" })).toBeVisible();
  await admin.page.goto(`/admin/institutions?q=${encodeURIComponent(name)}`);
  const row = admin.page.locator("li", { hasText: name });
  await row.getByRole("button", { name: "Verificar" }).click();
  await expect(row.getByText("Verificada", { exact: true })).toBeVisible();

  await page.goto(institutionUrl);
  await expect(page.getByText("Verificada", { exact: true }).first()).toBeVisible();
  await admin.ctx.close();
});
