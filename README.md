# Child Care Passport — MVP

> **Create once. Control always. Share anywhere.**
>
> Plataforma B2B2C donde los tutores crean una sola vez el perfil de cuidado de sus hijos y lo comparten de forma selectiva, temporal, revocable y auditable con familiares, cuidadores e instituciones.

Nombre provisional. Documentación completa en [`/docs`](docs/) — empieza por [docs/00-project-analysis.md](docs/00-project-analysis.md).

## Stack

Next.js 16 (App Router) · TypeScript strict · Tailwind 4 + shadcn/ui · PostgreSQL 16 + Prisma 7 · Auth.js v5 · next-intl (es/en) · Vitest · Playwright · Docker · GitHub Actions.

Arquitectura: **monolito modular** por bounded contexts (`src/modules/*`), ver [docs/07-architecture.md](docs/07-architecture.md).

## Demo en 3 comandos

Requisitos: Node ≥ 20.9, Docker.

```bash
cp .env.example .env            # ajusta AUTH_SECRET si lo deseas
docker compose up -d postgres   # PostgreSQL en el puerto 5470
npm install && npm run db:migrate && npm run db:seed
npm run dev
```

Abre <http://localhost:3000>. El seed imprime en consola los enlaces de Care Pass de la demo (los tokens no se almacenan en texto plano; se muestran una sola vez).

> Si el puerto 3000 está ocupado: `npm run dev -- -p 3100` y ajusta `APP_URL` en `.env`.

### Credenciales demo

| Rol                                          | Email                     | Contraseña        |
| -------------------------------------------- | ------------------------- | ----------------- |
| Tutor (Luis)                                 | `parent@example.com`      | `Demo1234!secure` |
| Co-tutora (Andrea)                           | `andrea@example.com`      | `Demo1234!secure` |
| Admin institución (Mariana, Kinder Arcoíris) | `institution@example.com` | `Demo1234!secure` |
| Maestra (Sofía, Kinder Arcoíris)             | `teacher@example.com`     | `Demo1234!secure` |

Otras familias del kínder (para que el portal institucional tenga contexto): `paola@example.com`, `diego@example.com`, `fernanda@example.com` (misma contraseña). El kínder está **verificado** y tiene dos salas: _Sala Azul_ (Sofía, Mateo, Emilia) y _Sala Verde_ (Santiago); Regina no tiene sala (solo la ve Mariana).

Cuidadoras sin cuenta: **Abuela Rosa** (enlace sin PIN) y **Carla** (enlace con PIN `2468`). Los enlaces se imprimen al ejecutar `npm run db:seed`. La contraseña demo solo se crea con `SEED_DEMO=true`; el seed se niega a correr en producción.

### Guion de la demo (≈10 minutos)

1. **Luis** (`/app`) → _Agregar hijo_ → onboarding de 5 pasos: alergia, contacto, comida, sueño, objeto de confort.
2. Perfil → secciones con criticidad y procedencia; prueba el **asistente** con: _"Mateo no puede comer cacahuates, duerme normalmente a las dos, y cuando se pone nervioso busca su dinosaurio azul."_
3. **Compartir cuidado** → Niñera _Carla_ → categorías por defecto → vigencia + PIN → **Permission Preview** → enlace + QR.
4. Abre el enlace desde el celular (o modo móvil): PIN → **Care Mode** (IMPORTANTE arriba) → _He revisado la información crítica_ → **Sesión de cuidado** → registrar comida → finalizar.
5. Luis → _Actividad_: "¿Quién accedió a la información de Mateo?" y _Sesiones de cuidado_.
6. Compartir con **Kinder Arcoíris** (código en el dashboard de la institución) → **Mariana** acepta en _Solicitudes_ → Mateo aparece en la lista.
7. **Sofía** revisa el perfil, confirma lectura y _propone una observación_ → **Luis** la acepta en _Propuestas_ → aparece en el perfil con procedencia _Observado · Kinder Arcoíris_.
8. Luis edita una alergia → Carla, al volver a abrir el enlace, ve **"1 cambio desde tu última revisión"**.
9. Luis **revoca** el acceso de Carla → el enlace deja de funcionar de inmediato.

## Scripts

| Comando                                                                   | Qué hace                                                    |
| ------------------------------------------------------------------------- | ----------------------------------------------------------- |
| `npm run dev`                                                             | Servidor de desarrollo (Turbopack).                         |
| `npm run build` / `npm start`                                             | Build de producción (`output: standalone`) y arranque.      |
| `npm run lint` · `npm run typecheck`                                      | ESLint · `next typegen && tsc --noEmit`.                    |
| `npm run test`                                                            | Tests unitarios (Vitest).                                   |
| `npm run test:integration`                                                | Tests de integración contra PostgreSQL (`DATABASE_URL`).    |
| `npm run test:e2e`                                                        | Playwright (3 journeys + seguridad). Requiere seed cargado. |
| `npm run db:migrate` · `db:deploy` · `db:seed` · `db:reset` · `db:studio` | Prisma.                                                     |
| `npm run icons`                                                           | Regenera los iconos PWA.                                    |

## Estructura

```
src/app/          rutas (public · (parent)/app · (institution)/institution · s/[token] · api/v1)
src/modules/      identity · children · profiles · authorization · sharing · consent · care
                  institutions · audit · documents · notifications · ai · analytics · integrations
src/shared/       config (env, flags) · db · errors · http · i18n · logging · security · domain
prisma/           schema.prisma · migrations · seed.ts
messages/         es.json · en.json
tests/            unit · integration · e2e
docs/             producto, arquitectura, seguridad, permisos, API, testing, deploy, ADRs
```

## Seguridad en dos líneas

Los enlaces compartidos usan tokens de 256 bits almacenados como SHA-256, con expiración, PIN opcional, acceso único y revocación inmediata; cada apertura queda auditada. Toda lectura/escritura pasa por `AuthorizationService` (RBAC + ABAC): las instituciones **nunca** editan el perfil, solo proponen. Detalles: [docs/09-security-model.md](docs/09-security-model.md) y [docs/10-permissions-model.md](docs/10-permissions-model.md).

## Despliegue

`Dockerfile` multi-stage (migraciones automáticas al arrancar) + `docker-compose.yml` (perfil `full`) + kit `deploy/` para VM con Caddy. Guías para **Dokploy**, Droplet y App Platform en [docs/14-deployment.md](docs/14-deployment.md). Demo en servidores sin shell: `POST /api/v1/admin/seed` con `X-Seed-Token`.

```bash
docker compose --profile full up --build
```

## Estado

MVP completo según [docs/05-functional-requirements.md](docs/05-functional-requirements.md) y criterios de aceptación A–I. Roadmap V1/V2 en [docs/15-roadmap.md](docs/15-roadmap.md).
