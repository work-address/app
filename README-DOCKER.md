## About

All commands assume you are in the project root (the directory that contains `docker-compose.yml`).

### Run services (production) locally

Nginx reverse proxy listens on port 8000 and routes by path: `/api` → Node.js API, `/` → web (React). SSL is handled by the server provider.

Requires `.env` in project root with Postgres and JWT config.

| Path | Service |
|------|---------|
| / | Web (React) |
| /api | Node.js API |

```sh
docker compose up --build
```

Access at http://localhost:8000

### Run services in development (watch mode)

Uses `dockerfile.dev` and Docker Compose watch to sync file changes into containers. Includes Redis; the API connects to an **external Postgres** (configure in `api/.env`).

| Service | URL |
|---------|-----|
| Web (Vite) | http://0.0.0.0:3000 |
| API | http://localhost:4000 |
| Swagger | http://localhost:4000/swagger |

Prerequisite: Copy `api/.env.example` to `api/.env` and set your external DB (`APP_DB_HOST`, etc.). Use `host.docker.internal` to reach Postgres on the host.

```sh
docker compose -f docker-compose-dev.yml up --watch
```

and for running the production environment
```sh
docker compose -f docker-compose.yml up --watch
```

Requires Docker Compose 2.22.0 or later (`docker compose version`).

### Commands

| Goal | Command |
|------|---------|
| Build and run in foreground | `docker compose up --build` |
| Run in background | `docker compose up --build -d` |
| Dev with watch (sync + rebuild) | `docker compose -f docker-compose-dev.yml up --watch` |
| Build only | `docker compose build` |
| Rebuild without cache | `docker compose build --no-cache` |
| Stop and remove containers | `docker compose down` |
| Stop and remove images | `docker compose down --rmi local` |
| Stop and remove volumes | `docker compose down -v` |
| Run specific service | `docker compose up --build web` or `docker compose up --build api` |

### Cleanup

```sh
# Stop and remove containers for this project
docker compose down

# Also remove images built by compose
docker compose down --rmi local

# Remove all stopped containers (system-wide)
docker container prune
```
