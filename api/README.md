## Install

From the **monorepo root** (`app/`):

```sh
pnpm install
```

## Configuration

Copy the example env and adjust values:

```sh
cp .env.example .env
```

Key variables (see `.env.example`): `APP_HOST`, `APP_PORT`, `APP_DB_*`, `APP_REDIS`, `APP_JWT_SECRET`, `APP_SENTRY`, `APP_LOGGLY`.

## Database

Create databases (names should match your env):

```sql
CREATE DATABASE address_work_dev;
CREATE DATABASE address_work_test;
```

Apply the schema with TypeORM (run from **`api/`**):

```sh
NODE_ENV=development pnpm run schema:sync
NODE_ENV=test pnpm run schema:sync
```

Drop and recreate (destructive):

```sh
pnpm run schema:drop
pnpm run schema:sync
```

## Scripts

| Script                                      | Purpose                                               |
| ------------------------------------------- | ----------------------------------------------------- |
| `pnpm run dev`                              | Development server (`ts-node-dev`, HTTPS env flag)    |
| `pnpm run build`                            | Compile TypeScript to `build/`                        |
| `pnpm run prod`                             | Run `build/server.js` (set `NODE_ENV=production`)     |
| `pnpm test`                                 | Tests with coverage (`nyc` + `mocha` + `ts-node`)     |
| `pnpm run lint` / `lint:check` / `lint:fix` | ESLint (`@app/eslint-config`, `eslint.config.js`)     |
| `pnpm run prettier:check` / `prettier:fix`  | Formatting                                            |
| `pnpm run schema:sync` / `schema:drop`      | TypeORM schema sync/drop (`src/ormconfig.ts`)         |
| `pnpm run typeorm:cli`                      | TypeORM CLI (pass subcommand + `-d src/ormconfig.ts`) |

## API documentation

All HTTP routes are under the **`/api`** prefix.

- **Swagger UI:** `http://<host>:<port>/swagger`
- **OpenAPI spec (JSON):** `GET /api/help/openApi`

## Testing

Prefer the disposable PostgreSQL runner from the repository root:

```sh
pnpm --filter ./api test:isolated
```

It requires `initdb`, `pg_ctl` and `createdb` on PATH, chooses a free loopback port,
creates its own temporary cluster and removes it afterwards. A single test file
can be passed after the command. The older `pnpm test` command still reads
`.env.test` and drops that database's schema; use it only with a dedicated test DB.

## Recording and invoice implementation status

The API now persists normalized `AppUsage` rows atomically with human uploads and
returns `appsAccepted` only after persistence. Project recording switches, private
`GET/PUT /user/settings`, review windows, explicit publication, app statistics and
screenshot retention on upload are implemented. Legacy project-statistics reads
use the same visibility rules. New invoices freeze tracked human minutes, rates
and amounts; owners can reject a requested invoice and release its entries.
Concurrent workers may upload the same time slot independently.

The experimental agent API supports own-agent CRUD, per-worker project
attachments and rate history, 90-day hashed write-only credentials, bounded strict
event ingestion, durable deduplication, role-scoped search and own-source status.
Enable ingestion only for diagnostic testing with `AGENT_TRACKING_ENABLED=true`.
JWTs issue/revoke credentials but cannot upload events; collector credentials
cannot call ordinary API routes. The events parser has a 1 MiB limit before the
normal 30 MiB JSON parser. Limits are 100 events/batch, 16 KiB/event and a
transactional 300-events/minute bucket with a 600-event burst per credential.
Health-only uploads are limited to one per 30 seconds.

The synchronous PostgreSQL transaction stores events and replays each run under
an advisory lock. Terminal-before-start stays pending; contradictory terminals
and clock reversals are diagnosed. Timer pauses become untracked segments.
Late events cannot rewrite an invoiced run; rejecting its invoice replays those
corrections atomically. All vendor versions currently remain **unqualified**:
client capabilities cannot promote them, all other measured segments are unknown,
and no agent billing is enabled. The production switch defaults off.

Agent setup uses signed-in `POST /agents`, `PUT /project/:id/agents/:agentId`
(`rateHourCents`), then `POST /agent-tracking/credentials` with an install UUID and
`mode: "fixed"` or `"timer"`. Use that same UUID when configuring the npm collector.
`GET /project/:id/agents` and project reads scope attachments to the owner or the
worker's own agents; viewers receive no agent information.

Still pending from the full plans: qualified runtime fixtures; waits, content,
lineage and activity/manual events; source cursors, background finalization and
agent retention/tombstones; union-based agent invoices and summaries; collector
attachment/policy preflight and automatic hook installation; manual/web timers;
full statistics/review/settings screens, timeline, categories, goals, exports and
privacy deletion. Screenshot expiry currently runs on upload rather than a daily
job. Statistics date grouping currently uses each entry's start time. These are
rollout gaps, not features certified by the synthetic tests.
