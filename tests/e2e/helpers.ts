import { expect, type Page } from "@playwright/test";

export const DEMO_PASSWORD = process.env.DEMO_PASSWORD ?? "Demo1234!secure";
export const ACCOUNTS = {
  parent: "parent@example.com",
  coGuardian: "andrea@example.com",
  institutionAdmin: "institution@example.com",
  teacher: "teacher@example.com",
} as const;

export async function login(page: Page, email: string, password = DEMO_PASSWORD) {
  await page.goto("/login");
  await page.getByLabel("Correo electrónico").fill(email);
  await page.getByLabel("Contraseña", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Iniciar sesión" }).click();
  await page.waitForURL(/\/(app|institution)/);
}

export async function register(page: Page, name: string, email: string, password = "E2eStrongPassword1!") {
  await page.goto("/register");
  await page.getByLabel("Tu nombre").fill(name);
  await page.getByLabel("Correo electrónico").fill(email);
  await page.getByLabel("Contraseña", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Crear cuenta" }).click();
  await page.waitForURL(/\/app/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText(name.split(" ")[0]);
}

export function uniqueEmail(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@e2e.local`;
}

/** Creates a child through the onboarding wizard and returns its id. */
export async function createChildViaWizard(page: Page, firstName: string) {
  await page.goto("/app/children/new");
  await page.getByLabel("Nombre", { exact: true }).fill(firstName);
  await page.getByLabel("Apellidos").fill("E2E");
  await page.getByLabel("Fecha de nacimiento").fill("2022-03-14");
  await page.getByRole("button", { name: "Siguiente" }).click();

  // Safety: one allergy + one emergency contact.
  await page.getByRole("button", { name: "Agregar alergia" }).click();
  await page.getByPlaceholder("Alergia").fill("Cacahuate");
  await page.getByLabel("Gravedad").selectOption("severe");
  await page.getByPlaceholder("Título").fill("Andrea Molina");
  await page.getByPlaceholder("Relación").fill("Madre");
  await page.getByPlaceholder("Teléfono").fill("55 1234 5678");
  await page.getByRole("button", { name: "Siguiente" }).click();

  // Food
  await page.getByLabel("Rutina de alimentación").fill("Come a las 13:00, poco y seguido.");
  await page.getByRole("button", { name: "Siguiente" }).click();

  // Sleep & comfort
  await page.getByLabel("Horario").fill("14:00");
  await page.getByLabel("Objeto preferido").fill("Dinosaurio azul");
  await page.getByRole("button", { name: "Finalizar" }).click();

  const link = page.getByRole("link", { name: "Ver el perfil" });
  await expect(link).toBeVisible();
  const href = await link.getAttribute("href");
  const childId = href!.split("/").pop()!;
  return childId;
}

/** Runs the share wizard for a babysitter and returns the care pass URL. */
export async function shareWithBabysitter(page: Page, childId: string, opts: { name: string; pin?: string }) {
  await page.goto(`/app/children/${childId}/share/new`);
  await page.getByRole("button", { name: /Niñera/ }).click();
  await page.getByLabel("Nombre de la persona o institución").fill(opts.name);
  await page.getByRole("button", { name: "Siguiente" }).click();
  await expect(page.getByRole("heading", { name: "¿Qué información?" })).toBeVisible();
  await page.getByRole("button", { name: "Siguiente" }).click();
  if (opts.pin) await page.getByLabel("PIN de acceso (opcional)").fill(opts.pin);
  await page.getByRole("button", { name: "Siguiente" }).click();
  await expect(page.getByText(`${opts.name} podrá ver:`)).toBeVisible();
  await expect(page.getByText(`${opts.name} NO podrá ver:`)).toBeVisible();
  await page.getByText("Confirmo que quiero compartir esta información").click();
  await page.getByRole("button", { name: "Generar enlace y QR" }).click();
  const input = page.getByLabel("Enlace de acceso");
  await expect(input).toBeVisible();
  return input.inputValue();
}
