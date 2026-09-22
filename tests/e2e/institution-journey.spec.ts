import { expect, test, type Browser } from "@playwright/test";
import { ACCOUNTS, createChildViaWizard, login, register, uniqueEmail } from "./helpers";

/**
 * Journey 3 — Institution (uses the demo seed: Kinder Arcoíris, Mariana, Sofía):
 * guardian shares → admin accepts → teacher reviews + confirms → teacher proposes →
 * guardian approves → item lands in the profile with OBSERVED provenance.
 * Scenarios E, F, G plus institution isolation.
 */
async function asUser(browser: Browser, email: string) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  await login(page, email);
  return { ctx, page };
}

test("institution journey end to end", async ({ browser }) => {
  // Institution id + invite code via the API (admin session).
  const admin = await asUser(browser, ACCOUNTS.institutionAdmin);
  const institutions = await admin.page.request.get("/api/v1/institutions").then((r) => r.json());
  const kinder = institutions.institutions.find((i: { name: string }) => i.name === "Kinder Arcoíris");
  expect(kinder?.inviteCode).toBeTruthy();

  // A fresh guardian (keeps the demo seed untouched) creates a child and shares it with the institution.
  const guardianCtx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const guardian = { ctx: guardianCtx, page: await guardianCtx.newPage() };
  await register(guardian.page, "Tutor E2E", uniqueEmail("guardian"));
  const childId = await createChildViaWizard(guardian.page, `Emma${Date.now() % 10000}`);
  await guardian.page.goto(`/app/children/${childId}/share/new`);
  await guardian.page.getByRole("button", { name: /Institución/ }).click();
  await guardian.page.getByLabel("Código de la institución").fill(kinder.inviteCode);
  await guardian.page.getByRole("button", { name: "Buscar" }).click();
  await expect(guardian.page.getByText("Institución encontrada: Kinder Arcoíris")).toBeVisible();
  await guardian.page.getByRole("button", { name: "Siguiente" }).click();
  await guardian.page.getByRole("button", { name: "Siguiente" }).click();
  await guardian.page.getByRole("button", { name: "Siguiente" }).click();
  await guardian.page.getByText("Confirmo que quiero compartir esta información").click();
  await guardian.page.getByRole("button", { name: "Enviar invitación a la institución" }).click();
  await expect(guardian.page.getByText(/Invitación enviada/)).toBeVisible();

  // Before acceptance the teacher cannot see the child.
  const teacher = await asUser(browser, ACCOUNTS.teacher);
  await teacher.page.goto(`/institution/${kinder.id}/children/${childId}`);
  await expect(teacher.page.getByText(/No encontramos lo que buscas|This page could not be found|404/)).toBeVisible();

  // Admin accepts the request.
  await admin.page.goto(`/institution/${kinder.id}/requests`);
  await admin.page.getByRole("button", { name: "Aceptar" }).first().click();
  await expect(admin.page.getByText(/Relación aceptada/)).toBeVisible();
  await admin.page.goto(`/institution/${kinder.id}/children`);
  await expect(admin.page.getByRole("link", { name: /Emma/ }).first()).toBeVisible();

  // The kinder works with rooms: until the admin assigns Emma to the teacher's room, the teacher cannot see her.
  await teacher.page.goto(`/institution/${kinder.id}/children/${childId}`);
  await expect(teacher.page.getByText(/No encontramos lo que buscas|This page could not be found|404/)).toBeVisible();
  await admin.page.goto(`/institution/${kinder.id}/groups`);
  await admin.page.getByRole("checkbox", { name: /Sala Azul: Emma/ }).click();
  await expect(admin.page.getByRole("checkbox", { name: /Sala Azul: Emma/ })).toBeChecked();

  // Teacher reviews the profile (only shared categories), confirms and proposes.
  await teacher.page.goto(`/institution/${kinder.id}/children/${childId}`);
  await expect(teacher.page.getByText("Cacahuate")).toBeVisible();
  await expect(teacher.page.getByText("Compartido por")).toBeVisible();
  await teacher.page.getByRole("button", { name: /Confirmo que revisé/ }).click();
  await expect(teacher.page.getByText(/Confirmado por/)).toBeVisible();

  await teacher.page.getByRole("button", { name: "Proponer observación" }).click();
  await teacher.page.getByLabel("Sección").selectOption("PLAY");
  await teacher.page.getByLabel("Tipo").selectOption("INTEREST");
  await teacher.page.getByLabel("Resumen").fill("Interés por los instrumentos musicales");
  await teacher.page
    .getByRole("textbox", { name: "Observación" })
    .fill("Busca el rincón de música en cada tiempo libre.");
  await teacher.page.getByRole("button", { name: "Enviar a la familia" }).click();
  await expect(teacher.page.getByText(/Propuesta enviada/)).toBeVisible();

  // Guardian approves; the item appears with OBSERVED provenance.
  await guardian.page.goto(`/app/children/${childId}/proposals`);
  await expect(guardian.page.getByText("Interés por los instrumentos musicales")).toBeVisible();
  await guardian.page.getByRole("button", { name: "Aceptar" }).first().click();
  await expect(guardian.page.getByText(/Agregado al perfil/)).toBeVisible();
  await guardian.page.goto(`/app/children/${childId}/profile/interests`);
  await expect(guardian.page.getByText("Interés por los instrumentos musicales")).toBeVisible();
  await expect(guardian.page.getByText(/Observado · Kinder Arcoíris/)).toBeVisible();

  // Institution isolation: the teacher cannot open a child that was never shared.
  const otherChildId = await createChildViaWizard(guardian.page, "Privada");
  await teacher.page.goto(`/institution/${kinder.id}/children/${otherChildId}`);
  await expect(teacher.page.getByText(/No encontramos lo que buscas|This page could not be found|404/)).toBeVisible();

  await Promise.all([admin.ctx.close(), guardian.ctx.close(), teacher.ctx.close()]);
});

test("unauthenticated API calls are rejected with a uniform error shape", async ({ request }) => {
  const res = await request.get("/api/v1/children");
  expect(res.status()).toBe(401);
  const body = await res.json();
  expect(body.error.code).toBe("NOT_AUTHENTICATED");
  const bad = await request.get("/api/v1/shares/not-a-valid-token-at-all-0000000000000000");
  expect(bad.status()).toBe(400);
  expect((await bad.json()).error.code).toBe("INVALID_TOKEN");
});
