@AGENTS.md

# Child Care Passport — notas para agentes

- Lee `docs/00-project-analysis.md` y `docs/07-architecture.md` antes de tocar código.
- Monolito modular: `src/modules/<context>/{domain,application,infrastructure,presentation}`. La lógica de negocio nunca va en componentes React ni en route handlers.
- Toda lectura/escritura sobre un niño pasa por `authorizationService` (`src/modules/authorization`). Prohibido `if (user.role === ...)`.
- Toda operación sensible se audita con `auditService.record()`; nunca escribir en `AuditEvent` directamente.
- Mutaciones del perfil solo vía `profileService` (versionado + diff).
- Strings de UI en `messages/es.json` y `messages/en.json` (next-intl). Nada hardcodeado.
- Postgres local: `docker compose up -d postgres` (puerto 5470). Migraciones: `npm run db:migrate`. Seed demo: `npm run db:seed`.
- Antes de terminar: `npm run lint && npm run typecheck && npm run test && npm run test:integration && npm run build`. E2E: `npm run test:e2e` (requiere seed).
- Nunca ejecutar `prisma migrate reset` sin consentimiento explícito del usuario; para limpiar residuos de tests usa `npm run db:cleanup-tests`.
