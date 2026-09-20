# ADR-006 — Versionado del perfil y detección de cambios

**Estado**: aceptada · **Fecha**: 2026-09-19

## Contexto

Un cuidador que vuelve debe ver "3 cambios desde tu última revisión". Se necesita identificar versión anterior, versión actual y cambios relevantes, restringidos a lo que ese cuidador puede ver.

## Decisión

- `Child.profileVersion` (entero) se incrementa en cada mutación de `ProfileItem` dentro de una transacción.
- Cada mutación escribe `ChildProfileVersion { version, snapshot, changes, summary }`, donde `changes` es un diff estructurado `[{ op, itemId, section, category, itemType, label, critical }]` calculado por `computeChanges()` (puro).
- `Acknowledgement.profileVersion` y `CareSession.profileVersionAtStart` anclan la última revisión de cada actor.
- "What's changed" = concatenar `changes` de las versiones posteriores a la última confirmación, colapsar por item y filtrar por categorías del grant.

## Alternativas

- Event sourcing completo: más potente, más complejo; innecesario en MVP.
- Solo `updatedAt` por item: no distingue eliminaciones ni permite resumen por categoría.

## Consecuencias

- Coste: un snapshot JSON por mutación (decenas de items). Aceptable; en V1 se puede compactar (snapshot cada N versiones).
- La auditoría distingue `PROFILE_UPDATED` de `CRITICAL_DATA_CHANGED` a partir del diff.
