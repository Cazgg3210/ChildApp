# 01 — Visión del producto

## Nombre provisional

**Child Care Passport** (también _Child Care Identity & Exchange Platform_). El código y la arquitectura no dependen del nombre comercial: el nombre visible se centraliza en `src/shared/config/brand.ts` y en los mensajes i18n.

## El problema

Cada vez que otra persona o institución queda responsable de un niño, los padres repiten la misma información: alergias, medicamentos, contactos de emergencia, rutina de sueño, qué lo tranquiliza, qué come y qué no.

Esa información se dispersa en formularios de papel, chats de WhatsApp, PDFs escaneados y la memoria de los adultos. Se desactualiza. Se comparte de más. Y nunca queda registro de quién la vio.

## La solución

> Crear la información una sola vez, mantenerla actualizada y compartirla selectivamente con quien corresponda.

**Create once. Control always. Share anywhere.**

El tutor es dueño del perfil. Los cuidadores e instituciones reciben **acceso autorizado, acotado y temporal**. Todo acceso queda auditado. Todo consentimiento es revocable.

## Tesis

Existen dos familias de soluciones:

- **Institution-first** (Brightwheel, Procare, Famly, sistemas escolares): la institución crea el expediente; el perfil pertenece funcionalmente a su ecosistema. Cuando el niño cambia de guardería, la información se pierde.
- **Parent-first** (notas, plantillas, apps de babysitting): los padres escriben información para cuidadores puntuales, sin estructura ni control de acceso.

Child Care Passport combina ambas: **el perfil es de la familia; las instituciones se conectan a él**. El perfil viaja con el niño a través de guarderías, escuelas, campamentos, academias y cuidadores, y sobrevive a cada uno de ellos.

```
                     FAMILY
                       |  owns / controls
                       v
                  CHILD PROFILE
                       |
           +-----------+-----------+
           v           v           v
       CAREGIVER   INSTITUTION   FAMILY
           |           |           |
           +-----------+-----------+
                       |
                  PERMISSIONS
                  CONSENT
                  AUDIT
```

## Principios de producto (prioridades absolutas)

1. **TRUST** — el producto debe transmitir seguridad y calma; nada de dark patterns.
2. **PRIVACY** — privacy by design y minimización: solo información _necesaria + autorizada + vigente_.
3. **CONTROL** — el tutor decide qué, a quién, hasta cuándo, y puede revocar en un clic.
4. **SIMPLICITY** — la información crítica se localiza en segundos, desde un celular.
5. **PORTABILITY** — el perfil pertenece a la familia y sobrevive a cualquier institución.
6. **INTEROPERABILITY** — API-first y adaptadores para conectar con el ecosistema existente.

La regla final para cualquier decisión: _¿esto ayuda a que un padre pueda compartir de forma más segura, sencilla y controlada la información necesaria para cuidar a su hijo?_ Si no, no pertenece al MVP.

## Lo que NO construimos

No somos ni queremos ser: otro Brightwheel/Procare/Famly/Storypark, un ERP escolar, contabilidad, nómina, facturación, CRM educativo, LMS, control académico, sistema médico, diagnóstico psicológico ni red social infantil.

El foco es exclusivamente:

> **Identidad + información de cuidado + consentimiento + permisos + interoperabilidad + trazabilidad.**

## Usuarios

| Actor              | Descripción                                                | Qué obtiene                                                                                      |
| ------------------ | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Guardian (tutor)   | Padre, madre, tutor legal. Owner o co-guardian del perfil. | Un solo lugar para mantener la información; control y trazabilidad total.                        |
| Family caregiver   | Abuelos, tíos, hermanos mayores.                           | Acceso estable a rutina + emergencia sin pedir cada vez.                                         |
| External caregiver | Niñera, babysitter, cuidador particular.                   | Un Care Pass en el celular: lo crítico primero, y una forma simple de registrar la sesión.       |
| Institution member | Educadora, maestra, coordinadora.                          | Perfil de cuidado actualizado y confirmación de lectura de lo crítico.                           |
| Institution admin  | Dirección de guardería/kínder/academia.                    | Panel con niños compartidos, alertas críticas, perfiles actualizados, confirmaciones pendientes. |

El niño **no** tiene cuenta. El tutor controla la identidad del menor (`Guardian Account → Child Profile[]`).

## Propuesta de valor por segmento

- **Familias**: dejan de repetir información; comparten con confianza; ven quién accedió; mantienen el perfil aunque cambien de institución.
- **Instituciones**: reciben perfiles completos, estructurados y actualizados por la familia, con consentimiento verificable y confirmaciones de lectura de información crítica. Reducen riesgo y formularios en papel.
- **Cuidadores**: una página móvil, sin registro, con lo importante primero.

## Métricas de producto (eventos preparados)

`PROFILE_CREATED`, `PROFILE_COMPLETED`, `SHARE_CREATED`, `SHARE_OPENED`, `ACKNOWLEDGEMENT_COMPLETED`, `CARE_SESSION_CREATED`, `INSTITUTION_CONNECTED`, `PROFILE_UPDATED`, `CRITICAL_CHANGE`.

KPIs futuros: perfiles creados, tasa de completitud, Care Shares por familia, tasa de apertura, invitaciones a instituciones, activación institucional, familias e instituciones activas.

## Demo objetivo (10 minutos)

1. Luis crea a Mateo y completa alergia, alimentación, sueño y objeto de confort.
2. Comparte con Carla (babysitter) con expiración; genera QR.
3. Carla abre el Care Pass desde el celular, ve solo lo autorizado y confirma lectura.
4. Carla inicia una Care Session, registra la cena y la cierra.
5. Luis ve la actividad y quién accedió.
6. Luis comparte con Kinder Arcoíris; Mariana (admin) acepta; Mateo aparece en el dashboard.
7. Sofía (maestra) propone una observación; Luis la aprueba y aparece en el perfil con procedencia "Observado por Kinder Arcoíris".
