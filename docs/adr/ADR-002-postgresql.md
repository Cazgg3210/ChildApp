# ADR-002 — PostgreSQL

**Estado**: aceptada · **Fecha**: 2026-09-19

## Contexto

El modelo es relacional (niños, tutores, grants, consentimientos, sesiones) con algunos documentos semiestructurados (snapshots de versión, `data` de items, contexto de auditoría).

## Decisión

PostgreSQL 16. Arrays nativos (`String[]`) para categorías y capacidades, `JSONB` para snapshots/diffs/`data`, índices en FKs y en `(childId, createdAt)` de auditoría, `cuid` como identificador (no enumerable).

## Consecuencias

- Integridad referencial y transacciones interactivas (versionado atómico).
- Portabilidad: cualquier Postgres administrado (DigitalOcean, RDS, Neon, Supabase).
- Búsqueda full-text y RLS quedan disponibles para V1/V2 sin cambiar de motor.
