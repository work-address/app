## About

All commands assume you are in the project root (the directory that contains `docker-compose.yml`).

### Run services (production) locally

Nginx reverse proxy listens on port 8000 and routes by path: `/api` → Node.js API, `/` → web (React). SSL is handled by the server provider.

Requires Postgres config: copy `api/.env.example` to `api/.env` (compose also loads an optional `.env` in the project root, if you keep one there). Use `host.docker.internal` for `APP_DB_HOST` when Postgres runs on the host, not `localhost`.

```sh
docker compose -f docker-compose.yml up --watch
```

Access at http://localhost:8000

### Run services in development (watch mode)

Uses `dockerfile.dev` and Docker Compose watch to sync file changes into containers. Includes Redis; the API connects to an **external Postgres** (configure in `api/.env`).

| Service    | URL                           |
| ---------- | ----------------------------- |
| Web (Vite) | http://localhost:8000         |
| API        | http://localhost:4000         |
| Swagger    | http://localhost:4000/swagger |

Prerequisite: Copy `api/.env.example` to `api/.env` and set your external DB (`APP_DB_HOST`, etc.). Use `host.docker.internal` to reach Postgres on the host.

```sh
docker compose -f docker-compose-dev.yml up --watch
```

### Map tiles

Where a phone was while its timer ran is drawn on a map, in an entry's dialog and as a day's trail on the time page. The map's squares come from a tile host chosen when the web app is built:

| Variable                    | Meaning                                                                               |
| --------------------------- | ------------------------------------------------------------------------------------- |
| `VITE_MAP_TILE_URL`         | A Leaflet tile URL template, such as `https://tile.openstreetmap.org/{z}/{x}/{y}.png` |
| `VITE_MAP_TILE_ATTRIBUTION` | The credit the tile host asks for, shown in the map's corner. HTML is allowed         |

Both are read at build time, from the environment or a root `.env`, like `VITE_API_URL`. Left empty, the map uses OpenStreetMap's own tiles, whose usage policy allows light use only: a busy server should name a tile host it has an agreement with, or run its own.

What the tile host learns: the reader's browser asks it for the squares it shows, so the host sees roughly where the reader is looking, and the reader's address. No recorded position, entry or account is sent to it. If a content security policy is added to the proxy, the tile host must be allowed as an image source.

### Cleanup

```sh
# Stop and remove containers for this project
docker compose down

# Also remove images built by compose
docker compose down --rmi local

# Remove all stopped containers (system-wide)
docker container prune
```
