# ADR-001 — Next.js 16 como monolito modular

**Estado**: aceptada · **Fecha**: 2026-09-19

## Contexto

El MVP necesita frontend, backend, API y autorización propia con un equipo pequeño, y debe poder evolucionar a producto sin reescritura. El prompt exige separación conceptual domain/application/infrastructure/presentation y prohíbe microservicios.

## Decisión

Una sola aplicación Next.js 16 (App Router, Turbopack) organizada en módulos por bounded context bajo `src/modules/*`. Server Components para lectura, Server Actions para mutaciones de la UI y Route Handlers `/api/v1` para integraciones, todos sobre los mismos application services. La lógica de negocio nunca vive en componentes React.

## Consecuencias

- Un solo runtime y un solo contenedor; despliegue trivial.
- Las fronteras entre módulos son convenciones (imports), no procesos: se documentan y se revisan en PR.
- Extraer un módulo a servicio independiente es posible porque cada uno expone solo su application service.
- Riesgo: Next 16 introduce convenciones nuevas (`proxy.ts`, request APIs async); se siguen los docs empaquetados en `node_modules/next/dist/docs`.
