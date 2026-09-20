# 11 — Diseño de API

Prefijo: `/api/v1`. Los route handlers son adaptadores delgados sobre los mismos _application services_ que usan las Server Actions; no existe lógica duplicada.

## Principios

- **API-first**: todo lo que hace la UI puede hacerse por API con la misma autorización.
- **Autenticación**: cookie de sesión same-origin (MVP). `requireApiUser()` centraliza el punto donde se añadirán _bearer tokens_ para integraciones.
- **Autorización**: siempre en el servicio (`AuthorizationService`), nunca en el handler.
- **Errores uniformes**:

```json
{ "error": { "code": "ACCESS_EXPIRED", "message": "This care access has expired.", "details": [] } }
```

Códigos y estados HTTP en `src/shared/errors/app-error.ts`. Nunca se devuelven stack traces en producción.

## Endpoints

| Método       | Ruta                                   | Descripción                                                                       | Auth                                |
| ------------ | -------------------------------------- | --------------------------------------------------------------------------------- | ----------------------------------- |
| GET          | `/health`                              | Liveness (DB ping).                                                               | —                                   |
| GET          | `/me`                                  | Usuario actual.                                                                   | sesión                              |
| GET          | `/me/export`                           | Exportación JSON de todos los datos del tutor (audita `DATA_EXPORTED`).           | sesión                              |
| GET          | `/children`                            | Hijos de los que soy tutor.                                                       | sesión                              |
| POST         | `/children`                            | Crear hijo (+ items iniciales).                                                   | sesión                              |
| GET          | `/children/:id`                        | Niño + vía de acceso y categorías.                                                | sesión (tutor, grant o institución) |
| PATCH        | `/children/:id`                        | Actualizar identidad.                                                             | tutor                               |
| DELETE       | `/children/:id`                        | Borrado lógico + revocación de accesos.                                           | OWNER                               |
| GET          | `/children/:id/profile`                | Items filtrados por categorías autorizadas + completitud.                         | según acceso                        |
| POST         | `/children/:id/profile`                | Añadir item (versiona).                                                           | tutor                               |
| PATCH/DELETE | `/children/:id/profile/:itemId`        | Editar / eliminar item (versiona).                                                | tutor                               |
| GET          | `/children/:id/shares`                 | Accesos del niño con estado efectivo.                                             | tutor                               |
| POST         | `/children/:id/shares`                 | Crear Care Share. Devuelve `url`/`qrDataUrl` **una sola vez**.                    | tutor                               |
| GET/DELETE   | `/grants/:grantId`                     | Ver / revocar un acceso.                                                          | tutor                               |
| GET          | `/shares/:token`                       | Care Pass en JSON (cabecera `X-Care-Pin` si aplica). Audita y cuenta la apertura. | token                               |
| GET          | `/children/:id/care-sessions`          | Sesiones de cuidado con timeline.                                                 | tutor                               |
| GET          | `/children/:id/audit?limit&accessOnly` | Registro de auditoría.                                                            | tutor                               |
| GET/POST     | `/children/:id/observations`           | Propuestas de cambio / revisarlas.                                                | tutor                               |
| GET          | `/children/:id/documents`              | Documentos (metadatos).                                                           | tutor / grant con `VIEW_DOCUMENTS`  |
| GET/POST     | `/institutions`                        | Mis instituciones / crear.                                                        | sesión                              |
| GET          | `/institutions/:id/children`           | Niños compartidos con la institución.                                             | miembro                             |
| GET          | `/consents`                            | Ledger de consentimientos del tutor.                                              | sesión                              |

## Contratos de entrada

Los esquemas zod son la fuente de verdad y se comparten con las Server Actions:

- `createChildSchema`, `childBasicsSchema`, `profileItemInputSchema` — `src/modules/children/presentation/schemas.ts`
- `careShareInputSchema` — `src/modules/sharing/domain/share-input.ts`

## Ejemplo: crear un Care Share

```http
POST /api/v1/children/ckx.../shares
Content-Type: application/json

{
  "recipientKind": "BABYSITTER",
  "recipientName": "Carla",
  "dataCategories": ["EMERGENCY", "ALLERGIES", "MEDICATION", "NUTRITION", "SLEEP", "COMFORT"],
  "capabilities": ["ACKNOWLEDGE", "RUN_CARE_SESSION"],
  "startsAt": "2026-09-26T18:00:00-06:00",
  "expiresAt": "2026-09-27T01:00:00-06:00",
  "pin": "2468",
  "singleUse": false
}
```

```json
{
  "share": {
    "id": "ckx...",
    "status": "ACTIVE",
    "url": "https://care.app/s/<token>",
    "qrDataUrl": "data:image/png;base64,..."
  }
}
```

## Versionado

Cambios incompatibles → `/api/v2`. Los códigos de error son estables dentro de una versión.

## Futuro (V1/V2)

- Bearer tokens por institución (scopes: `children:read`, `observations:write`).
- Webhooks: `share.opened`, `profile.changed`, `proposal.created`.
- `IntegrationAdapter` para Famly/Brightwheel/Storypark/Procare.
