# ADR-004 — Autorización RBAC + ABAC centralizada

**Estado**: aceptada · **Fecha**: 2026-09-19

## Contexto

Los permisos dependen del rol relacional (tutor, miembro de institución) **y** de atributos del acceso (categorías, capacidades, ventana temporal, estado, PIN, usos). Validaciones dispersas tipo `if (user.role === "parent")` están prohibidas.

## Decisión

`AuthorizationService.can(actor, action, childId, ctx)` es la única fuente de verdad. Carga hechos (`AccessFacts`: rol de tutor, grants directos, grants institucionales) y delega en `decide()`, una función pura y testeable. Los componentes reciben decisiones (`ChildAccess` con categorías y capacidades), nunca roles.

Reglas clave:

- Acciones de tutor (`profile.update`, `share.*`, `audit.read`, `proposal.review`, `child.delete`…) nunca se alcanzan por grant.
- Acciones del cuidador mapean a capacidades (`acknowledge → ACKNOWLEDGE`, `care_session.run → RUN_CARE_SESSION`, `proposal.create → PROPOSE_CHANGES`, `document.read → VIEW_DOCUMENTS`).
- La vigencia se evalúa en cada petición (`evaluateGrantValidity`).

## Consecuencias

- Tests unitarios de escalada de privilegios sin BD.
- Añadir una acción = añadir un caso en `decide()` y en la tabla de [10-permissions-model](../10-permissions-model.md).
- Un usuario puede tener varias vías (tutor + institución); gana la más privilegiada válida.
