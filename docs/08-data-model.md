# 08 — Modelo de datos

Fuente de verdad: `prisma/schema.prisma`. Este documento explica _por qué_ el modelo es así.

## Proceso seguido

1. **Analizar** las 24 entidades sugeridas en el Master Prompt.
2. **Normalizar**: distinguir entidades (tienen ciclo de vida propio) de relaciones y de atributos.
3. **Simplificar**: eliminar tablas cuya única función sería duplicar una relación.
4. **Documentar** cada decisión (abajo y en ADRs).

### Entidades sugeridas → decisión

| Sugerida                                               | Decisión                                                                                 | Motivo                                                                                                                                                                                |
| ------------------------------------------------------ | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `User`                                                 | Se mantiene.                                                                             | Cuenta autenticable.                                                                                                                                                                  |
| `Guardian`                                             | **Eliminada** → `ChildGuardian` (User ↔ Child con rol).                                  | "Ser tutor" es una relación con un niño, no un tipo de usuario. Un mismo usuario puede ser tutor de un hijo y maestra en un kínder.                                                   |
| `Caregiver`                                            | **Eliminada** → `AccessGrant` con `recipientKind`.                                       | El cuidador del MVP no necesita cuenta; su identidad es el grant.                                                                                                                     |
| `Child`                                                | Se mantiene.                                                                             | Identidad del menor.                                                                                                                                                                  |
| `ChildGuardian`                                        | Se mantiene (OWNER / CO_GUARDIAN).                                                       | Multi-tutor, familias diversas.                                                                                                                                                       |
| `Institution`, `InstitutionMember`, `ChildInstitution` | Se mantienen.                                                                            | Multi-institución; membresía con rol.                                                                                                                                                 |
| `ChildProfile`                                         | **Eliminada** (atributos de identidad viven en `Child`; el resto son items).             | Evita un 1:1 vacío.                                                                                                                                                                   |
| `ProfileSection` / `ProfileAttribute`                  | **Unificadas** en `ProfileItem`.                                                         | Un "hecho de cuidado" = sección + tipo + etiqueta + detalles + datos estructurados + criticidad + procedencia. Permite provenance por dato, compartir por categoría, y diff por item. |
| `Observation`                                          | **Absorbida**: `ChangeProposal` (propuesta) → `ProfileItem` con `provenance = OBSERVED`. | Evita dos representaciones del mismo hecho.                                                                                                                                           |
| `AccessGrant` + `Permission`                           | **Fusionadas** en `AccessGrant` (categorías + capacidades + ventana).                    | Un grant _es_ el conjunto de permisos ABAC.                                                                                                                                           |
| `ShareLink`                                            | Se mantiene (1:1 opcional con grant).                                                    | Token, PIN y usos son atributos del canal, no del permiso.                                                                                                                            |
| `Consent`                                              | Se mantiene como ledger.                                                                 | Registro legal independiente del mecanismo técnico.                                                                                                                                   |
| `CareSession`, `CareEvent`, `Acknowledgement`          | Se mantienen.                                                                            | —                                                                                                                                                                                     |
| `Document`                                             | Se mantiene.                                                                             | —                                                                                                                                                                                     |
| `AuditEvent`                                           | Se mantiene.                                                                             | —                                                                                                                                                                                     |
| `ChangeProposal`                                       | Se mantiene.                                                                             | —                                                                                                                                                                                     |
| `Notification`                                         | Se mantiene.                                                                             | —                                                                                                                                                                                     |
| `ChildProfileVersion`                                  | **Añadida** (requisito §39).                                                             | Versionado + "What's changed?".                                                                                                                                                       |
| `Account`, `AuthToken`                                 | **Añadidas**.                                                                            | OAuth-ready; verificación de email y reset.                                                                                                                                           |
| `ProductEvent`                                         | **Añadida**.                                                                             | Métricas de producto (§69).                                                                                                                                                           |

Total: **21 modelos**.

## Diagrama

```
User 1---* ChildGuardian *---1 Child
User 1---* InstitutionMember *---1 Institution
User 1---* Account
User 1---* AuthToken
User 1---* Notification

Child 1---* ProfileItem
Child 1---* ChildProfileVersion
Child 1---* AccessGrant 1---0..1 ShareLink
                       1---1    Consent
Child 1---* ChildInstitution *---1 Institution   (ChildInstitution 1---1 AccessGrant)
Child 1---* CareSession 1---* CareEvent
Child 1---* Acknowledgement
Child 1---* ChangeProposal
Child 1---* Document
Child 1---* AuditEvent
```

