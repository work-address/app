## Installation

Bootstrap a new machine: installs Docker (if missing), prompts for Postgres credentials and JWT secret, then runs the app in production mode.

```sh
git clone <repo> && cd app
./scripts/installer.sh
```

If you see "Bad substitution" or "[[: not found]", run with bash explicitly: `bash scripts/installer.sh`

**Prerequisites:** `curl` or `wget`, `git`. The script creates `.env` from your inputs.

**Interactive prompts:** You will be asked for `APP_DB_HOST`, `APP_DB_PORT`, `APP_DB_USERNAME`, `APP_DB_PASSWORD`, `APP_DB_NAME`, `APP_JWT_SECRET`, and optional `APP_SENTRY`.

**Non-interactive (e.g. SSH without TTY):** Set `APP_DB_PASSWORD` and `APP_JWT_SECRET` (and optionally other vars) in the environment before running.

---

For running via Docker Compose directly (production or development), see [README-DOCKER.md](README-DOCKER.md).
