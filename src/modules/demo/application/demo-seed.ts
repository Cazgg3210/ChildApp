import { addDays, addHours, addMonths, setHours, setMinutes, subDays } from "date-fns";
import { prisma } from "@/shared/db/prisma";
import { env } from "@/shared/config/env";
import { hashPassword } from "@/shared/security/password";
import { DEMO_ACCOUNTS } from "@/shared/config/demo";
import { userActor, type UserActor } from "@/modules/identity/domain/types";
import { childrenService } from "@/modules/children/application/children.service";
import { profileService } from "@/modules/profiles/application/profile.service";
import { sharingService } from "@/modules/sharing/application/sharing.service";
import { institutionService } from "@/modules/institutions/application/institution.service";
import { careService } from "@/modules/care/application/care.service";

export type DemoSeedResult =
  | { status: "skipped"; reason: "SEED_DEMO_DISABLED" | "ALREADY_SEEDED" }
  | {
      status: "created";
      accounts: { role: string; email: string }[];
      password: string;
      kinderInviteCode: string;
      carePassLinks: { name: string; pin: string | null; url: string | null }[];
    };

/**
 * Demo seed: the 10-minute demo scenario (docs/01-product-vision.md).
 * Used by `prisma db seed` (CLI) and by POST /api/v1/admin/seed (hosted
 * platforms without a shell). Guarded so that it never runs in production by
 * accident and never runs twice.
 */