## Modelos

### Identity

- **User**: `email` (único, citext-like en minúsculas), `passwordHash` (nullable para OAuth), `name`, `emailVerifiedAt`, `locale` (`es`), `timezone`, `country` (`MX`), `regulatoryRegion`, `sessionVersion` (revocación global de JWT), `isDemo`, `deletedAt`.
- **Account**: proveedor OAuth (`provider`, `providerAccountId`) — vacío en MVP.
- **AuthToken**: `type` (`EMAIL_VERIFICATION` | `PASSWORD_RESET`), `tokenHash`, `expiresAt`, `usedAt`.

### Children

- **Child**: `firstName`, `lastName`, `preferredName`, `dateOfBirth`, `photoKey` (storage, nunca URL pública), `primaryLanguage`, `secondaryLanguages[]`, `country`, `timezone`, `profileVersion` (int, se incrementa en cada cambio), `createdById`, `deletedAt`.
- **ChildGuardian**: `role` (`OWNER` | `CO_GUARDIAN`), `relationshipLabel` ("Madre", "Tutor legal"...). Único por (child, user). Un `OWNER` no puede ser eliminado si es el último.

### Profiles

- **ProfileItem**: `section` (enum `ProfileSection`), `itemType` (string validado por dominio: `ALLERGY`, `MEDICATION`, `CONTACT`, `FEEDING_ROUTINE`…), `label`, `details`, `data` (JSON estructurado: teléfono, dosis, hora…), `criticality` (`CRITICAL` | `IMPORTANT` | `INFORMATIONAL`, defecto derivado del tipo), `provenance` (`SELF_DECLARED` | `OBSERVED` | `DOCUMENTED` | `VERIFIED`), `sourceType` (`GUARDIAN` | `FAMILY` | `CAREGIVER` | `INSTITUTION` | `PROFESSIONAL` | `DOCUMENT`), `sourceLabel`, `sourceInstitutionId`, `documentId`, `verifiedAt`, `sortOrder`, `deletedAt`.
  - La **sensibilidad** (`NORMAL` | `SENSITIVE` | `HIGHLY_SENSITIVE`) no se almacena: se deriva de la sección en `profiles/domain/sensitivity.ts` (Health = HIGHLY_SENSITIVE, Emergency = SENSITIVE…).
  - La **categoría de datos** para compartir se deriva: `HEALTH/ALLERGY → ALLERGIES`, `HEALTH/MEDICATION → MEDICATION`, resto de `HEALTH → HEALTH`, cada otra sección → su categoría homónima.
- **ChildProfileVersion**: `version`, `snapshot` (JSON: items vigentes), `changes` (JSON: `[{op, section, category, itemType, label, critical}]`), `summary`, `createdById`, `createdAt`. Único por (child, version).

### Sharing & Consent

- **AccessGrant**: `childId`, `grantedById`, `subjectType` (`USER` | `INSTITUTION` | `LINK`), `subjectUserId?`, `subjectInstitutionId?`, `recipientKind` (`FAMILY` | `BABYSITTER` | `INSTITUTION` | `OTHER`), `recipientName`, `recipientEmail?`, `dataCategories[]`, `capabilities[]` (`ACKNOWLEDGE`, `RUN_CARE_SESSION`, `PROPOSE_CHANGES`, `VIEW_DOCUMENTS`), `startsAt`, `expiresAt?`, `status` (`PENDING` | `ACTIVE` | `REVOKED` | `EXPIRED`), `revokedAt`, `revokedById`, `revokeReason`, `note`.
- **ShareLink**: `accessGrantId` (único), `tokenHash` (SHA-256, único), `pinHash?`, `pinAttempts`, `maxUses?` (null = múltiple), `useCount`, `lastUsedAt`, `status` (`ACTIVE` | `REVOKED`).
- **Consent**: ledger. `childId`, `guardianId`, `accessGrantId` (único), `recipientType`, `recipientLabel`, `purpose`, `dataCategories[]`, `startsAt`, `expiresAt`, `status`, `version`, `revokedAt`. Una revocación **no borra**: actualiza `status` y `revokedAt`.

### Care

