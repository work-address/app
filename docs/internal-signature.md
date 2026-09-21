# Internal call signatures

The marketplace and billing service (`work-address/web`, `api/`) calls this
service on seven routes under `/api/internal`. None of them carries a user
token: each is authenticated by an HMAC-SHA256 made with one shared secret,
`APP_ENTITLEMENT_SECRET`, followed by a replay window on `issuedAt` and a
one-time `nonce`.

| Route | Header |
| --- | --- |
| `POST /api/internal/entitlement` | `X-Entitlement-Signature` |
| `POST /api/internal/marketplace/hire` | `X-Marketplace-Signature` |
| `POST /api/internal/marketplace/end` | `X-Marketplace-End-Signature` |
| `POST /api/internal/marketplace/milestone-invoice` | `X-Marketplace-Milestone-Signature` |
| `POST /api/internal/marketplace/amend` | `X-Marketplace-Amend-Signature` |
| `POST /api/internal/marketplace/pause` | `X-Marketplace-Pause-Signature` |
| `POST /api/internal/marketplace/settlement` | `X-Marketplace-Settlement-Signature` |

The table lives in code as `InternalRoute` (`api/src/service/internal-route.ts`)
and, on the other side, as web's `InternalRoute`. The contract fixtures under
`api/src/test/fixture/*.contract.json` are byte-identical in both repositories
and carry each route's `method`, `path`, `header`, signed bytes and signature.

## What is signed (v2)

```
v2\n<METHOD>\n<path>\n<header name, lower case>\n<body>
```

The header value is `v2=<hex digest>`. `<path>` is the full path the caller
requests, `/api` prefix included; `<body>` is the JSON exactly as sent, which
this service reproduces by re-serialising the DTO it parsed.

One key signs every route, so the key says nothing about which route a
signature was made for. Before v2 the signature covered the body alone, and
what stopped a call captured on one route being replayed on another was only
that the DTOs differ - which they do not always: every marketplace body opens
with `contractId` and closes with `issuedAt` and `nonce`, and the DTOs keep
keys they do not declare, so a captured pause or resume parsed as an end and
re-serialised to the very bytes that were signed. It closed the project for
good. With the route inside the signed bytes, a signature made for one route
is refused on every other, whatever the bodies look like.

A value that names a version is held to that version. `v2=…` is only ever
checked against the v2 bytes, so stripping the prefix cannot downgrade it.

## Rollout: one release of overlap

The two services are deployed separately and may go out minutes apart in
either order, so for one release both forms are understood.

- **This service** always accepts `v2`. It also accepts the legacy form - the
  bare hex HMAC of the body - while `APP_INTERNAL_SIGNATURE_ACCEPT_LEGACY` is
  unset or `true`. That covers this service going out first: the older
  marketplace still signs the body alone.
- **The marketplace** signs `v2`. When a call is answered 401 and
  `APP_INTERNAL_SIGNATURE_LEGACY_FALLBACK` is unset or `true`, it sends the
  same call once more in the legacy form. That covers the marketplace going
  out first: the older version of this service does not know `v2`. A 401 that
  was not about the version is simply a 401 twice.

During the overlap a legacy signature is as replayable across routes as it
was before, and no more. Closing the window is what makes the binding hold:

1. Deploy both services, in any order.
2. Set `APP_INTERNAL_SIGNATURE_LEGACY_FALLBACK=false` on the marketplace, then
   `APP_INTERNAL_SIGNATURE_ACCEPT_LEGACY=false` here. (The marketplace first,
   so nothing is still relying on the form this service stops accepting.)
3. In the following release, delete both switches, `signLegacy`, and the
   `legacySignature` field of the fixtures - in both repositories, in the same
   pull request pair.

A self-hosted instance has no `APP_ENTITLEMENT_SECRET` and refuses every
internal call in either form; nothing here changes that.

## Adding a route

Add it to `InternalRoute` in both repositories with a header of its own, add
its contract fixture to both, and verify it with
`EntitlementSignature.verify(InternalRoute.X, JSON.stringify(dto), header)`.
`internal-route-binding.test.ts` then needs one more test, and
`internal-route-contract.test.ts` one more row.
