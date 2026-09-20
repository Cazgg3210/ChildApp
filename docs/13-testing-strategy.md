# 13 — Estrategia de testing

## Pirámide

| Nivel       | Herramienta                    | Alcance                                                                                                                                                   | Comando                    |
| ----------- | ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------- |
| Unit        | Vitest                         | Dominio puro: política de autorización (`decide`, `evaluateGrantValidity`), versionado/diff, catálogo, tokens, esquema de share, proveedor IA heurístico. | `npm run test`             |
| Integration | Vitest + PostgreSQL            | Servicios completos con BD real: sharing, autorización, care, instituciones, versionado y auditoría.                                                      | `npm run test:integration` |
| E2E         | Playwright (desktop + Pixel 7) | Los tres journeys sobre la UI real + API.                                                                                                                 | `npm run test:e2e`         |

CI ejecuta `install → lint → typecheck → migrate → unit → integration → build` y, en un job separado, `seed → build → e2e` (`.github/workflows/ci.yml`).

## Cobertura de los criterios de aceptación

| Escenario                                                                 | Test                                                                                              |
| ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| A — crear hijo, completar perfil, generar Care Pass, permisos, expiración | `tests/e2e/parent-journey.spec.ts`                                                                |
| B — cuidador ve solo información autorizada desde el teléfono             | `tests/e2e/caregiver.spec.ts` (proyecto `mobile`), `tests/integration/sharing-security.test.ts`   |
| C — revocar acceso → el enlace deja de funcionar                          | `parent-journey.spec.ts` ("revoking access…"), `sharing-security.test.ts`                         |
| D — el padre ve quién consultó                                            | `parent-journey.spec.ts` (Actividad)                                                              |
| E — institución administra varios perfiles                                | `institution-journey.spec.ts`, `tests/integration/institution.test.ts`                            |
| F — institución propone observación                                       | idem                                                                                              |
| G — padre aprueba/rechaza                                                 | idem (aceptación → provenance OBSERVED)                                                           |
| H — cambios críticos registrados                                          | `parent-journey.spec.ts` (`CRITICAL_DATA_CHANGED`), `sharing-security.test.ts` (Change detection) |
| I — E2E principales pasan                                                 | los tres spec anteriores                                                                          |

## Pruebas de seguridad explícitas (§60)

| Caso                                  | Test                                                                                                                                                                        |
| ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Cuidador tras expiración              | `policy.test.ts`, `sharing-security.test.ts` ("expired and not-yet-started")                                                                                                |
| Cuidador viendo campos no compartidos | `decide.test.ts`, `sharing-security.test.ts`, `caregiver.spec.ts` (`Secreto de baño` ausente)                                                                               |
| Institución accediendo a otro niño    | `institution.test.ts`, `institution-journey.spec.ts` (404)                                                                                                                  |
| Token inválido                        | `sharing-security.test.ts`, `institution-journey.spec.ts` (API 400)                                                                                                         |
| Token revocado                        | `sharing-security.test.ts`, `parent-journey.spec.ts`                                                                                                                        |
| Usuario no autenticado                | `decide.test.ts` (anonymous), E2E API 401                                                                                                                                   |
| Escalada de privilegios               | `decide.test.ts` (grant → acciones de tutor), `sharing-security.test.ts` (link actor, co-guardian, extraño), `institution.test.ts` (miembro → admin, institución → edición) |
| PIN: intentos y bloqueo               | `sharing-security.test.ts`                                                                                                                                                  |
| Acceso único agotado                  | `policy.test.ts`, `sharing-security.test.ts`                                                                                                                                |
| Rotación de enlace                    | `sharing-security.test.ts`                                                                                                                                                  |

## Convenciones

- Los tests de integración crean usuarios con emails únicos y limpian en `afterAll` (`tests/integration/setup.ts`).
- Los E2E dependen del seed demo (`npm run db:seed`) para el journey institucional; los journeys de tutor registran usuarios nuevos.
- Ningún test usa `sleep`; se espera por estado de UI o respuestas.
- Los tests de dominio no tocan la BD.

## Definition of Done por pantalla

Responsive · loading (Suspense/RSC) · empty state · error state · validación · autorización en servicio · accesibilidad básica · test cuando corresponda.
