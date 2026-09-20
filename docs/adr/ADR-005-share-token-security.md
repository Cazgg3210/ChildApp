# ADR-005 — Seguridad de tokens de compartir

**Estado**: aceptada · **Fecha**: 2026-09-19

## Contexto

Los enlaces `/s/<token>` dan acceso a información sensible de menores sin cuenta. Deben ser imposibles de adivinar, revocables, expirables y no deben comprometerse si la base de datos se filtra.

## Decisión

- `token = base64url(randomBytes(32))` (256 bits). Solo `sha256(token)` se persiste (`ShareLink.tokenHash`, único).
- El token en claro se devuelve **una sola vez** (URL + QR). Para volver a mostrar el QR se **rota** el token (el anterior deja de funcionar).
- El QR contiene únicamente la URL.
- PIN opcional (4–6 dígitos) con hash bcrypt, máximo 5 intentos, bloqueo del enlace, rate limit por IP.
- Tras validar el PIN se emite una cookie `cp_<linkId>` firmada (HMAC-SHA256 con `AUTH_SECRET`, 12 h). Igual para la cookie "visto" `cps_<linkId>` que implementa el acceso único por dispositivo.
- Validez (estado, ventana temporal, usos, PIN) se evalúa en cada petición; la revocación es inmediata.
- Cada resolución exitosa o denegada genera un `AuditEvent` (`SHARE_LINK_OPENED`, `SHARE_LINK_DENIED`, `PIN_FAILED`, `PIN_LOCKED`).

## Consecuencias

- Una fuga de BD no expone enlaces utilizables.
- El tutor no puede "ver el enlace" antiguo: solo regenerarlo. Se comunica en la UI ("Ver enlace y QR" = regenerar).
- Los tokens de verificación de email y reset usan el mismo esquema (hash + expiración + un uso).
