# 12 — Privacy by Design

Principio operativo: **mostrar solamente información necesaria + autorizada + vigente**. Nunca "porque podría ser útil".

## Cómo se aplica en cada capa

| Principio                            | Implementación                                                                                                                                                                         |
| ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Minimización por defecto             | Defaults de categorías por tipo de destinatario (mínimo necesario). `DOCUMENTS`, `HEALTH` (historial) y `PHOTO` nunca activos por defecto para familia/niñera/otro.                    |
| Consentimiento explícito e informado | Permission Preview obligatorio antes de crear un acceso; checkbox "Confirmo que quiero compartir esta información"; `Consent` ledger append-only con propósito, categorías y vigencia. |
| Limitación temporal                  | Expiración por defecto (4 h niñera, 6 meses familia, 1 año institución); aviso cuando no hay expiración; validez evaluada en cada petición.                                            |
| Revocabilidad                        | Un clic; efecto inmediato en enlace, consentimiento y relación institucional.                                                                                                          |
| Transparencia                        | "¿Quién puede ver esto?" en cada sección; "¿Quién accedió a la información de Mateo?" con categorías consultadas.                                                                      |
| Control del titular                  | Solo tutores editan; instituciones proponen; el perfil sobrevive a la institución.                                                                                                     |
| Sin identificación innecesaria       | Cuidadores temporales no necesitan cuenta; el actor de enlace es el grant.                                                                                                             |
| Sin etiquetas                        | Sección Social como observaciones contextuales; IA sin diagnóstico, clasificación ni inferencia.                                                                                       |
| Seguridad de datos                   | Tokens hasheados, storage privado con URLs firmadas, logs con redacción, cabeceras de seguridad, `noindex` en todo lo privado.                                                         |
| Portabilidad                         | Exportación JSON completa (`/api/v1/me/export`).                                                                                                                                       |
| Retención                            | Soft delete; eliminación de cuenta en dos pasos: solicitud (anonimiza, revoca accesos, retira los perfiles de los que la persona es único tutor principal) y purga definitiva a los 30 días. |
| "Ninguna" es un dato                 | Declaraciones explícitas `NO_KNOWN_ALLERGIES` / `NO_MEDICATIONS` con fecha; Care Readiness distingue "no hay alergias" de "nadie lo ha dicho". Las declaraciones caducan al año (re-confirmación). |
| Sin presión a sobre-compartir        | Care Readiness (3 comprobaciones de seguridad) separado de "perfil enriquecido" (secciones opcionales); nunca un 100 % que exija llenar todo.                                          |

## Clasificación de datos

| Clase            | Ejemplos                                               | Reglas                                                                                                  |
| ---------------- | ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------- |
| HIGHLY_SENSITIVE | Alergias, medicación, condiciones, vacunas, documentos | Auditar cada lectura como `CRITICAL_DATA_VIEWED`; nunca en cache offline; nunca en logs; nunca en URLs. |
| SENSITIVE        | Identidad, contactos, rutinas, comunicación, confort   | Auditar como `PROFILE_VIEWED`; solo por grant vigente.                                                  |
| NORMAL           | Juego, intereses, observaciones sociales               | Igual que SENSITIVE en el MVP (no hay datos públicos).                                                  |

## Base legal (México, LFPDPPP) y preparación global

- Aviso de privacidad y consentimiento: el `Consent` registra finalidad, categorías, vigencia y revocación por cada tercero.
- Datos de menores: la titularidad la ejerce el tutor (`ChildGuardian`); no existe cuenta del menor.
- Derechos ARCO: acceso y portabilidad (exportación) implementados; rectificación (edición), cancelación (soft delete + revocación) preparados; oposición = revocación.
- `regulatoryRegion` en `User` permite políticas diferenciadas (GDPR/COPPA) sin cambios de modelo.

## Lo que la IA NO hace

No diagnostica, no evalúa psicológicamente, no etiqueta, no estima inteligencia, no infiere enfermedades ni trastornos. Solo estructura el texto que el tutor escribió, y el tutor siempre confirma ("Review before saving"). El proveedor por defecto (`HeuristicAIProvider`) no envía datos fuera del servidor.

## Dark patterns prohibidos

No compartir más por defecto, no permisos ocultos, no esconder expiración, no dificultar la revocación. Revisado en cada pantalla de sharing.
