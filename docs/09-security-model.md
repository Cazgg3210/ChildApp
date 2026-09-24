# 09 — Modelo de seguridad

Todo el producto se trata como una plataforma de **información sensible de menores**. La seguridad no es una capa: es un requisito de cada módulo.

## Amenazas consideradas

| Amenaza                                        | Control                                                                                                                                                                                                                                |
| ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Enumeración de enlaces compartidos             | Token de 32 bytes aleatorios (`crypto.randomBytes`) codificado base64url (43 chars). Solo se persiste su SHA-256. Búsqueda por hash.                                                                                                   |
| Enlace filtrado (captura de pantalla, reenvío) | Expiración obligatoria por defecto, PIN opcional (hash bcrypt, máximo 5 intentos), acceso único opcional, revocación inmediata, auditoría de cada apertura.                                                                            |
| Fuerza bruta de PIN / login                    | `RateLimiter` por IP+recurso; bloqueo del link tras 5 intentos fallidos de PIN; login limitado a 10 intentos / 15 min por IP+email.                                                                                                    |
| Robo de sesión                                 | Cookies `HttpOnly`, `Secure` (prod), `SameSite=Lax`, JWT firmado/cifrado por Auth.js; `sessionVersion` para invalidación global.                                                                                                       |
| CSRF                                           | Server Actions de Next.js incluyen protección de origen; Auth.js valida CSRF en sus endpoints; `/api/v1` requiere `Content-Type: application/json` y no usa cookies para clientes externos (Bearer preparado, sin implementar en MVP). |
| XSS                                            | React escapa por defecto; no se usa `dangerouslySetInnerHTML`; CSP básica en headers.                                                                                                                                                  |
| SQL injection                                  | Prisma parametriza todas las consultas; no hay `$queryRawUnsafe`.                                                                                                                                                                      |
| IDOR / privilege escalation                    | **Toda** lectura y escritura pasa por `AuthorizationService`. Los IDs son cuid no enumerables. Tests de seguridad explícitos (§60).                                                                                                    |
| Exposición de fotos/documentos                 | Almacenamiento privado (`StorageProvider`). Acceso solo por URL firmada de corta vida generada tras autorización. `X-Robots-Tag: noindex`.                                                                                             |
| Fuga en logs                                   | El logger redacta `password`, `token`, `pin`, `authorization`, `cookie`. Nunca se registra el contenido del perfil.                                                                                                                    |
| Stack traces en producción                     | `AppError` con `code` y `message` comprensible; errores inesperados devuelven `INTERNAL_ERROR` genérico y se registran con `requestId`.                                                                                                |

## Autenticación

- Auth.js v5, proveedor Credentials en el MVP. Google y Apple se añaden como proveedores adicionales sin cambiar el resto del sistema.
- Contraseñas: `bcryptjs` cost 12; mínimo 10 caracteres.
- Verificación de email: `AuthToken` (`EMAIL_VERIFICATION`, 24 h, un solo uso, hash en BD). En demo el enlace se imprime en consola (`ConsoleMailer`).
- Reset de contraseña: `AuthToken` (`PASSWORD_RESET`, 1 h, un solo uso). Al resetear se incrementa `sessionVersion` → todas las sesiones caducan.
- Respuestas de "olvidé mi contraseña" son idénticas exista o no el email (evita enumeración).
- Rate limit de login en dos niveles: por IP (60 intentos / 15 min) y por IP+email (10 / 15 min), de modo que un atacante no puede bloquear a una víctima desde otra red.
- `REQUIRE_EMAIL_VERIFICATION=true` (producción): compartir, invitar tutores y crear instituciones exigen correo confirmado (`EMAIL_NOT_VERIFIED`).
- Tutores: nadie queda asociado a un niño sin aceptar. `GuardianInvitation` (token hasheado, 7 días, un uso) y la aceptación exige una cuenta con el mismo correo.
- Eliminación de cuenta: solicitud → anonimización inmediata + revocación de todo + cierre de sesiones; purga definitiva a los 30 días (`scripts/purge-deleted-accounts.ts`).

## Autorización

`Auth ≠ permissions`. Ver [10-permissions-model](10-permissions-model.md). Resumen:

- Un actor `user` solo ve niños de los que es tutor, o niños compartidos con una institución de la que es miembro (grant ACTIVO y vigente).
- Un actor `link` solo ve las categorías del grant asociado, dentro de su ventana temporal, si no fue revocado ni agotado.
- Las instituciones **nunca** escriben en el perfil: proponen.

