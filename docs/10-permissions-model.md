# 10 — Modelo de permisos (RBAC + ABAC)

## Pregunta que responde el sistema

> ¿Puede el actor **X** realizar la acción **Y** sobre el recurso **Z** dado el contexto **C**?

```ts
AuthorizationService.can(actor, action, resource, context): Decision
// Decision = { allowed: true, via: 'guardian' | 'grant' | 'institution' | 'self', grant?: AccessGrant }
//          | { allowed: false, reason: 'NOT_AUTHENTICATED' | 'ACCESS_DENIED' | 'ACCESS_EXPIRED' | 'ACCESS_NOT_STARTED' | 'ACCESS_REVOKED' | 'ACCESS_EXHAUSTED' | 'ACCESS_PENDING' | 'CATEGORY_NOT_SHARED' | 'CAPABILITY_MISSING' }
```

Prohibido en el resto del código: `if (user.role === 'parent')`. Los componentes reciben _decisiones_, no roles.

## Actores

| Actor       | Origen                                       | Identidad                            |
| ----------- | -------------------------------------------- | ------------------------------------ |
| `user`      | Sesión Auth.js                               | `userId`                             |
| `link`      | Token de `ShareLink` válido (+PIN si aplica) | `grantId`, `linkId`, `recipientName` |
| `system`    | Jobs internos (expiración, seed)             | —                                    |
| `anonymous` | Sin sesión ni token                          | —                                    |

## RBAC: roles relacionales

Los roles nunca son globales; siempre son _respecto a un recurso_.

| Rol                                               | Tabla                       | Sobre                  |
| ------------------------------------------------- | --------------------------- | ---------------------- |
| `OWNER`                                           | `ChildGuardian`             | un `Child`             |
| `CO_GUARDIAN`                                     | `ChildGuardian`             | un `Child`             |
| `ADMIN`                                           | `InstitutionMember`         | una `Institution`      |
| `MEMBER`                                          | `InstitutionMember`         | una `Institution`      |
| `FAMILY` / `BABYSITTER` / `INSTITUTION` / `OTHER` | `AccessGrant.recipientKind` | un `Child` (vía grant) |

## ABAC: atributos evaluados

Sobre un `AccessGrant`:

- `status` ∈ {PENDING, ACTIVE, REVOKED, EXPIRED}
- `startsAt`, `expiresAt` vs. `now`
- `dataCategories[]` ⊇ categoría solicitada
- `capabilities[]` ∋ capacidad requerida
- `ShareLink.status`, `maxUses`/`useCount`, `pinHash` (PIN verificado en contexto)

Sobre el contexto: `now`, `category`, `capability`, `pinVerified`, `institutionId`.

## Acciones

| Acción                                         | Guardian (OWNER) | CO_GUARDIAN |                 Grant LINK/USER                  |     Institution ADMIN     |    Institution MEMBER     |
| ---------------------------------------------- | :--------------: | :---------: | :----------------------------------------------: | :-----------------------: | :-----------------------: |
| `child.read`                                   |        ✓         |      ✓      |                    ✓ vigente                     |         ✓ vigente         |         ✓ vigente         |
| `child.update`                                 |        ✓         |      ✓      |                        ✗                         |             ✗             |             ✗             |
| `child.delete`                                 |        ✓         |      ✗      |                        ✗                         |             ✗             |             ✗             |
| `child.manage_guardians`                       |        ✓         |      ✗      |                        ✗                         |             ✗             |             ✗             |
| `profile.read_category(c)`                     |        ✓         |      ✓      |            ✓ si `c ∈ dataCategories`             | ✓ si `c ∈ dataCategories` | ✓ si `c ∈ dataCategories` |
| `profile.update`                               |        ✓         |      ✓      |                        ✗                         |             ✗             |             ✗             |
| `share.create`                                 |        ✓         |      ✓      |                        ✗                         |             ✗             |             ✗             |
| `share.revoke`                                 |        ✓         |      ✓      |                        ✗                         |             ✗             |             ✗             |
| `audit.read`                                   |        ✓         |      ✓      |                        ✗                         |             ✗             |             ✗             |
| `acknowledge`                                  |        —         |      —      |                ✓ si `ACKNOWLEDGE`                |             ✓             |             ✓             |
| `care_session.start` / `.record` / `.end`      |        ✓         |      ✓      |             ✓ si `RUN_CARE_SESSION`              |  ✓ si `RUN_CARE_SESSION`  |  ✓ si `RUN_CARE_SESSION`  |
| `proposal.create`                              |        —         |      —      |              ✓ si `PROPOSE_CHANGES`              |  ✓ si `PROPOSE_CHANGES`   |  ✓ si `PROPOSE_CHANGES`   |
| `proposal.review`                              |        ✓         |      ✓      |                        ✗                         |             ✗             |             ✗             |
| `document.read`                                |        ✓         |      ✓      | ✓ si `VIEW_DOCUMENTS` y `DOCUMENTS ∈ categorías` |           idem            |           idem            |
| `document.upload`                              |        ✓         |      ✓      |                        ✗                         |             ✗             |             ✗             |
| `institution.manage` (miembros, aceptar niños) |        —         |      —      |                        —                         |             ✓             |             ✗             |
| `institution.read_children`                    |        —         |      —      |                        —                         |             ✓             |             ✓             |

