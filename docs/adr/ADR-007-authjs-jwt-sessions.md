# ADR-007 — Auth.js v5 con sesiones JWT y `sessionVersion`

**Estado**: aceptada · **Fecha**: 2026-09-19

## Contexto

El prompt prefiere Auth.js y exige preparación para Google/Apple. El proveedor Credentials de Auth.js solo funciona con estrategia JWT, que por sí sola no permite revocar sesiones.

## Decisión

Auth.js v5 (`next-auth@beta`) con Credentials + JWT (30 días). El token incluye `sv` = `User.sessionVersion`; `getCurrentUser()` rechaza tokens cuya versión no coincide. Cambiar la contraseña (o un futuro "cerrar sesión en todos los dispositivos") incrementa `sessionVersion`. Google/Apple se activan por variables de entorno; la tabla `Account` ya existe.

Toda la dependencia de Auth.js está encapsulada en `modules/identity`; el resto del sistema solo conoce `getCurrentUser()` / `requireUserActor()` y el tipo `Actor`.

## Consecuencias

- Sin tabla de sesiones ni Redis.
- Revocación global inmediata; revocación por dispositivo queda para V1 (lista de sesiones).
- Riesgo de beta: mitigado por el aislamiento; sustituir por sesiones propias afectaría a un solo módulo.
