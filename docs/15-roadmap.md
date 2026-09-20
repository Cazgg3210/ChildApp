# 15 — Roadmap

## MVP (este repositorio)

Todo lo descrito en el Master Prompt y en [05-functional-requirements](05-functional-requirements.md):

- Autenticación email/password, verificación de email, reset de contraseña.
- Guardian Account y dashboard.
- Child Profile por secciones con provenance, criticidad y versionado.
- Care Share: grants granulares, share link, QR, PIN, expiración, revocación, permission preview.
- Care Mode mobile-first, acknowledgement, care sessions y timeline.
- Institution Portal Lite: organización, miembros, niños compartidos, alertas, propuestas de cambio.
- Consent Ledger, Audit Log y vista "¿quién accedió?".
- Change detection ("What's changed?").
- Document Vault básico (storage privado, URLs firmadas).
- Notificaciones in-app.
- AI Assistant con proveedor heurístico y feature flag.
- i18n es/en, PWA instalable, Docker, CI.

## V1

- Push notifications (Web Push) y email transaccional real (Resend/SMTP) usando `NotificationChannel` y `Mailer`.
- Invitación de co-guardian por email (con aceptación) y grupos familiares.
- Google / Apple OAuth (proveedores adicionales de Auth.js; tabla `Account` ya existe).
- Cuentas para cuidadores recurrentes (vincular un `AccessGrant` a un `User`).
- Portal institucional más rico: grupos/salas, miembros por sala, exportación de fichas de emergencia.
- Más tipos de documentos y verificación documental (`DOCUMENT_VERIFICATION`).
- Emergency Share (§77): enlace temporal de solo información crítica generado en un toque.
- Exportación y borrado de cuenta completos (`EXPORT DATA`, `DELETE ACCOUNT`) con job de retención.
- Rate limiting distribuido (Redis) si hay varias instancias.
- Modo offline limitado (solo el Care Pass ya abierto, cifrado en IndexedDB con caducidad).

## V2

- Verified credentials de profesionales (pediatra verifica alergia → `VERIFIED`).
- Integraciones: `FamlyAdapter`, `BrightwheelAdapter`, `StoryparkAdapter`, `ProcareAdapter` sobre `IntegrationAdapter`.
- FHIR (AllergyIntolerance, Immunization, MedicationStatement) como formato de intercambio.
- Integraciones con sistemas escolares y APIs gubernamentales por país.
- Multi-región regulatoria (`regulatoryRegion`): políticas de retención por región.

## Futuro

- W3C Verifiable Credentials: el perfil como credencial portable firmada por la familia y contrafirmada por profesionales.
- Wallet del tutor y presentación selectiva (selective disclosure).

## Lo que no está en ningún horizonte

ERP escolar, contabilidad, nómina, facturación, LMS, control académico, diagnóstico, red social.
