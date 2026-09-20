import { expect, test } from "@playwright/test";
import { createChildViaWizard, register, shareWithBabysitter, uniqueEmail } from "./helpers";

/**
 * Journey 2 — Caregiver on a phone: open Care Pass → PIN → critical info →
 * acknowledge → care session → record activity → end session.
 * Also verifies that non-shared categories never render (Scenario B).
 */
test("caregiver journey with PIN, care session and category isolation", async ({ page, browser }) => {
  // Guardian setup in a desktop context.
  const guardianCtx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const guardian = await guardianCtx.newPage();
  await register(guardian, "Luis Móvil", uniqueEmail("parent"));
  const childId = await createChildViaWizard(guardian, "Mateo");
  // A bathroom item that must NOT be visible to the babysitter (not in defaults).
  await guardian.goto(`/app/children/${childId}/profile/routine`);
  await guardian.getByRole("button", { name: "Agregar" }).nth(1).click();
  await guardian.getByLabel("Título").fill("Secreto de baño");
  await guardian.getByRole("button", { name: "Guardar" }).click();
  await expect(guardian.getByText("Secreto de baño")).toBeVisible();
  const url = await shareWithBabysitter(guardian, childId, { name: "Carla", pin: "2468" });
  await guardianCtx.close();

  // Caregiver on the phone (this project uses a mobile device profile).
  await page.goto(url);
  await expect(page.getByRole("heading", { name: "Este acceso está protegido con un PIN" })).toBeVisible();
  await page.getByLabel("PIN").fill("0000");
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page.getByText(/El PIN no es correcto/)).toBeVisible();
  await page.getByLabel("PIN").fill("2468");
  await page.getByRole("button", { name: "Entrar" }).click();

  await expect(page.getByRole("heading", { name: "IMPORTANTE" })).toBeVisible();
  await expect(page.getByText("Cacahuate")).toBeVisible();
  await expect(page.getByText("Dinosaurio azul")).toBeVisible();
  await expect(page.getByText("Secreto de baño")).toHaveCount(0);
  await expect(page.getByRole("link", { name: /55 1234 5678/ })).toHaveAttribute("href", /^tel:/);

  await page.getByRole("button", { name: /He revisado la información crítica/ }).click();
  await expect(page.getByText(/Revisado hace/)).toBeVisible();

  await page.getByRole("link", { name: /Iniciar sesión de cuidado/ }).click();
  await page.getByRole("button", { name: "Iniciar", exact: true }).click();
  await expect(page.getByText("Sesión iniciada")).toBeVisible();

  await page.getByRole("button", { name: "Comida" }).click();
  await page.getByLabel("Nota (opcional)").fill("Cenó pasta con verduras.");
  await page.getByRole("button", { name: "Registrar" }).click();
  await expect(page.getByText("Cenó pasta con verduras.")).toBeVisible();

  await page.getByRole("button", { name: "Incidente" }).click();
  await expect(page.getByRole("button", { name: "Registrar" })).toBeDisabled();
  await page.getByLabel("Nota (opcional)").fill("Se cayó del columpio, sin lesión visible.");
  await page.getByRole("button", { name: "Registrar" }).click();
  await expect(page.getByText("Se cayó del columpio, sin lesión visible.")).toBeVisible();

  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Finalizar sesión" }).click();
  await expect(page.getByRole("heading", { name: "Iniciar sesión de cuidado" })).toBeVisible();
});