export async function runDemoSeed(): Promise<DemoSeedResult> {
  const e = env();
  if (!e.SEED_DEMO) return { status: "skipped", reason: "SEED_DEMO_DISABLED" };
  if (e.NODE_ENV === "production" && !e.ALLOW_DEMO_SEED) {
    throw new Error("Refusing to seed demo data in production. Set ALLOW_DEMO_SEED=true to override.");
  }
  if (await prisma.user.findUnique({ where: { email: DEMO_ACCOUNTS[0].email } })) {
    return { status: "skipped", reason: "ALREADY_SEEDED" };
  }

  const passwordHash = await hashPassword(e.DEMO_PASSWORD);
  const users: Record<string, { id: string; email: string; name: string }> = {};
  for (const account of DEMO_ACCOUNTS) {
    users[account.labelKey] = await prisma.user.create({
      data: {
        email: account.email,
        name: account.name,
        passwordHash,
        emailVerifiedAt: new Date(),
        isDemo: true,
        locale: "es",
        platformRole: account.labelKey === "platformAdmin" ? "PLATFORM_ADMIN" : "NONE",
      },
      select: { id: true, email: true, name: true },
    });
  }
  const luis: UserActor = userActor({
    ...users.parent,
    locale: "es",
    timezone: "America/Mexico_City",
    emailVerifiedAt: new Date(),
    isDemo: true,
    isPlatformAdmin: false,
  });
  const mariana: UserActor = userActor({
    ...users.institutionAdmin,
    locale: "es",
    timezone: "America/Mexico_City",
    emailVerifiedAt: new Date(),
    isDemo: true,
    isPlatformAdmin: false,
  });
  const sofia: UserActor = userActor({
    ...users.teacher,
    locale: "es",
    timezone: "America/Mexico_City",
    emailVerifiedAt: new Date(),
    isDemo: true,
    isPlatformAdmin: false,
  });
  const andrea: UserActor = userActor({
    ...users.coGuardian,
    locale: "es",
    timezone: "America/Mexico_City",
    emailVerifiedAt: new Date(),
    isDemo: true,
    isPlatformAdmin: false,
  });
  /** Guardianship is never granted silently: the seed goes through invite → accept. */
  const coGuardian = async (childId: string) => {
    const { invitation } = await childrenService.inviteGuardian(luis, childId, {
      email: users.coGuardian.email,
      role: "OWNER",
      relationshipLabel: "Madre",
    });
    await childrenService.acceptInvitation(andrea, invitation.id);
  };

  // --- Mateo --------------------------------------------------------------
  const mateo = await childrenService.create(luis, {
    firstName: "Mateo",
    lastName: "Castro Molina",
    preferredName: "Mateo",
    dateOfBirth: subDays(new Date(), Math.round(4.4 * 365)),
    primaryLanguage: "es",
    secondaryLanguages: ["en"],
  });
  await coGuardian(mateo.id);

  await profileService.addItems(luis, mateo.id, [
    {
      section: "EMERGENCY",
      itemType: "CONTACT",
      label: "Andrea Molina",
      data: { relationship: "Madre", phone: "55 1234 5678" },
    },
    {
      section: "EMERGENCY",
      itemType: "CONTACT",
      label: "Luis Castro",
      data: { relationship: "Padre", phone: "55 8765 4321" },
    },
    {
      section: "EMERGENCY",
      itemType: "DOCTOR",
      label: "Dra. Patricia Reyes (pediatra)",
      data: { phone: "55 5555 0101" },
    },
    {
      section: "EMERGENCY",
      itemType: "HOSPITAL",
      label: "Hospital Ángeles del Pedregal",
      details: "Tiene seguro de gastos médicos mayores; llevar credencial del seguro.",
      data: { phone: "55 5449 5500" },
    },
    {
      section: "HEALTH",
      itemType: "ALLERGY",
      label: "Cacahuate",
      details:
        "Reacción severa. Usar el autoinyector de epinefrina (EpiPen Jr.) que está en su mochila y llamar a emergencias.",
      data: { severity: "severe", reaction: "Hinchazón de labios, dificultad para respirar" },
      provenance: "VERIFIED",
      sourceType: "PROFESSIONAL",
      sourceLabel: "Dra. Patricia Reyes",
    },
    {
      section: "HEALTH",
      itemType: "MEDICATION",
      label: "Montelukast 4 mg",
      details: "Una tableta masticable por la noche. Ya la toma en casa; no requiere dosis durante el día.",
      data: { dose: "4 mg", schedule: "21:00" },
      provenance: "DOCUMENTED",
      sourceType: "PROFESSIONAL",
      sourceLabel: "Dra. Patricia Reyes",
    },
    {
      section: "HEALTH",
      itemType: "CONDITION",
      label: "Asma leve",
      details: "Evitar esfuerzo intenso en días de mucho frío. Inhalador de rescate en la mochila.",
      provenance: "DOCUMENTED",
      sourceType: "PROFESSIONAL",
      sourceLabel: "Dra. Patricia Reyes",
    },
    {
      section: "HEALTH",
      itemType: "VACCINE",
      label: "Esquema de vacunación completo",
      details: "Cartilla al día según esquema nacional (última revisión hace 3 meses).",
      provenance: "DOCUMENTED",
      sourceType: "DOCUMENT",
    },
    {
      section: "NUTRITION",
      itemType: "RESTRICTED_FOOD",
      label: "Cacahuates y productos que puedan contenerlos",
      details: "Revisar etiquetas: galletas, cereales, salsas.",
    },
    {
      section: "NUTRITION",
      itemType: "PREFERENCE",
      label: "Le encanta la fruta (mango, fresa, plátano)",
      criticality: "INFORMATIONAL",
    },
    {
      section: "NUTRITION",
      itemType: "FEEDING_ROUTINE",
      label: "Comida principal a las 13:00",
      details: "Come mejor si se le sirve poco y se le ofrece más después. Agua en su botella verde.",
      data: { time: "13:00" },
    },
    {
      section: "SLEEP",
      itemType: "SCHEDULE",
      label: "Siesta",
      details: "Duerme aproximadamente 1 hora.",
      data: { time: "14:00" },
    },
    {
      section: "SLEEP",
      itemType: "ROUTINE",
      label: "Rutina para dormir",
      details: "Un cuento corto y luz tenue. Le gusta que le froten la espalda unos minutos.",
    },
    {
      section: "SLEEP",
      itemType: "COMFORT_OBJECT",
      label: "Dinosaurio azul (Dino)",
      details: "Lo necesita para dormir. Siempre va en la mochila.",
    },
    {
      section: "BATHROOM",
      itemType: "TOILET_TRAINING",
      label: "Ya avisa para ir al baño",
      details: "A veces se distrae jugando; recordarle cada 2 horas.",
    },
    {
      section: "COMMUNICATION",
      itemType: "NEED_EXPRESSION",
      label: "Dice «me duele la pancita» cuando está nervioso o tiene hambre",
      criticality: "IMPORTANT",
    },
    {
      section: "COMMUNICATION",
      itemType: "HELP_REQUEST",
      label: "Pide ayuda jalando de la mano; rara vez lo dice en voz alta",
    },
    { section: "COMFORT", itemType: "PREFERRED_OBJECT", label: "Dinosaurio azul" },
    {
      section: "COMFORT",
      itemType: "SOOTHING_STRATEGY",
      label: "Contar dinosaurios",
      details: "Cuando se pone nervioso ayuda sentarse con él y contar sus dinosaurios de juguete en voz baja.",
    },
    {
      section: "COMFORT",
      itemType: "TRIGGER",
      label: "Ruidos fuertes repentinos",
      details: "Se tapa los oídos; no forzar, solo acompañar.",
    },
    { section: "PLAY", itemType: "TOY", label: "Dinosaurios", criticality: "INFORMATIONAL" },
    { section: "PLAY", itemType: "CHARACTER", label: "Bluey", criticality: "INFORMATIONAL" },
    { section: "PLAY", itemType: "MUSIC", label: "Canciones de Cri-Cri", criticality: "INFORMATIONAL" },
    { section: "PLAY", itemType: "ACTIVITY", label: "Armar torres y jugar con agua", criticality: "INFORMATIONAL" },
    {
      section: "SOCIAL",
      itemType: "OBSERVATION",
      label: "En ambientes nuevos suele observar antes de integrarse",
      details:
        "Participa normalmente después de familiarizarse con el grupo. Prefiere inicialmente actividades individuales.",
      criticality: "INFORMATIONAL",
    },
  ]);

  // --- Valentina (second child, lighter profile) --------------------------
  const valentina = await childrenService.create(luis, {
    firstName: "Valentina",
    lastName: "Castro Molina",
    dateOfBirth: subDays(new Date(), Math.round(1.8 * 365)),
    primaryLanguage: "es",
    initialItems: [
      {
        section: "EMERGENCY",
        itemType: "CONTACT",
        label: "Andrea Molina",
        data: { relationship: "Madre", phone: "55 1234 5678" },
      },
      // Explicit declarations: "none" is a fact, not a gap (Care Readiness).
      { section: "HEALTH", itemType: "NO_KNOWN_ALLERGIES", label: "NO_KNOWN_ALLERGIES" },
      { section: "HEALTH", itemType: "NO_MEDICATIONS", label: "NO_MEDICATIONS" },
      { section: "SLEEP", itemType: "SCHEDULE", label: "Siesta", data: { time: "12:30" } },
      { section: "BATHROOM", itemType: "DIAPER", label: "Usa pañal", details: "Cambio cada 3 horas aproximadamente." },
    ],
  });
  await coGuardian(valentina.id);

  // --- Institution: Kinder Arcoíris (verified, with rooms) -------------------
  const kinder = await institutionService.create(mariana, { name: "Kinder Arcoíris", type: "KINDERGARTEN" });
  await institutionService.updateDetails(mariana, kinder.id, {
    legalName: "Centro Educativo Arcoíris S.C.",
    contactName: "Mariana Ruiz",
    phone: "55 5555 0200",
    address: "Av. Universidad 1200, Coyoacán, CDMX",
    website: "https://kinderarcoiris.example.com",
  });
  await institutionService.requestVerification(mariana, kinder.id);
  await institutionService.setVerificationStatus(kinder.id, "VERIFIED");
  const teacherMember = await institutionService.addMember(
    mariana,
    kinder.id,
    users.teacher.email,
    "MEMBER",
    "Maestra de Preescolar 2",
  );
  const salaAzul = await institutionService.createGroup(mariana, kinder.id, "Sala Azul");
  const salaVerde = await institutionService.createGroup(mariana, kinder.id, "Sala Verde");
  await institutionService.setGroupMember(mariana, kinder.id, salaAzul.id, teacherMember.id, true);

  // --- Shares ----------------------------------------------------------------
  const now = new Date();
  const rosa = await sharingService.create(luis, mateo.id, {
    recipientKind: "FAMILY",
    recipientName: "Abuela Rosa",
    dataCategories: [
      "EMERGENCY",
      "ALLERGIES",
      "MEDICATION",
      "NUTRITION",
      "SLEEP",
      "COMFORT",
      "COMMUNICATION",
      "BATHROOM",
    ],
    capabilities: ["ACKNOWLEDGE", "RUN_CARE_SESSION"],
    startsAt: subDays(now, 30),
    expiresAt: addMonths(now, 6),
    singleUse: false,
  });
  const saturday = setMinutes(setHours(addDays(now, (6 - now.getDay() + 7) % 7 || 7), 18), 0);
  const carla = await sharingService.create(luis, mateo.id, {
    recipientKind: "BABYSITTER",
    recipientName: "Carla",
    dataCategories: ["EMERGENCY", "ALLERGIES", "MEDICATION", "NUTRITION", "SLEEP", "COMFORT", "COMMUNICATION"],
    capabilities: ["ACKNOWLEDGE", "RUN_CARE_SESSION"],
    startsAt: subDays(now, 2),
    expiresAt: addHours(saturday, 7),
    pin: "2468",
    singleUse: false,
    note: "Sábado 18:00 → domingo 01:00. PIN por WhatsApp.",
  });
  const kinderShare = await sharingService.create(luis, mateo.id, {
    recipientKind: "INSTITUTION",
    recipientName: kinder.name,
    institutionCode: kinder.inviteCode,
    dataCategories: [
      "EMERGENCY",
      "ALLERGIES",
      "MEDICATION",
      "HEALTH",
      "NUTRITION",
      "SLEEP",
      "COMMUNICATION",
      "COMFORT",
      "SOCIAL",
    ],
    capabilities: ["ACKNOWLEDGE", "RUN_CARE_SESSION", "PROPOSE_CHANGES"],
    startsAt: subDays(now, 10),
    expiresAt: addMonths(now, 9),
    singleUse: false,
  });
  const relation = await prisma.childInstitution.findUniqueOrThrow({ where: { accessGrantId: kinderShare.grant.id } });
  await institutionService.acceptRequest(mariana, kinder.id, relation.id);
  await institutionService.setGroupChild(mariana, kinder.id, salaAzul.id, relation.id, true);

  // --- Other families in the kinder (so the institution dashboard tells a story) ----
  const otherFamilies: {
    parent: { email: string; name: string };
    child: { firstName: string; lastName: string; years: number };
    items: Parameters<typeof profileService.addItems>[2];
    group: string | null;
    staleAllergy?: boolean;
  }[] = [
    {
      parent: { email: "paola@example.com", name: "Paola Jiménez" },
      child: { firstName: "Emilia", lastName: "Torres Jiménez", years: 3.6 },
      group: salaAzul.id,
      items: [
        { section: "EMERGENCY", itemType: "CONTACT", label: "Paola Jiménez", data: { relationship: "Madre", phone: "55 2222 1010" } },
        { section: "HEALTH", itemType: "NO_KNOWN_ALLERGIES", label: "NO_KNOWN_ALLERGIES" },
        { section: "HEALTH", itemType: "NO_MEDICATIONS", label: "NO_MEDICATIONS" },
        { section: "SLEEP", itemType: "COMFORT_OBJECT", label: "Conejo de peluche (Coco)" },
        { section: "PLAY", itemType: "INTEREST", label: "Pintar con los dedos", criticality: "INFORMATIONAL" },
      ],
    },
    {
      parent: { email: "diego@example.com", name: "Diego Ramírez" },
      child: { firstName: "Santiago", lastName: "Ramírez Vega", years: 4.1 },
      group: salaVerde.id,
      staleAllergy: true,
      items: [
        { section: "EMERGENCY", itemType: "CONTACT", label: "Diego Ramírez", data: { relationship: "Padre", phone: "55 3333 2020" } },
        {
          section: "NUTRITION",
          itemType: "FOOD_ALLERGY",
          label: "Lactosa",
          details: "Intolerancia fuerte: evitar leche y derivados. Leche deslactosada en su mochila.",
          data: { severity: "moderate", reaction: "Dolor abdominal y vómito" },
        },
        { section: "HEALTH", itemType: "NO_MEDICATIONS", label: "NO_MEDICATIONS" },
        { section: "COMMUNICATION", itemType: "LANGUAGE", label: "Español e inglés en casa" },
      ],
    },
    {
      parent: { email: "fernanda@example.com", name: "Fernanda López" },
      child: { firstName: "Regina", lastName: "López Mora", years: 3.2 },
      group: null,
      items: [
        { section: "HEALTH", itemType: "MEDICATION", label: "Salbutamol (inhalador)", details: "Solo en crisis; 2 disparos con espaciador.", data: { dose: "2 disparos", schedule: "En crisis" } },
        { section: "SLEEP", itemType: "SCHEDULE", label: "Siesta", data: { time: "13:30" } },
      ],
    },
  ];
  for (const family of otherFamilies) {
    const parentUser = await prisma.user.create({
      data: {
        email: family.parent.email,
        name: family.parent.name,
        passwordHash,
        emailVerifiedAt: new Date(),
        isDemo: true,
        locale: "es",
      },
      select: { id: true, email: true, name: true },
    });
    const parent = userActor({
      ...parentUser,
      locale: "es",
      timezone: "America/Mexico_City",
      emailVerifiedAt: new Date(),
      isDemo: true,
      isPlatformAdmin: false,
    });
    const child = await childrenService.create(parent, {
      firstName: family.child.firstName,
      lastName: family.child.lastName,
      dateOfBirth: subDays(now, Math.round(family.child.years * 365)),
      initialItems: family.items,
    });
    const share = await sharingService.create(parent, child.id, {
      recipientKind: "INSTITUTION",
      recipientName: kinder.name,
      institutionCode: kinder.inviteCode,
      dataCategories: ["EMERGENCY", "ALLERGIES", "MEDICATION", "NUTRITION", "SLEEP", "COMMUNICATION", "COMFORT"],
      capabilities: ["ACKNOWLEDGE", "PROPOSE_CHANGES"],
      expiresAt: addMonths(now, family.group === salaVerde.id ? 1 : 9),
      singleUse: false,
    });
    const rel = await prisma.childInstitution.findUniqueOrThrow({ where: { accessGrantId: share.grant.id } });
    await institutionService.acceptRequest(mariana, kinder.id, rel.id);
    if (family.group) await institutionService.setGroupChild(mariana, kinder.id, family.group, rel.id, true);
    if (family.staleAllergy) {
      // Backdated so the institution sees a "needs review" example.
      await prisma.profileItem.updateMany({
        where: { childId: child.id, itemType: "FOOD_ALLERGY" },
        data: { updatedAt: subDays(now, 400) },
      });
    }
  }

  // Valentina is only shared with grandma.
  await sharingService.create(luis, valentina.id, {
    recipientKind: "FAMILY",
    recipientName: "Abuela Rosa",
    dataCategories: ["EMERGENCY", "ALLERGIES", "MEDICATION", "NUTRITION", "SLEEP", "BATHROOM", "COMFORT"],
    capabilities: ["ACKNOWLEDGE", "RUN_CARE_SESSION"],
    expiresAt: addMonths(now, 6),
    singleUse: false,
  });

  // --- Activity: Sofía reviewed and proposed; Carla ran a session -------------
  await careService.acknowledge(sofia, mateo.id, {});
  await institutionService.propose(sofia, kinder.id, mateo.id, {
    section: "PLAY",
    itemType: "INTEREST",
    label: "Interés repetido por los instrumentos musicales",
    details: "Durante la semana ha buscado el rincón de música en cada tiempo libre y pide tocar el xilófono.",
  });

  const carlaActor = {
    type: "link" as const,
    grantId: carla.grant.id,
    linkId: carla.grant.shareLink!.id,
    childId: mateo.id,
    recipientName: "Carla",
  };
  const lastWeek = subDays(now, 7);
  const ack = await careService.acknowledge(carlaActor, mateo.id, { actorName: "Carla" });
  const session = await careService.startSession(carlaActor, mateo.id, { caregiverName: "Carla" });
  const dinner = await careService.recordEvent(carlaActor, session.id, {
    type: "FOOD",
    note: "Cenó pasta con verduras; comió bien.",
  });
  const meds = await careService.recordEvent(carlaActor, session.id, { type: "MEDICATION", note: "Montelukast 4 mg." });
  const sleep = await careService.recordEvent(carlaActor, session.id, {
    type: "SLEEP",
    note: "Se durmió con Dino después del cuento.",
  });
  await careService.endSession(carlaActor, session.id);
  // Backdate the demo session so the timeline reads like last Saturday.
  const at = (h: number, m = 0) => setMinutes(setHours(lastWeek, h), m);
  await prisma.$transaction([
    prisma.acknowledgement.update({ where: { id: ack.id }, data: { acknowledgedAt: at(18, 7) } }),
    prisma.careSession.update({ where: { id: session.id }, data: { startedAt: at(18, 4), endedAt: at(22, 50) } }),
    prisma.careEvent.updateMany({
      where: { careSessionId: session.id, type: "SESSION_STARTED" },
      data: { occurredAt: at(18, 4) },
    }),
    prisma.careEvent.updateMany({
      where: { careSessionId: session.id, type: "INFO_REVIEWED" },
      data: { occurredAt: at(18, 7) },
    }),
    prisma.careEvent.update({ where: { id: dinner.id }, data: { occurredAt: at(19, 10) } }),
    prisma.careEvent.update({ where: { id: meds.id }, data: { occurredAt: at(20, 5) } }),
    prisma.careEvent.update({ where: { id: sleep.id }, data: { occurredAt: at(21, 20) } }),
    prisma.careEvent.updateMany({
      where: { careSessionId: session.id, type: "SESSION_ENDED" },
      data: { occurredAt: at(22, 50) },
    }),
    prisma.auditEvent.updateMany({ where: { careSessionId: session.id }, data: { createdAt: at(18, 4) } }),
  ]);

  // A recent profile change so "What's changed?" has something to show Carla next time.
  await profileService.updateItem(
    luis,
    mateo.id,
    (await profileService.listItems(luis, mateo.id)).find((i) => i.itemType === "SCHEDULE")!.id,
    {
      details: "Duerme aproximadamente 1 hora. Últimamente se duerme un poco más tarde (14:30).",
    },
  );

  return {
    status: "created",
    accounts: DEMO_ACCOUNTS.map((a) => ({ role: a.labelKey, email: a.email })),
    password: e.DEMO_PASSWORD,
    kinderInviteCode: kinder.inviteCode,
    carePassLinks: [
      { name: "Abuela Rosa", pin: null, url: rosa.url },
      { name: "Carla", pin: "2468", url: carla.url },
    ],
  };
}