## Tokens de compartir (ADR-005)

```
token   = base64url(randomBytes(32))        # va en la URL / QR
hash    = sha256(token)                     # se guarda
lookup  = ShareLink.findUnique({ tokenHash: sha256(incoming) })
```

- El QR contiene únicamente la URL `https://<host>/s/<token>`; jamás datos.
- Vigencia: `startsAt <= now < expiresAt`, evaluada **en cada petición** (no se confía en el estado almacenado).
- Tras validar el PIN se emite una cookie `cp_<linkId>` firmada (HMAC-SHA256 con `AUTH_SECRET`), `HttpOnly`, vida 12 h, para no pedir el PIN en cada navegación.

## Datos sensibles

Clasificación interna por sección (no visible al usuario):

| Sección                                             | Sensibilidad     |
| --------------------------------------------------- | ---------------- |
| HEALTH (alergias, medicación, condiciones, vacunas) | HIGHLY_SENSITIVE |
| EMERGENCY (contactos, teléfonos, médico)            | SENSITIVE        |
| NUTRITION, SLEEP, BATHROOM, COMMUNICATION, COMFORT  | SENSITIVE        |
| PLAY, SOCIAL                                        | NORMAL           |
| Documents                                           | HIGHLY_SENSITIVE |

Uso: define qué eventos de auditoría se emiten (`CRITICAL_DATA_VIEWED` cuando se lee HIGHLY_SENSITIVE), qué se puede cachear (nada de SENSITIVE+ en el service worker) y los defaults de compartir.

## Cabeceras HTTP

`next.config.ts` añade: `Strict-Transport-Security`, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` restrictiva, `X-Robots-Tag: noindex` en `/s/*`, `/app/*`, `/institution/*`, `/api/*`, y una `Content-Security-Policy` (`default-src 'self'`, `frame-ancestors 'none'`, `object-src 'none'`, fuentes de Google permitidas; `unsafe-eval` solo en desarrollo).

## Documentos

Cada carga se valida por contenido (`src/shared/security/mime.ts`: magic bytes de PDF/JPEG/PNG/WebP/HEIC) además del tipo declarado; si no coinciden se rechaza. Solo se aceptan esos formatos.

## Visibilidad en Care Pass e instituciones

La categoría compartida decide si un dato se muestra; la criticidad solo decide orden y estilo (`partitionForCarePass`). Todo dato de EMERGENCY/ALLERGIES/MEDICATION va al bloque destacado aunque sea INFORMATIONAL; nada autorizado se omite.

## Enlaces de un solo uso

El consumo es atómico en BD (`UPDATE ... WHERE useCount < maxUses`) en `/s/<token>/open`; con N aperturas concurrentes exactamente una entra y el resto recibe `ACCESS_EXHAUSTED`.

## Auditoría

`AuditService.record()` centralizado, append-only. Campos: actor, fecha, recurso, categorías, IP, user agent, institución, sesión de cuidado, contexto. Ningún módulo escribe en `AuditEvent` por su cuenta.

## Ajustes en tiempo de ejecución (/admin)

`PlatformSetting` guarda correo, seguridad y funcionalidades editadas desde el panel; tienen prioridad sobre las variables de entorno y se cachean 10 s. La contraseña SMTP se cifra con AES-256-GCM y clave derivada de `AUTH_SECRET` (`src/shared/security/secretbox.ts`); nunca se devuelve al navegador. Rotar `AUTH_SECRET` obliga a reintroducirla.

## Secretos y configuración

- `.env.example` documenta todas las variables. `src/shared/config/env.ts` valida con zod al arrancar y falla rápido.
- `AUTH_SECRET` obligatorio (>= 32 chars) fuera de desarrollo.
- Contraseñas demo solo se crean si `SEED_DEMO=true`; el seed se niega a correr con `NODE_ENV=production` salvo `ALLOW_DEMO_SEED=true`.

## Pruebas de seguridad (obligatorias)

Ver [13-testing-strategy](13-testing-strategy.md): cuidador tras expiración, cuidador viendo campos no compartidos, institución accediendo a otro niño, token inválido, token revocado, usuario no autenticado, escalada de privilegios (miembro → admin, co-guardian → owner, institución → edición del perfil).
