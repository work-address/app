## Docker

All commands assume you are in the project root (the directory that contains `docker-compose.yml`).

### Run services (production) locally

Nginx reverse proxy routes by subdomain: `app.*` → web (React), `api.*` → Node.js API. SSL is handled by the server provider.

| Subdomain | Service |
|-----------|---------|
| app | Web (React) |
| api | Node.js API |

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

- **Port 8080:** Nginx (HTTP; SSL terminated by server provider)
- **app subdomain** → web (React)
- **api subdomain** → Node.js API on port 4000

### Certificates and domains

**Certificates** — SSL/TLS certificates are managed automatically by the server provider (e.g. Coolify, Fly.io, Cloudflare, or a hosting platform). No certificate files need to be added to this repo.

**Domain configuration** — Nginx routes by subdomain using the `Host` header:

| Subdomain | Example       | Points to |
|-----------|---------------|-----------|
| app       | app.example.com  | Web (React) |
| api       | api.example.com  | Node.js API |

**DNS** — Ensure both subdomains resolve to your server:

- `app.yourdomain.com` → A or CNAME to server IP/hostname
- `api.yourdomain.com` → A or CNAME to server IP/hostname

**Frontend API calls** — Use the api subdomain as the base URL, e.g. `https://api.yourdomain.com`. CORS may need to be configured on the API if app and api use different subdomains.

---

https://docs.docker.com/guides/reactjs/containerize/