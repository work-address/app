## About

All commands assume you are in the project root (the directory that contains `docker-compose.yml`).

### Run services (production) locally

Nginx reverse proxy listens on port 8000 and routes by path: `/api` → Node.js API, `/` → web (React). SSL is handled by the server provider.

Requires Postgres config: copy `.env.example` to `.env` in the project root (or use existing `api/.env` — compose loads both). Use `host.docker.internal` for `APP_DB_HOST` when Postgres runs on the host, not `localhost`.
```sh
docker compose -f docker-compose.yml up --watch
```

Access at http://localhost:8000

### Run services in development (watch mode)

Uses `dockerfile.dev` and Docker Compose watch to sync file changes into containers. Includes Redis; the API connects to an **external Postgres** (configure in `api/.env`).

| Service | URL |
|---------|-----|
| Web (Vite) | http://localhost:8000 |
| API | http://localhost:4000 |
| Swagger | http://localhost:4000/swagger |

Prerequisite: Copy `api/.env.example` to `api/.env` and set your external DB (`APP_DB_HOST`, etc.). Use `host.docker.internal` to reach Postgres on the host.

```sh
docker compose -f docker-compose-dev.yml up --watch
```

### Cleanup

```sh
# Stop and remove containers for this project
docker compose down

# Also remove images built by compose
docker compose down --rmi local

# Remove all stopped containers (system-wide)
docker container prune
```
