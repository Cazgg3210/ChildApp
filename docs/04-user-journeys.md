# 04 — User journeys

Los tres journeys principales del MVP. Cada uno está cubierto por un test E2E en `tests/e2e/`.

## Journey 1 — Parent (tutor)

```
Register --> Verify email (opcional en demo) --> Create child (onboarding 5 pasos)
   --> Complete profile --> Add critical information --> Share Care
   --> Select recipient type --> Select information --> Define expiration (+PIN)
   --> Permission preview --> Generate link / QR --> Caregiver reviews
   --> Parent receives access log + notifications
```

| Paso           | Pantalla                                | Regla clave                                                                                                                                                                                |
| -------------- | --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Registro       | `/register`                             | Email + contraseña (>= 10 chars). Se envía token de verificación (en demo, se imprime en consola).                                                                                         |
| Dashboard      | `/app`                                  | Saludo, hijos, cuidadores activos, instituciones conectadas, accesos próximos a expirar, cambios recientes.                                                                                |
| Crear hijo     | `/app/children/new`                     | Onboarding progresivo: (1) básicos, (2) seguridad: alergias/medicación/contacto, (3) comida, (4) sueño y confort, (5) listo para compartir. Nunca 50 campos de golpe.                      |
| Perfil         | `/app/children/[id]/sections/[section]` | Cada sección lista _items_ con criticidad y procedencia. Cada guardado crea una versión.                                                                                                   |
| Compartir      | `/app/children/[id]/share/new`          | Tipo de destinatario → categorías (default = mínimo necesario según tipo) → vigencia + PIN + usos → **Permission Preview obligatorio** ("Carla podrá ver… / NO podrá ver…") → enlace + QR. |
| Red de cuidado | `/app/children/[id]/network`            | Todos los accesos con estado, vigencia, categorías; revocación en un clic.                                                                                                                 |
| Actividad      | `/app/children/[id]/activity`           | "¿Quién accedió a la información de Mateo?" con actor, categorías vistas, fecha.                                                                                                           |

## Journey 2 — Caregiver (Carla, sin cuenta)

```
Receive link / scan QR --> Open Care Pass (/s/:token) --> Enter PIN (si aplica)
   --> See critical information first --> Acknowledge
   --> Start Care Session --> Record activity (food, sleep, medication, note, incident)
   --> End Care Session
```

| Paso           | Pantalla             | Regla clave                                                                                                                                                  |
| -------------- | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Abrir          | `/s/[token]`         | Token validado (hash), vigencia, estado, usos. Si no es válido: mensaje comprensible ("Este acceso ya expiró. Solicita al padre o tutor un nuevo enlace.").  |
| PIN            | `/s/[token]` (gate)  | Si el share tiene PIN, se pide; intentos limitados; cookie corta tras validar.                                                                               |
| Care Mode      | `/s/[token]`         | Mobile-first. Bloque IMPORTANT (críticos) arriba: alergias, medicación, contactos. Después Food, Sleep, Comfort, Communication… Solo categorías autorizadas. |
| What's changed | `/s/[token]`         | Si ya reconoció antes: "3 cambios desde tu última revisión".                                                                                                 |
| Acknowledge    | `/s/[token]`         | "He revisado la información crítica de Mateo." Registra actor, fecha, sesión, versión del perfil → `AuditEvent`.                                             |
| Care Session   | `/s/[token]/session` | Inicio/fin; timeline con eventos y hora.                                                                                                                     |

No se exige registro para acceso temporal. Todo acceso genera `PROFILE_VIEWED` / `CRITICAL_DATA_VIEWED`.

## Journey 3 — Institution (Kinder Arcoíris)

```
Institution admin creates organization --> Guardian shares child with the institution
   --> Institution accepts relationship --> Child appears in dashboard
   --> Teacher reviews care profile --> Teacher confirms critical info
   --> Institution proposes an observation --> Guardian approves / rejects
```

| Paso                      | Pantalla                                          | Regla clave                                                                                                                                 |
| ------------------------- | ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Crear organización        | `/institution/new`                                | Cualquier usuario puede crear una institución y queda como ADMIN.                                                                           |
| Compartir con institución | `/app/children/[id]/share/new` (tipo Institution) | El tutor busca la institución por código de invitación. Se crea `AccessGrant` en `PENDING` + `Consent` + `ChildInstitution PENDING`.        |
| Aceptar                   | `/institution/requests`                           | Un ADMIN acepta → grant `ACTIVE`, `INSTITUTION_CONNECTED`.                                                                                  |
| Dashboard                 | `/institution`                                    | Niños, alertas críticas, perfiles actualizados, confirmaciones pendientes.                                                                  |
| Lista                     | `/institution/children`                           | Nombre, foto, edad, alergias críticas, última actualización, estado del consentimiento. Filtros: alergias, modificados, nuevos, por vencer. |
| Vista de niño             | `/institution/children/[id]`                      | Solo categorías autorizadas. Muestra "Compartido por / Permiso válido hasta / Última actualización". Botón de confirmación de lectura.      |
| Proponer                  | `/institution/children/[id]`                      | "La maestra observó…" → `ChangeProposal PROPOSED`.                                                                                          |
| Revisar                   | `/app/children/[id]/proposals`                    | El tutor acepta (se crea `ProfileItem` con procedencia OBSERVED / fuente institución) o rechaza.                                            |

Principio inquebrantable: si el niño deja la institución, _Institution access → revoked; Child profile → remains_.

## Estados de error y vacíos (extracto)

| Situación             | Copy                                                                                                                       |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Sin hijos             | "Aún no has creado ningún perfil. Empieza con lo básico; podrás completar el resto después."                               |
| Sin cuidadores        | "Aún no hay cuidadores. Comparte la información de cuidado de Mateo con alguien de confianza." CTA: **Compartir cuidado**. |
| Acceso expirado       | "Este acceso ya expiró. Solicita al padre o tutor un nuevo enlace."                                                        |
| Acceso revocado       | "Este acceso fue revocado por el tutor."                                                                                   |
| PIN incorrecto        | "El PIN no es correcto. Te quedan N intentos."                                                                             |
| Institución sin niños | "Todavía no hay niños compartidos con esta institución. Pide a las familias que compartan el perfil usando tu código."     |
