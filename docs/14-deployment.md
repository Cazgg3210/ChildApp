# 14 — Despliegue

## Artefactos

- `Dockerfile` multi-stage (Node 22 alpine, `output: standalone`, usuario no root, healthcheck). Target `migrate` para migraciones y seed.
- `docker-compose.yml`: servicio `postgres` (desarrollo) y perfil `full` con `app`.
- `.env.example`: todas las variables, con comentarios.

## Variables de entorno

| Variable                                          | Obligatoria | Descripción                                                            |
| ------------------------------------------------- | ----------- | ---------------------------------------------------------------------- |
| `DATABASE_URL`                                    | ✔           | PostgreSQL.                                                            |
| `AUTH_SECRET`                                     | ✔           | ≥ 32 caracteres. Firma JWT, cookies de PIN y URLs de archivos locales. |
| `APP_URL`                                         | ✔           | URL pública (enlaces de email, share links).                           |
| `SHARE_BASE_URL`                                  | –           | Dominio corto para Care Pass (p. ej. `https://care.app`).              |
| `AUTH_TRUST_HOST`                                 | ✔ (prod)    | `true` detrás de proxy.                                                |
| `MAILER_PROVIDER` / `SMTP_URL` / `MAIL_FROM`      | –           | `console` en demo.                                                     |
| `STORAGE_PROVIDER` + `S3_*` / `STORAGE_LOCAL_DIR` | –           | `local` (volumen) o `s3`.                                              |
| `AI_PROVIDER`                                     | –           | `heuristic` (por defecto).                                             |
| `FEATURE_*`                                       | –           | Flags.                                                                 |
| `SEED_DEMO`, `DEMO_PASSWORD`, `ALLOW_DEMO_SEED`   | –           | Solo demo. El seed se niega en producción sin `ALLOW_DEMO_SEED`.       |
| `RUN_MIGRATIONS`                                  | –           | `false` para desactivar `migrate deploy` en el entrypoint.             |
| `LOG_LEVEL`                                       | –           | pino.                                                                  |

## Local

```bash
docker compose up -d postgres
npm run db:migrate && npm run db:seed && npm run dev
```

## Docker completo (local)

```bash
AUTH_SECRET=$(openssl rand -base64 48) docker compose --profile full up --build
```

La app queda en `http://localhost:3000`; el servicio `migrate` aplica migraciones antes de arrancar `app`. Seed demo: `docker compose --profile full run --rm migrate npx prisma db seed`.

## DigitalOcean Droplet (VM con Docker)

Kit en [`deploy/`](../deploy/): `docker-compose.prod.yml` (postgres + migrate + app + Caddy con HTTPS automático), `Caddyfile`, `.env.production.example`.

1. **Droplet**: Ubuntu 22.04/24.04, ≥ 2 GB RAM (el build de la imagen necesita memoria; con 1 GB añade swap). Abre los puertos 22, 80 y 443 en el firewall.
2. **DNS**: apunta un dominio (A record) a la IP del Droplet. Sin dominio, usa `<IP>.sslip.io` como `SITE_ADDRESS` (Caddy obtiene certificado igualmente).
3. **Instala Docker** en el Droplet: `curl -fsSL https://get.docker.com | sh`.
4. **Sube el código** (git clone del repositorio, o `rsync`/`scp` excluyendo `node_modules`, `.next`, `.env`).
5. **Configura**: `cp deploy/.env.production.example .env.production` y rellena `SITE_ADDRESS`, `APP_URL`, `AUTH_SECRET` (`openssl rand -base64 48`), `POSTGRES_PASSWORD` (`openssl rand -hex 24`).
6. **Arranca**: `docker compose -f deploy/docker-compose.prod.yml --env-file .env.production up -d --build`.
7. **Seed demo (opcional)**: `docker compose -f deploy/docker-compose.prod.yml --env-file .env.production run --rm migrate npx prisma db seed` — imprime los enlaces de Care Pass.
8. **Verifica**: `https://<SITE_ADDRESS>/api/v1/health`.

Actualizar: `git pull && docker compose -f deploy/docker-compose.prod.yml --env-file .env.production up -d --build` (las migraciones pendientes se aplican solas).

Logs: `docker compose -f deploy/docker-compose.prod.yml logs -f app`. Backup de BD: `docker compose -f deploy/docker-compose.prod.yml exec postgres pg_dump -U ccp child_care_passport > backup.sql`.

> HTTPS es obligatorio en producción: las cookies de sesión y de PIN llevan `Secure`; sin TLS el login no funciona. Caddy lo resuelve automáticamente.

## DigitalOcean App Platform / EasyPanel

1. Crear un PostgreSQL administrado (o contenedor) y obtener `DATABASE_URL`.
2. Desplegar el `Dockerfile` (EasyPanel: _App → Docker → Dockerfile_; DO: _App Platform → Dockerfile_).
3. Definir variables: `DATABASE_URL`, `AUTH_SECRET`, `APP_URL`, `AUTH_TRUST_HOST=true`, `STORAGE_PROVIDER=s3` + credenciales de Spaces/R2 (recomendado en producción; `local` solo con volumen persistente).
4. Healthcheck: `GET /api/v1/health`.
5. HTTPS terminado en el proxy de la plataforma; la app envía `Strict-Transport-Security`.

## Migraciones

`prisma migrate deploy` corre en el servicio `migrate` antes de que arranque `app`. Para cambios de esquema: `npm run db:migrate --name <cambio>` en desarrollo, commit de `prisma/migrations/`, despliegue.

## Backups y retención

Backups del Postgres administrado (diario, 7–30 días). Los documentos viven en S3 con versionado. `AuditEvent` y `Consent` nunca se borran en el MVP.

## Checklist de producción

- [ ] `AUTH_SECRET` fuerte y rotado por entorno.
- [ ] `SEED_DEMO=false`.
- [ ] `MAILER_PROVIDER=smtp` con dominio verificado.
- [ ] `STORAGE_PROVIDER=s3` con bucket privado.
- [ ] Rate limiting distribuido si hay > 1 instancia (V1, Redis).
- [ ] Sentry/OTel enganchados en `src/instrumentation.ts`.
