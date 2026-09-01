## Installation

Bootstrap a fresh machine with a single command — no need to clone first. This installs Docker (if missing), installs `git` (if missing), clones the repo, prompts for the public URL, Postgres credentials and a JWT secret, then builds and runs the app in production mode:

```sh
curl -fsSL https://raw.githubusercontent.com/work-address/app/dev/scripts/installer.sh | bash
```

The repo is cloned into `./app` in your current directory (override with `APP_INSTALL_DIR=/some/path`). Running the command again later re-clones/updates that same checkout and re-runs the install.

**Already have the repo cloned?** Run the script directly instead:

```sh
git clone https://github.com/work-address/app.git && cd app
./scripts/installer.sh
```

If you see "Bad substitution" or "[[: not found]", run with bash explicitly: `bash scripts/installer.sh`

### Prerequisites

- **A running PostgreSQL server, with the target database already created.** The installer does *not* install Postgres — the compose stack deliberately talks to an external database (see [README-DOCKER.md](README-DOCKER.md)). Create it before you start:
  ```sh
  createdb -h <host> -U postgres address_work
  ```
  Use `host.docker.internal` (not `localhost`) for `APP_DB_HOST` when Postgres runs on the same machine.
- `curl` or `wget`.
- `git` and Docker are installed automatically if missing (requires root, or `sudo`).
- Docker Compose **v2.24 or newer**. The installer checks this and stops with an upgrade hint if the version is too old; the legacy `docker-compose` v1 binary cannot build this stack.

### Interactive prompts

You will be asked for:

| Prompt | Default | Notes |
|---|---|---|
| `APP_PUBLIC_URL` | `http://localhost:8000` | Browser URL this install is served at. Sets the allowed TON wallet-proof domain. |
| `APP_DB_HOST` | `host.docker.internal` | |
| `APP_DB_PORT` | `5432` | |
| `APP_DB_USERNAME` | `postgres` | |
| `APP_DB_PASSWORD` | — | Required. Input is hidden. |
| `APP_DB_NAME` | `address_work` | Must already exist. |
| `APP_JWT_SECRET` | — | Required, min 32 chars. Input is hidden. |
| `APP_SENTRY` | empty | Optional. |

The web bundle is always built with an empty `VITE_API_URL`, so the browser calls `/api` on whatever origin served the page. That makes the install work at any hostname or port without a rebuild.

Serving on a real domain? Set `APP_PUBLIC_URL` to it and point your TLS-terminating reverse proxy at port `8000`.

### Non-interactive (e.g. CI, or no controlling terminal)

Set `APP_DB_PASSWORD` and `APP_JWT_SECRET` (and optionally the others) in the environment before running:

```sh
APP_DB_PASSWORD=... APP_JWT_SECRET=... curl -fsSL https://raw.githubusercontent.com/work-address/app/dev/scripts/installer.sh | bash
```

### Environment knobs

| Variable | Purpose |
|---|---|
| `APP_REPO_URL` | Clone from somewhere else. Use an SSH or token URL for a private repo: `git@github.com:work-address/app.git` |
| `APP_REPO_REF` | Clone a specific branch or tag |
| `APP_INSTALL_DIR` | Where to clone (default `./app`) |
| `APP_BUILD_NO_CACHE=1` | Force a cache-free rebuild |
| `APP_SKIP_SMOKE_TEST=1` | Skip the post-start health check |

### Verifying the install

On success the installer waits for the API to actually answer on `/api/help/openApi` and confirms every container is running. If the API cannot reach Postgres it stops with a non-zero exit code and prints the API's own logs plus the likely cause — it will not report a working install when the database is unreachable.

---

For running via Docker Compose directly (production or development), see [README-DOCKER.md](README-DOCKER.md).
