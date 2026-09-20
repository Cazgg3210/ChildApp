# 00 — Análisis del proyecto

> Documento de descubrimiento producido antes de escribir código (Fase 0).
> Lee primero este documento; el resto de `/docs` desarrolla cada tema.

## 1. Qué estamos construyendo (en una frase)

Una plataforma B2B2C donde el **tutor** crea una sola vez la información de cuidado de su hijo, la mantiene actualizada y la comparte de forma **selectiva, temporal, revocable y auditable** con familiares, cuidadores e instituciones.

Principio: **Create once. Control always. Share anywhere.**

El producto vive en la intersección de cinco capacidades y solamente ahí:

```
Identidad + Información de cuidado + Consentimiento + Permisos + Trazabilidad
```

## 2. Lectura crítica del Master Prompt

### 2.1 Contradicciones y tensiones detectadas (y cómo se resolvieron)

| #   | Tensión                                                                                                                                                                   | Resolución                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | "Modelo de datos mínimo" lista 24 entidades (Guardian, Caregiver, ProfileSection, ProfileAttribute, Observation, Permission…) y a la vez pide "normalizar y simplificar". | Se simplificó a **21 modelos**. `Guardian` y `Caregiver` no son tablas: son _relaciones_ (`ChildGuardian`, `AccessGrant`). `ProfileSection`/`ProfileAttribute` se unifican en `ProfileItem` (un hecho de cuidado con procedencia). `Observation` se modela como `ChangeProposal` que, al aceptarse, se convierte en `ProfileItem` con procedencia `OBSERVED`. `Permission` se absorbe en `AccessGrant` (categorías + capacidades + ventana temporal). Ver [08-data-model](08-data-model.md). |
| 2   | "El cuidador puede abrir el enlace sin crear cuenta" vs. "Registrar quién confirmó la lectura".                                                                           | El actor de un enlace es un **actor tipo LINK**: identidad = el `AccessGrant` (que ya sabe que "Carla" es la destinataria) + nombre confirmado en pantalla al reconocer. Suficiente para trazabilidad del MVP; en V1 se puede vincular a cuenta.                                                                                                                                                                                                                                             |
| 3   | Auth.js como preferencia vs. sesiones revocables/DB para datos sensibles.                                                                                                 | Auth.js v5 con estrategia JWT (necesaria para Credentials) **más** un `sessionVersion` en `User` que invalida todos los JWT al cambiar contraseña o cerrar sesión en todos los dispositivos. Ver [ADR-007](adr/ADR-007-authjs-jwt-sessions.md).                                                                                                                                                                                                                                              |
| 4   | "Institution Portal Lite" y "NO crear un ERP" vs. una lista de 29 pantallas.                                                                                              | El portal institucional se limita a: dashboard, lista de niños, vista de niño, alertas, propuestas, solicitudes pendientes. Cero gestión académica/administrativa.                                                                                                                                                                                                                                                                                                                           |
| 5   | "Care Session" con registro de comida/sueño/medicación vs. "No desarrollar un sistema clínico".                                                                           | `CareEvent` es un **timeline informativo** (tipo + hora + nota + datos libres). Sin dosis calculadas, sin validación clínica, sin gráficas de crecimiento.                                                                                                                                                                                                                                                                                                                                   |
| 6   | AI Assistant obligatorio en arquitectura, pero sin acoplar a proveedor.                                                                                                   | Interfaz `AIProvider` con implementación `HeuristicAIProvider` (determinista, sin red) activa por defecto y feature flag `AI_PROFILE_ASSISTANT`. Los proveedores reales se añaden como adaptadores.                                                                                                                                                                                                                                                                                          |
| 7   | i18n `es`/`en` desde el inicio vs. velocidad del MVP.                                                                                                                     | `next-intl` sin routing por locale (cookie `locale`), mensajes en `messages/es.json` y `messages/en.json`. Español es el idioma por defecto.                                                                                                                                                                                                                                                                                                                                                 |
| 8   | Redis "solamente si existe necesidad real".                                                                                                                               | No hay necesidad real: sesiones son JWT, rate limiting en memoria (por instancia) con interfaz para sustituir por Redis.                                                                                                                                                                                                                                                                                                                                                                     |
| 9   | "PWA con modo offline" vs. "no cachear información sensible".                                                                                                             | Service worker mínimo: cachea únicamente el _app shell_ estático. Nunca `/api`, `/s/`, `/app`, `/institution`. Modo offline real queda en roadmap.                                                                                                                                                                                                                                                                                                                                           |

