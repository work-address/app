## Docker

All commands assume you are in the project root (the directory that contains `docker-compose.yml`).

### Run services (production) locally

| Service | URL |
|---------|-----|
| Web | http://localhost:8080 |
| API | http://localhost:4000 |

```sh
docker compose up --build
```

### Run services in development (watch mode)

Uses `dockerfile.dev` and Docker Compose watch to sync file changes into containers. Source changes are synced automatically; dependency changes (`package.json`, `pnpm-lock.yaml`) trigger a rebuild.

| Service | URL |
|---------|-----|
| Web (Vite) | http://localhost:5173 |
| API | http://localhost:4000 |

```sh
docker compose -f docker-compose-dev.yml up --watch
```

Or use the dedicated watch command (keeps application logs separate from sync events):

```sh
docker compose -f docker-compose-dev.yml watch
```

Requires Docker Compose 2.22.0 or later (`docker compose version`).

### Commands

| Goal | Command |
|------|--------|
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

Web serves the Vite app with Nginx on port 8080. API runs the Node.js server on port 4000.

---

https://docs.docker.com/guides/reactjs/containerize/