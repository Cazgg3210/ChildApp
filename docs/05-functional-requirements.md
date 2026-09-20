# 05 — Requisitos funcionales

Estado: ✅ implementado en el MVP · 🔜 preparado (interfaz/modelo) · ⏭ roadmap.

## Autenticación (Módulo 1)

| Req                           | Estado | Notas                                                   |
| ----------------------------- | ------ | ------------------------------------------------------- |
| Registro, login, logout       | ✅     | Auth.js v5, Credentials, JWT + `sessionVersion`.        |
| Verificación de email         | ✅     | Token hasheado, 24 h, un uso; `ConsoleMailer` en demo.  |
| Recuperación de contraseña    | ✅     | Token 1 h; resetear invalida todas las sesiones.        |
| Google / Apple                | 🔜     | Proveedores registrados por env; tabla `Account` lista. |
| Rate limiting login/reset/PIN | ✅     | `RateLimiter` en memoria.                               |

## Guardian Account (Módulo 2)

| Req                                                                                                    | Estado                            |
| ------------------------------------------------------------------------------------------------------ | --------------------------------- |
| Dashboard: hijos, cuidadores activos, instituciones, accesos por vencer, pendientes, cambios recientes | ✅                                |
| Multi-guardian OWNER / CO_GUARDIAN, familias diversas                                                  | ✅                                |
| Cuenta: nombre, idioma, zona horaria, reenviar verificación                                            | ✅                                |
| Exportar datos (JSON)                                                                                  | ✅ (`/api/v1/me/export`)          |
| Eliminar cuenta                                                                                        | 🔜 (documentado en 08-data-model) |

## Child Profile (Módulo 3)

| Req                                                                             | Estado                                                       |
| ------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| Identidad (nombre, apellidos, preferido, nacimiento, idiomas)                   | ✅                                                           |
| Fotografía privada                                                              | 🔜 (`photoKey` + `StorageProvider`; sin UI de subida en MVP) |
| Emergencia, Salud, Nutrición, Sueño, Baño, Comunicación, Confort, Juego, Social | ✅ (`ProfileItem` por sección con catálogo de tipos)         |
| Provenance por dato (SELF_DECLARED / OBSERVED / DOCUMENTED / VERIFIED + fuente) | ✅                                                           |
| Criticidad CRITICAL / IMPORTANT / INFORMATIONAL                                 | ✅ (default por tipo, editable)                              |
| Sensibilidad interna                                                            | ✅ (mapa de constantes)                                      |
| Onboarding progresivo 5 pasos                                                   | ✅                                                           |
| Versionado del perfil + diff                                                    | ✅ (`ChildProfileVersion`)                                   |
| Asistente IA "Review before saving"                                             | ✅ (`HeuristicAIProvider`, flag `AI_PROFILE_ASSISTANT`)      |
| Guía anti-etiquetas en Social                                                   | ✅                                                           |

## Care Share y permisos (Módulos 11–14, 27)

| Req                                                                  | Estado             |
| -------------------------------------------------------------------- | ------------------ |
| Tipos Family / Babysitter / Institution / Other con defaults mínimos | ✅                 |
| Selección granular de categorías y capacidades                       | ✅                 |
| Inicio, expiración, PIN, acceso único/múltiple, revocación inmediata | ✅                 |
| Permission Preview obligatorio ("podrá ver / NO podrá ver")          | ✅                 |
| Enlace seguro `/s/<token>` + QR sin datos                            | ✅                 |
| Regeneración (rotación) del enlace                                   | ✅                 |
| Consent Ledger                                                       | ✅                 |
| "¿Quién puede ver esto?" por sección                                 | ✅                 |
| Emergency Share                                                      | ⏭ V1 (documentado) |

## Care Mode, acknowledgement y sesiones (Módulos 15–20)

| Req                                                                                                           | Estado                    |
| ------------------------------------------------------------------------------------------------------------- | ------------------------- |
| Care Pass mobile-first, IMPORTANTE primero, tel: en contactos                                                 | ✅                        |
| Solo categorías autorizadas                                                                                   | ✅ (filtrado en servidor) |
| Acknowledgement con quién/cuándo/sesión/versión → AuditEvent                                                  | ✅                        |
| Care Session: inicio, fin, eventos (comida, agua, baño, sueño, medicamento, actividad, comentario, incidente) | ✅                        |
| Timeline                                                                                                      | ✅ (cuidador y tutor)     |
| "What's changed?" desde la última revisión                                                                    | ✅                        |

## Auditoría (Módulos 21–22)

| Req                                                                  | Estado |
| -------------------------------------------------------------------- | ------ |
| `AuditService` centralizado, eventos definidos                       | ✅     |
| Actor, fecha, recurso, IP, user agent, contexto, institución, sesión | ✅     |
| Vista "¿Quién accedió a la información de Mateo?"                    | ✅     |

## Institución (Módulos 23–26)

| Req                                                                                  | Estado                   |
| ------------------------------------------------------------------------------------ | ------------------------ |
| Crear organización, código de invitación, miembros ADMIN/MEMBER                      | ✅                       |
| Solicitudes pendientes: aceptar / rechazar                                           | ✅                       |
| Dashboard: niños, alertas críticas, perfiles actualizados, confirmaciones pendientes | ✅                       |
| Lista de niños con filtros (alergias, modificados, nuevos, por vencer)               | ✅                       |
| Vista de niño con "Compartido por / válido hasta / última actualización"             | ✅                       |
| Propuestas de cambio PROPOSED / ACCEPTED / REJECTED                                  | ✅                       |
| Al revocar: acceso fuera, perfil permanece                                           | ✅ (test de integración) |

## Documentos (Módulo 28)

| Req                                             | Estado                           |
| ----------------------------------------------- | -------------------------------- |
| Subida privada (PDF/imagen ≤ 10 MB), categorías | ✅                               |
| URLs firmadas con expiración (local y S3)       | ✅                               |
| Acceso auditado (`DOCUMENT_VIEWED`)             | ✅                               |
| Verificación documental                         | ⏭ (flag `DOCUMENT_VERIFICATION`) |

## Notificaciones (Módulo 51)

| Req                                                                                                                                                                              | Estado |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| In-app con eventos ACCESS_GRANTED, PROFILE_CHANGED, CRITICAL_DATA_CHANGED, CHANGE_PROPOSED, CARE_SESSION_STARTED/ENDED, INSTITUTION_REQUEST/CONNECTED, ACKNOWLEDGEMENT_COMPLETED | ✅     |
| `NotificationChannel` para email/push/WhatsApp/SMS                                                                                                                               | 🔜     |

## Transversales

| Req                                              | Estado                |
| ------------------------------------------------ | --------------------- |
| i18n es/en, español por defecto                  | ✅                    |
| PWA instalable (manifest, iconos, SW solo shell) | ✅                    |
| API versionada `/api/v1`                         | ✅                    |
| Feature flags                                    | ✅                    |
| Eventos de producto                              | ✅ (`ProductEvent`)   |
| `IntegrationAdapter`                             | 🔜 (contrato + stubs) |
