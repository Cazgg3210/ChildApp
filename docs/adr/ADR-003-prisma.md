# ADR-003 — Prisma 7 como ORM

**Estado**: aceptada · **Fecha**: 2026-09-19

## Contexto

Necesitamos migraciones versionadas, tipado fuerte y transacciones. Prisma 7 elimina el motor Rust y usa driver adapters (`@prisma/adapter-pg`) con `prisma.config.ts`.

## Decisión

Prisma 7.10 con `@prisma/adapter-pg`, cliente generado en `src/generated/prisma` (ignorado en git, regenerado en `postinstall`/`build`). Los repositorios (`modules/*/infrastructure`) son el único lugar con consultas Prisma; los servicios de aplicación componen transacciones con `prisma.$transaction(async (tx) => …)`.

## Consecuencias

- Migraciones reproducibles (`prisma migrate deploy` en el entrypoint del contenedor).
- Enums de Prisma para valores cerrados; strings validados por dominio para catálogos que crecen (`itemType`, `AuditEvent.type`).
- Alternativa descartada: Drizzle (migraciones interactivas menos maduras para el equipo).