"Vigente" = `status = ACTIVE ∧ startsAt ≤ now ∧ (expiresAt = null ∨ now < expiresAt)`; para links además `ShareLink.status = ACTIVE ∧ (maxUses = null ∨ useCount < maxUses)`. Para `PENDING` (institución aún no aceptó) → `ACCESS_PENDING`.

## Salas (grupos) en instituciones

Una institución puede definir `InstitutionGroup` (salas/clases) y asignar miembros y niños (`InstitutionGroupMember`, `InstitutionGroupChild`). Regla, aplicada en `loadFacts` (autorización) y en `institutionService.listChildren`:

- Sin salas: todos los miembros ven todos los niños compartidos (comportamiento anterior).
- Con ≥ 1 sala: un `MEMBER` solo alcanza los niños asignados a alguna de sus salas; los niños sin sala solo son visibles para `ADMIN`.
- `ADMIN` siempre ve todo y es el único que administra salas.

## Invitaciones de tutores

`child.manage_guardians` (solo OWNER) crea una `GuardianInvitation`; la persona se convierte en `ChildGuardian` únicamente al aceptarla desde una cuenta con el correo invitado. Una invitación pendiente no otorga ningún acceso.

## Categorías de datos

`IDENTITY` (siempre incluida: nombre, edad; foto solo si `PHOTO`), `PHOTO`, `EMERGENCY`, `ALLERGIES`, `MEDICATION`, `HEALTH`, `NUTRITION`, `SLEEP`, `BATHROOM`, `COMMUNICATION`, `COMFORT`, `PLAY`, `SOCIAL`, `DOCUMENTS`.

### Defaults por tipo de destinatario (mínimo necesario, §78)

| Tipo        | Default                                                                                    |
| ----------- | ------------------------------------------------------------------------------------------ |
| FAMILY      | EMERGENCY, ALLERGIES, MEDICATION, NUTRITION, SLEEP, COMFORT, COMMUNICATION, BATHROOM       |
| BABYSITTER  | EMERGENCY, ALLERGIES, MEDICATION, NUTRITION, SLEEP, COMFORT, COMMUNICATION                 |
| INSTITUTION | EMERGENCY, ALLERGIES, MEDICATION, HEALTH, NUTRITION, SLEEP, COMMUNICATION, COMFORT, SOCIAL |
| OTHER       | EMERGENCY, ALLERGIES, MEDICATION                                                           |

`DOCUMENTS`, `HEALTH` (historial) y `PHOTO` nunca se activan por defecto para FAMILY/BABYSITTER/OTHER. El **Permission Preview** muestra explícitamente "podrá ver / NO podrá ver" antes de crear el share.

### Capacidades por defecto

| Tipo        | Capacidades                                    |
| ----------- | ---------------------------------------------- |
| FAMILY      | ACKNOWLEDGE, RUN_CARE_SESSION                  |
| BABYSITTER  | ACKNOWLEDGE, RUN_CARE_SESSION                  |
| INSTITUTION | ACKNOWLEDGE, RUN_CARE_SESSION, PROPOSE_CHANGES |
| OTHER       | ACKNOWLEDGE                                    |

## Implementación

- `modules/authorization/domain/policy.ts`: funciones puras `evaluateGrantValidity(grant, link, now)`, `grantAllowsCategory`, `grantAllowsCapability`, `decide(...)`. 100 % testeable sin BD.
- `modules/authorization/application/authorization.service.ts`: carga las relaciones necesarias (ChildGuardian, InstitutionMember, AccessGrant) y delega en `decide`. Expone `can()` y `assert()` (lanza `AppError`).
- `AccessContext` se resuelve una vez por petición (`resolveActor()`), y el servicio memoiza consultas dentro de esa petición.

## Preview de permisos (UI)

Antes de generar el enlace:

```
Carla podrá ver:
  Emergencia · Alergias · Medicación · Alimentación · Sueño · Confort · Comunicación
Carla NO podrá ver:
  Historial médico · Documentos · Baño · Juego · Social · Foto
Vigencia: sábado 18:00 → domingo 01:00 · Este acceso expirará automáticamente.
```

## Visibilidad por sección ("¿Quién puede ver esto?")

Cada sección del perfil del tutor muestra la lista de accesos vigentes que incluyen su categoría (`✓ Kinder Arcoíris`, `✗ Carla`), calculada por `SharingService.visibilityFor(childId, category)`.