### 2.2 Riesgos identificados

| Riesgo                                            | Impacto                   | Mitigación en el MVP                                                                                                                          |
| ------------------------------------------------- | ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Fuga de datos de menores por enlace compartido    | Crítico                   | Token de 256 bits, almacenado como SHA-256, expiración obligatoria, PIN opcional, revocación inmediata, cada acceso auditado.                 |
| Institución acumula "ownership" del perfil        | Alto (tesis del producto) | La institución nunca escribe en el perfil; solo propone. Al revocar, el perfil permanece intacto.                                             |
| Etiquetado del niño (sesgo, estigma)              | Alto (ético/legal)        | Sección Social se modela como _observaciones_ contextuales; la IA no clasifica ni infiere. Copys guiados.                                     |
| Explosión de alcance (convertirse en Brightwheel) | Alto                      | Lista explícita de "no construimos" en [01-product-vision](01-product-vision.md). Cada feature pasa la pregunta de la regla final del prompt. |
| Dependencia de betas (Auth.js v5)                 | Medio                     | Auth aislada en `modules/identity`; el resto del sistema solo conoce `getCurrentUser()`/`requireUser()`.                                      |
| Coste de versionado de perfil (snapshots)         | Bajo en MVP               | Snapshot JSON por versión; volumen bajo. Se documenta estrategia de compactación.                                                             |
| Regulación (LFPDPPP en México, GDPR/COPPA futuro) | Alto                      | Consent Ledger, minimización de datos, exportación/borrado preparados, `regulatoryRegion` en el modelo.                                       |

## 3. Bounded contexts → módulos del monolito

Todos son **módulos internos** del monolito modular (`src/modules/*`). Ninguno es un microservicio. Cada módulo expone su _application service_; otros módulos solo hablan con ese servicio (nunca con su repositorio).

| Bounded context      | Módulo          | Responsabilidad                                                                       | Entidades                                                                |
| -------------------- | --------------- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| Identity             | `identity`      | Registro, login, verificación de email, reset de contraseña, sesión actual.           | `User`, `Account`, `AuthToken`                                           |
| Child & Relationship | `children`      | Niño, tutores (owner / co-guardian).                                                  | `Child`, `ChildGuardian`                                                 |
| Child Profile        | `profiles`      | Hechos de cuidado con procedencia, criticidad, versionado y detección de cambios.     | `ProfileItem`, `ChildProfileVersion`                                     |
| Authorization        | `authorization` | `AuthorizationService`: RBAC + ABAC, evaluación de vigencia, categorías, capacidades. | (sin tablas propias)                                                     |
| Sharing              | `sharing`       | Care Share: `AccessGrant`, `ShareLink`, QR, PIN, revocación, permission preview.      | `AccessGrant`, `ShareLink`                                               |
| Consent              | `consent`       | Ledger append-only de consentimientos.                                                | `Consent`                                                                |
| Care                 | `care`          | Care Mode, acknowledgements, care sessions y timeline.                                | `CareSession`, `CareEvent`, `Acknowledgement`                            |
| Institution          | `institutions`  | Organización, miembros, niños compartidos, propuestas de cambio.                      | `Institution`, `InstitutionMember`, `ChildInstitution`, `ChangeProposal` |
| Audit                | `audit`         | `AuditService` centralizado + vista "¿quién accedió?".                                | `AuditEvent`                                                             |
| Documents            | `documents`     | Document Vault con `StorageProvider` (local / S3).                                    | `Document`                                                               |
| Notifications        | `notifications` | In-app + interfaz `NotificationChannel` (email/push/WhatsApp/SMS futuros).            | `Notification`                                                           |
| AI                   | `ai`            | `AIProvider` para estructurar texto libre → items propuestos.                         | —                                                                        |
| Analytics            | `analytics`     | Eventos de producto (`PROFILE_CREATED`, `SHARE_OPENED`…).                             | `ProductEvent`                                                           |

## 4. Decisiones de arquitectura (resumen)

Detalladas en `/docs/adr`.

