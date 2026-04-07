# Work Address API

Backend for [Work Address](https://address.work/): time tracking and decentralized freelance identity. REST API built with Node.js, TypeScript, Express, and TypeORM (PostgreSQL).

## Requirements

- **Node.js** 18+
- **pnpm** 9+ (see root `packageManager` in the monorepo)
- **PostgreSQL** (dev / test / prod databases as needed)
- **Redis** (URL in config)

## Install

From the **monorepo root** (`app/`):

```sh
pnpm install
```

Dependencies for this package are installed as workspace member `work-address`.

## Configuration

Copy the example env and adjust values:

```sh
cp .env.example .env
```

Key variables (see `.env.example`): `APP_HOST`, `APP_PORT`, `APP_DB_*`, `APP_REDIS`, `APP_JWT_SECRET`, `APP_SENTRY`.

## Database

Create databases (names should match your env):

```sql
CREATE DATABASE workaddress_dev;
CREATE DATABASE workaddress_test;
```

Apply the schema with TypeORM (run from **`api/`**):

```sh
NODE_ENV=development pnpm run typeorm:cli -- schema:sync
NODE_ENV=test pnpm run typeorm:cli -- schema:sync
```

Drop and recreate (destructive):

```sh
NODE_ENV=test pnpm run typeorm:cli -- schema:drop
NODE_ENV=test pnpm run typeorm:cli -- schema:sync
```

## Scripts

| Script                                     | Purpose                                            |
| ------------------------------------------ | -------------------------------------------------- |
| `pnpm run dev`                             | Development server (`ts-node-dev`, HTTPS env flag) |
| `pnpm run build`                           | Compile TypeScript to `build/`                     |
| `pnpm run prod`                            | Run `build/server.js` (set `NODE_ENV=production`)  |
| `pnpm test`                                | Tests with coverage (`nyc` + `mocha` + `ts-node`)  |
| `pnpm run lint:check` / `lint:fix`         | ESLint on `src/**/*.ts`                            |
| `pnpm run prettier:check` / `prettier:fix` | Formatting                                         |
| `pnpm run typeorm:cli`                     | TypeORM CLI (`src/ormconfig.ts`)                   |

## API documentation

All HTTP routes are under the **`/api`** prefix.

- **Swagger UI:** `http://<host>:<port>/swagger`
- **OpenAPI spec (JSON):** `GET /api/help/openApi`

## Controllers (overview)

| Prefix                  | Purpose                                          |
| ----------------------- | ------------------------------------------------ |
| `/api/auth`             | Ethereum / TON login, nonce, refresh, status     |
| `/api/auth/timeTracker` | Time-tracker auth (nonce, login, connect)        |
| `/api/user`             | User search, profile by address, updates         |
| `/api/activity`         | Activities: CRUD, search, accept proposal, close |
| `/api/proposal`         | Proposals: search, create, update, delete        |
| `/api/time`             | Time entries: search, create, report, totals     |
| `/api/invoice`          | Invoices: search, by activity, fetch by id       |
| `/api/help`             | OpenAPI export                                   |

For exact paths and bodies, use Swagger or the OpenAPI JSON above.

## Testing

```sh
pnpm test
```

Run a single file (example):

```sh
NODE_ENV=test ./node_modules/.bin/mocha --require ts-node/register ./src/test/service/Authenticator.test.ts
```

Integration-style controller tests expect Postgres/Redis according to your test env.

## Native dependencies

`bcrypt` and `sharp` ship native binaries. If install scripts were skipped (e.g. pnpm `ignore-scripts` / `approve-builds`), run a normal install with lifecycle scripts or approve builds so those packages can compile or download their `.node` files.

## Stack (short)

- **HTTP:** Express, routing-controllers, class-validator, JWT
- **Data:** TypeORM 0.2, PostgreSQL, Redis
- **DI:** Inversify
- **Docs:** OpenAPI via routing-controllers-openapi, Swagger UI
- **Observability:** Sentry (non-local), Winston

## Links

- [address.work](https://address.work/)
- [github.com/work-address](https://github.com/work-address)
