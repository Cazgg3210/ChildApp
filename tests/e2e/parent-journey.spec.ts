import { expect, test } from "@playwright/test";
import { createChildViaWizard, register, shareWithBabysitter, uniqueEmail } from "./helpers";

/**
 * Journey 1 — Parent: register → create child → complete critical info →
 * share with a babysitter → permission preview → link/QR → caregiver reviews →
 * parent sees the access log. Scenarios A, B, D and H.
 */
test("parent creates a child, shares care and sees who accessed it", async ({ page, browser }) => {
  const email = uniqueEmail("parent");
  await register(page, "Luis Prueba", email);

  const childId = await createChildViaWizard(page, "Mateo");
  await page.goto(`/app/children/${childId}`);
  await expect(page.getByRole("heading", { level: 1, name: "Mateo" })).toBeVisible();
  await expect(page.getByText("Cacahuate")).toBeVisible();
  await expect(page.getByText("Andrea Molina")).toBeVisible();

  // Add a critical item from the health section (versioned + audited).
  await page.goto(`/app/children/${childId}/profile/health`);
  await page.getByRole("button", { name: "Agregar" }).first().click();
  await page.getByLabel("Tipo").selectOption("MEDICATION");
  await page.getByLabel("Título").fill("Montelukast 4 mg");
  await page.getByLabel("Dosis").fill("4 mg");
  await page.getByLabel("Horario").fill("21:00");
  await page.getByRole("button", { name: "Guardar" }).click();
  await expect(page.getByText("Montelukast 4 mg")).toBeVisible();

  const url = await shareWithBabysitter(page, childId, { name: "Carla" });
  expect(url).toMatch(/\/s\/[A-Za-z0-9_-]{43}$/);

  // The caregiver opens the link on another device (fresh context, no session).
  const caregiver = await browser.newContext({ ...test.info().project.use, viewport: { width: 390, height: 844 } });
  const cg = await caregiver.newPage();
  await cg.goto(url);
  await expect(cg.getByRole("heading", { level: 1 })).toHaveText(/mateo/i);
  await expect(cg.getByRole("heading", { name: "IMPORTANTE" })).toBeVisible();
  await expect(cg.getByText("Cacahuate")).toBeVisible();
  await expect(cg.getByText("Montelukast 4 mg")).toBeVisible();
  await cg.getByRole("button", { name: /He revisado la información crítica/ }).click();
  await expect(cg.getByText(/Revisado hace/)).toBeVisible();
  await caregiver.close();

  // Parent audit view.
  await page.goto(`/app/children/${childId}/activity`);
  await expect(page.getByText("Confirmó lectura de información crítica").first()).toBeVisible();
  await expect(page.getByText("Consultó información crítica").first()).toBeVisible();
  await expect(page.getByText("Carla").first()).toBeVisible();

  // Critical change is recorded in the full trail.
  await page.goto(`/app/children/${childId}/activity?filter=all`);
  await expect(page.getByText("Información crítica modificada").first()).toBeVisible();

  // Network shows the babysitter with acknowledgement.
  await page.goto(`/app/children/${childId}/network`);
  await expect(page.getByText("Carla")).toBeVisible();
  await expect(page.getByText(/Confirmó lectura/)).toBeVisible();
});

test("revoking access makes the link stop working immediately (Scenario C)", async ({ page, browser }) => {
  const email = uniqueEmail("parent");
  await register(page, "Ana Prueba", email);
  const childId = await createChildViaWizard(page, "Sofía");
  const url = await shareWithBabysitter(page, childId, { name: "Abuela Rosa" });

  const caregiver = await browser.newContext();
  const cg = await caregiver.newPage();
  await cg.goto(url);
  await expect(cg.getByRole("heading", { name: "IMPORTANTE" })).toBeVisible();

  await page.goto(`/app/children/${childId}/network`);
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Revocar acceso" }).click();
  await expect(page.getByText("Revocado").first()).toBeVisible();

  await cg.reload();
  await expect(cg.getByRole("heading", { name: "Este acceso fue revocado" })).toBeVisible();
  await expect(cg.getByText("Cacahuate")).toHaveCount(0);
  await caregiver.close();
});
