# @app/api-client

Typed API client generated from the backend OpenAPI spec.

This package is used by workspace consumers (for example API tests and scripts) to call backend endpoints with full TypeScript types for request/response payloads.

## What this package exports

From `src/public-api.ts`:

- generated endpoint functions (for example `userControllerRead`, `projectControllerSearch`)
- generated API types (for example `User`, `UserEdit`, `ProjectSearchDto`)
- `createClient` and `createConfig` helpers for creating a configured client instance

## Basic usage

```ts
import {
  createClient,
  createConfig,
  userControllerRead,
  userControllerSearch,
} from '@app/api-client'

const client = createClient(
  createConfig({
    baseURL: 'http://localhost:4000',
  }),
)

const readRes = await userControllerRead({
  client,
  path: { address: '0x123...' },
  throwOnError: true,
})

const searchRes = await userControllerSearch({
  client,
  body: {
    filter: { id: readRes.data?.id },
    sort: { createdAt: 'DESC' },
    page: 0,
  },
  throwOnError: true,
})
```

## Authenticated requests

Pass request headers per call:

```ts
import { userControllerEdit } from '@app/api-client'

await userControllerEdit({
  client,
  headers: {
    Authorization: accessToken,
  },
  body: {
    title: 'Senior Engineer',
    tz: 'UTC',
  },
  throwOnError: true,
})
```

## Regenerating client code

From repository root:

```bash
pnpm codegen:api-client
```

This runs:

1. `api` package `export-openapi` script (writes `packages/api-client/openapi.json`)
2. client generation (`packages/api-client/src/features/shared/api/generated`)

## Notes

- Generated files under `src/features/shared/api/generated` should not be edited manually.
- Re-run codegen whenever backend API contracts change.