- **CareSession**: `childId`, `accessGrantId?`, `caregiverUserId?`, `caregiverName`, `startedAt`, `expectedEndAt?`, `endedAt?`, `status`, `profileVersionAtStart`.
- **CareEvent**: `careSessionId`, `type` (`SESSION_STARTED`, `INFO_REVIEWED`, `FOOD`, `WATER`, `BATHROOM`, `SLEEP`, `WAKE`, `MEDICATION`, `ACTIVITY`, `NOTE`, `INCIDENT`, `SESSION_ENDED`), `occurredAt`, `note`, `data`.
- **Acknowledgement**: `childId`, `accessGrantId?`, `careSessionId?`, `actorUserId?`, `actorName`, `profileVersion`, `acknowledgedAt`, `ipAddress`, `userAgent`.

### Institutions

- **Institution**: `name`, `type`, `country`, `timezone`, `inviteCode` (único, para que las familias compartan), `createdById`.
- **InstitutionMember**: `role` (`ADMIN` | `MEMBER`), `title`.
- **ChildInstitution**: `childId`, `institutionId`, `accessGrantId` (único), `status` (`PENDING` | `ACTIVE` | `REVOKED` | `ENDED`), `acceptedAt`, `acceptedById`, `endedAt`.
- **ChangeProposal**: `childId`, `institutionId?`, `proposedById`, `section`, `itemType`, `label`, `details`, `data`, `status` (`PROPOSED` | `ACCEPTED` | `REJECTED`), `reviewedById`, `reviewedAt`, `reviewNote`, `resultingItemId`.

### Documents

- **Document**: `childId`, `uploadedById`, `title`, `category`, `storageKey`, `mimeType`, `sizeBytes`, `deletedAt`. Acceso solo por URL firmada con expiración.

### Audit / Notifications / Analytics

- **AuditEvent**: `type` (string del dominio: `PROFILE_VIEWED`, `CRITICAL_DATA_VIEWED`, `ACCESS_GRANTED`, `ACCESS_REVOKED`, `CARE_SESSION_STARTED`, `CARE_SESSION_ENDED`, `PROFILE_UPDATED`, `DOCUMENT_VIEWED`, `ACKNOWLEDGEMENT_COMPLETED`, `CHANGE_PROPOSED`, `CHANGE_REVIEWED`, `LOGIN_SUCCEEDED`…), `actorType` (`USER` | `LINK` | `SYSTEM`), `actorUserId?`, `actorLabel`, `childId?`, `institutionId?`, `accessGrantId?`, `careSessionId?`, `resourceType`, `resourceId`, `dataCategories[]`, `ipAddress`, `userAgent`, `context` (JSON), `createdAt`. **Append-only.**
- **Notification**: `userId`, `type`, `title`, `body`, `data`, `readAt`.
- **ProductEvent**: `name`, `userId?`, `childId?`, `institutionId?`, `props`.

## Convenciones

- IDs: `cuid()` (no incrementales, no enumerables).
- Timestamps: `createdAt` / `updatedAt` en todas las entidades mutables.
- Soft delete (`deletedAt`) en `User`, `Child`, `ProfileItem`, `Document`. El resto se conserva por trazabilidad (grants, consents, audits nunca se borran).
- Índices en toda FK, en `(childId, section)`, `(childId, status)`, `tokenHash`, `(childId, createdAt)` de auditoría.
- Enums de Prisma para valores cerrados con impacto en integridad; strings validados por dominio para catálogos que crecerán (`itemType`, `AuditEvent.type`).

## Versionado del perfil

Cada mutación de `ProfileItem` (crear/editar/borrar/aceptar propuesta) ocurre en una transacción que:

1. aplica el cambio;
2. incrementa `Child.profileVersion`;
3. escribe `ChildProfileVersion { version, snapshot, changes }`.

"What's changed since caregiver last reviewed?" = `changes` de todas las versiones `> Acknowledgement.profileVersion` (última del actor), agregadas por categoría y filtradas por las categorías del grant.

## Retención y borrado (preparado, V1)

- `DELETE ACCOUNT`: soft delete de `User`; los `Child` de los que es único OWNER pasan a `deletedAt`; grants se revocan; audit se conserva anonimizado.
- `EXPORT DATA`: el servicio `exportGuardianData(userId)` devuelve JSON de hijos, perfiles, grants, consents y audits del tutor. Endpoint expuesto en `/api/v1/me/export` (MVP: JSON).