1. **Next.js 16 (App Router) como monolito modular full-stack.** Server Components para lectura, Server Actions para mutaciones de la UI propia y `/api/v1` (Route Handlers) sobre los _mismos_ application services para integraciones y tests.
2. **PostgreSQL 16 + Prisma 7** (driver adapter `pg`), migraciones versionadas, soft delete donde aporta (User, Child, ProfileItem, Document).
3. **Auth.js v5** (Credentials + JWT) con `sessionVersion` para revocación global; autorización propia en `AuthorizationService`.
4. **RBAC + ABAC**: rol del destinatario (FAMILY/BABYSITTER/INSTITUTION/OTHER) + atributos (categorías de datos, capacidades, ventana temporal, estado, PIN, usos).
5. **Share tokens**: 32 bytes aleatorios → base64url en la URL, SHA-256 en base de datos. Nunca IDs incrementales, nunca datos en el QR.
6. **Versionado del perfil**: cada mutación crea `ChildProfileVersion` con snapshot + diff estructurado; "What's changed?" = versiones entre la última reconocida y la actual.
7. **Dominio en TypeScript puro**: reglas de vigencia, categorías, criticidad y diffs viven en funciones puras testeables sin base de datos.

## 5. Modelo de datos — panorama

Ver [08-data-model](08-data-model.md). Núcleo del _Child Care Graph_:

```
User --ChildGuardian--> Child --> ProfileItem (hechos con procedencia)
                          |  '--> ChildProfileVersion (snapshots + diffs)
                          |--> AccessGrant --> ShareLink (token hash, PIN, usos)
                          |        '--> Consent (ledger)
                          |--> ChildInstitution --> Institution --> InstitutionMember --> User
                          |--> CareSession --> CareEvent
                          |--> Acknowledgement
                          |--> ChangeProposal
                          |--> Document
                          '--> AuditEvent
```

## 6. Backlog MVP (por fase)

| Fase | Entregable                                                                                                                                        | Criterio de aceptación cubierto  |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------- |
| 0    | Docs, ADRs, estructura, esquema Prisma, entorno (Docker, env, CI).                                                                                | —                                |
| 1    | Foundation: DB, Prisma client, Auth.js, layout, i18n, UI base, logging, errores, seed.                                                            | —                                |
| 2    | Parent: dashboard, hijos, onboarding progresivo, perfil por secciones, provenance, versionado.                                                    | A (crear hijo, completar perfil) |
| 3    | Sharing: AccessGrant, ShareLink, QR, PIN, permission preview, expiración, revocación, Consent Ledger, red de cuidado.                             | A, C                             |
| 4    | Caregiver: Care Pass mobile-first, PIN, acknowledgement, care session, timeline.                                                                  | B                                |
| 5    | Institution: crear organización, compartir con institución, aceptar, dashboard, lista, vista de niño, alertas, propuestas, revisión por el padre. | E, F, G                          |
| 6    | Audit + change detection: AuditService en todas las operaciones sensibles, vista "¿quién accedió?", "What's changed?".                            | D, H                             |
| 7    | Testing + seguridad: unit (permisos, expiración, consentimiento), integración API, E2E Playwright de los 3 journeys, tests de seguridad.          | I                                |
| 8    | Demo polish: seed realista, README, credenciales demo, documentos restantes, Dockerfile, CI.                                                      | Demo 10 min                      |

## 7. Dependencias

| Dependencia            | Tipo                          | Estado                                                                                                     |
| ---------------------- | ----------------------------- | ---------------------------------------------------------------------------------------------------------- |
| PostgreSQL 16 (Docker) | Infraestructura local         | `docker-compose.yml` (puerto 5470)                                                                         |
| Auth.js v5 beta        | Librería                      | Aislada en `modules/identity`                                                                              |
| Proveedor de email     | Externo (verificación, reset) | **No requerido en MVP**: `ConsoleMailer` imprime enlaces en log; interfaz `Mailer` lista para SMTP/Resend. |
| Object storage S3      | Externo                       | Opcional; `LocalDiskStorage` por defecto, `S3Storage` disponible por env.                                  |
| Proveedor IA           | Externo                       | Opcional; `HeuristicAIProvider` por defecto.                                                               |

## 8. Lo que queda explícitamente fuera del MVP

Facturación, nómina, contabilidad, control académico, LMS, CRM, chat, red social, diagnóstico, integraciones con Brightwheel/Famly/Procare (solo `IntegrationAdapter` conceptual), login para niños, push/email/WhatsApp (solo interfaz), verified credentials, FHIR.
