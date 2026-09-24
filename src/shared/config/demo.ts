/** Demo accounts created by `npm run db:seed` when SEED_DEMO=true. Documented in README.md. */
export const DEMO_ACCOUNTS = [
  { email: "parent@example.com", labelKey: "parent", name: "Luis Castro" },
  { email: "andrea@example.com", labelKey: "coGuardian", name: "Andrea Molina" },
  { email: "institution@example.com", labelKey: "institutionAdmin", name: "Mariana Ruiz" },
  { email: "teacher@example.com", labelKey: "teacher", name: "Sofía Hernández" },
  { email: "admin@example.com", labelKey: "platformAdmin", name: "Admin Plataforma" },
] as const;
