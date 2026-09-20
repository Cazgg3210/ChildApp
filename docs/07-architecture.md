# 07 — Arquitectura

## Estilo: monolito modular

Una sola aplicación Next.js 16 desplegable como un contenedor, organizada en **módulos por bounded context** con fronteras explícitas. Sin microservicios. Cada módulo podría extraerse después porque:

- solo expone _application services_ (funciones), nunca sus tablas;
- las reglas de negocio viven en `domain/` como funciones puras;
- el acceso a datos está detrás de `infrastructure/` (repositorios Prisma).

## Stack

| Capa       | Tecnología                                                          | Motivo                                                                            |
| ---------- | ------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| Framework  | Next.js 16.3 (App Router, Turbopack, React 19)                      | Full-stack en un solo runtime; Server Components para lectura segura en servidor. |
| Lenguaje   | TypeScript `strict`                                                 | Contratos explícitos entre módulos.                                               |
| UI         | Tailwind CSS 4 + shadcn/ui (Radix) + lucide                         | Velocidad, accesibilidad base, consistencia.                                      |
| Datos      | PostgreSQL 16 + Prisma 7 (`@prisma/adapter-pg`)                     | Integridad relacional, migraciones, tipado.                                       |
| Auth       | Auth.js v5 (Credentials + JWT), `bcryptjs`                          | Preparado para Google/Apple sin rediseñar.                                        |
| Validación | zod 4                                                               | Validación server-side en actions y API.                                          |
| i18n       | next-intl (sin routing por locale)                                  | `es` por defecto, `en` disponible.                                                |
| Logging    | pino                                                                | Logging estructurado JSON.                                                        |
| Tests      | Vitest (unit + integración), Playwright (E2E)                       | —                                                                                 |
| Infra      | Docker multi-stage, docker-compose (app + postgres), GitHub Actions | Portable a DigitalOcean/EasyPanel.                                                |

## Estructura del repositorio

```
src/
  app/                           # PRESENTATION (rutas Next.js)
    (public)/                    # landing, login, register, forgot/reset password, verify-email
    (parent)/app/                # dashboard y todo lo del tutor
    (institution)/institution/   # portal institucional lite
    s/[token]/                   # Care Pass (cuidador sin cuenta)
    api/v1/                      # API versionada (route handlers)
  modules/                       # BOUNDED CONTEXTS
    identity/      { domain, application, infrastructure, presentation(actions) }
    children/
    profiles/
    authorization/
    sharing/
    consent/
    care/
    institutions/
    audit/
    documents/
    notifications/
    ai/
    analytics/
  shared/
    db/            prisma client singleton
    config/        env (zod), feature flags, brand
    errors/        AppError + códigos + mapeo HTTP
    logging/       pino
    security/      tokens, hashing, rate limit, request context
    http/          helpers de API (respuesta de error uniforme, parseo)
    i18n/          config next-intl, formateo de fechas
    utils/
  components/
    ui/            shadcn
    layout/        shells, nav, headers
    feature/       componentes específicos (CriticalBlock, ShareWizard...)
  generated/prisma # cliente generado (ignorado en git)
messages/          es.json, en.json
prisma/            schema.prisma, migrations/, seed.ts
tests/             unit/, integration/, e2e/
docs/              documentación + ADRs
```

### Anatomía de un módulo

```
modules/sharing/
  domain/
    types.ts          # tipos del dominio (DataCategory, Capability, GrantStatus...)
    policy.ts         # funciones puras: evaluateGrant(grant, now), defaultCategoriesFor(kind)...
  application/
    sharing.service.ts  # casos de uso: createCareShare, revokeShare, resolveShareToken...
  infrastructure/
    sharing.repository.ts # Prisma
  presentation/
    actions.ts        # Server Actions ('use server') usados por la UI
    schemas.ts        # zod
```

Reglas:

1. `domain/` no importa Prisma ni Next.
2. `application/` orquesta repositorios, `AuthorizationService`, `AuditService`, `NotificationService`. Lanza `AppError`.
3. `presentation/` (actions y route handlers) solo valida entrada, resuelve el actor y llama al servicio. **Nada de lógica de negocio en componentes React.**
4. Un módulo no importa el `infrastructure/` de otro módulo.

## Flujo de una petición

```
UI (RSC / Server Action / Route Handler)
   -> resolveActor()          (identity: usuario autenticado | link token | anónimo)
   -> zod schema              (validación server-side)
   -> XxxService.useCase()    (application)
        -> AuthorizationService.assert(actor, action, resource, ctx)
        -> Repository (Prisma, transacción si aplica)
        -> AuditService.record(...)
        -> NotificationService.notify(...)
        -> AnalyticsService.track(...)
   <- resultado tipado | AppError { code, message }
```

Server Actions y `/api/v1` comparten los servicios: la API es un adaptador de presentación más, no una segunda implementación.

## Servicios transversales

- **AuthorizationService** — `can(actor, action, resource, context)` → `{ allowed, grant?, reason? }`. Única fuente de verdad de permisos. Ver [10-permissions-model](10-permissions-model.md).
- **AuditService** — `record(event)`. Toda operación sensible pasa por aquí; los repositorios nunca escriben en `AuditEvent` directamente.
- **NotificationService** — crea `Notification` in-app y despacha a `NotificationChannel[]` (solo `InAppChannel` en MVP).
- **ProfileVersioningService** — envuelve toda mutación de `ProfileItem` en una transacción que incrementa `Child.profileVersion` y crea `ChildProfileVersion` con snapshot + diff.
- **StorageProvider** — `put/getSignedUrl/delete`; `LocalDiskStorage` (dev) y `S3Storage` (prod).
- **AIProvider** — `structureCareNotes(text, locale)` → items propuestos. `HeuristicAIProvider` por defecto.
- **Mailer** — `ConsoleMailer` en dev; interfaz lista para SMTP/Resend.
- **RateLimiter** — en memoria por instancia; interfaz para Redis.

## Actores

```ts
type Actor =
  | { type: "user"; userId: string; email: string }
  | { type: "link"; grantId: string; linkId: string; recipientName: string }
  | { type: "system" }
  | { type: "anonymous" };
```

El `proxy.ts` (antes middleware) solo redirige rutas protegidas a `/login`; la autorización real ocurre en los servicios.

## Runtime y despliegue

- `output: 'standalone'` para un contenedor pequeño.
- Un solo proceso Node; sin workers. Tareas diferidas (expiración de grants) se resuelven **por evaluación en lectura** (un grant expirado se rechaza aunque su fila diga ACTIVE) más un job idempotente `expireGrants()` invocable por cron/CLI.
- Sin Redis en MVP.

## Observabilidad

`pino` con `requestId`, `actor`, `action`. Preparado para Sentry/OpenTelemetry mediante `instrumentation.ts` (hook vacío).

## Interoperabilidad

`modules/integrations/IntegrationAdapter` define el contrato (`exportChildCareProfile`, `importObservations`) y `FamlyAdapter`, `BrightwheelAdapter`, `StoryparkAdapter` son stubs no implementados. La API `/api/v1` es el punto de integración real.
