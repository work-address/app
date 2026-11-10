# Failure reporting

Status: decided on 10 November 2026, built the same day on `dev`. Nothing a person sees changes, with the one exception under Known oddities, "Late failures".

A request says, where it is made, who tells the person it failed. One module in the web app reads that and does the telling.

Related documents: none govern this. The code is `web/src/shared/api/failure-report.ts`, used through `runApi` and `runApiData` in `web/src/shared/lib/api.ts`.

## Why

- **Two modules had to agree for one toast to appear once.** The axios interceptor toasted every failing status after a timer, unless the caller had, in the same tick, put the error in a `WeakSet` with `suppressGlobalErrorToast`. A caller that forgot got two toasts; a caller that suppressed and showed nothing got none.
- **The four behaviours had no names.** "The generic toast", "the page says so itself", "the server's message, or ours" and "always this message" were each spelled out by hand: 46 suppress calls in 13 files, 24 of them watchers that did nothing else.
- **The rule lived far from the request.** A query was declared in one file and its failure silenced in another, sometimes in another slice (profile save: the entity suppressed because a feature toasted).
- **The same lines repeated.** `getErrorMessage`, the null check for a dismissed wallet and `position: 'top-center'` were copied at each own-message site.

## Decisions

| Area | Decision | Not chosen |
| --- | --- | --- |
| Where it is declared | On the request: an optional second argument to `runApi` and `runApiData` | On the query or mutation, which a handler with two requests cannot express; a watcher beside it, which is what there was |
| Behaviours | Four, and no more: generic, in place, own message, fixed message | An open callback, which is the old freedom under a new name |
| Undeclared requests | Generic. The interceptor stays as the net for requests nobody declared | Making the declaration required at 49 call sites |
| The suppression mechanism | The `WeakSet` and the timer are private to `shared/api`. `suppressGlobalErrorToast` is not exported | Keeping the export "for special cases" |
| Shape of the value | A plain value: `'in-place'`, `{ fallback: key }`, `{ fixed: key }`. Nothing to import at a call site | Helper functions, which every test that mocks `@/shared` whole would have had to learn |
| Reporting that depends on the caller | The handler takes the value from its params (`timeQuery` does: a first page is in place, a later page has a fixed message) | Overriding a request's behaviour from outside |
| A message owned by a slice above | The entity's request declares the key. Profile save's failure toast moved from `features/profile` to `saveProfileMutation` | Two slices agreeing |
| What a person sees | Unchanged: same message, same place, a dismissed wallet stays silent, 401 is the session flow's | Fixing oddities in passing; they are listed below |
| Success toasts | Untouched | Folding them into the same module |
| Aggregate failures | The applications chart toasts once when any project's stats failed. That is the handler's own judgement over several in-place requests, and stays where it is | A fifth behaviour |
| Tests | One table-driven file, `failure-report.test.ts`, through `runApi` and the real interceptor. Two model tests asserted that `suppressGlobalErrorToast` was called; they now assert what the request declares | Leaving them asserting a function that is gone |
| Interface design | One shape, fixed by the callers | Designing it several ways in parallel |

## Module

`runApi(call, report?)` and `runApiData(call, report?)`. What `report` may be:

| Value | Who tells the person | When to use it |
| --- | --- | --- |
| omitted | The interceptor: the server's message, else `common.errors.unexpected` | Nothing better is known |
| `'in-place'` | Nobody here: the page shows the failure, usually with a retry | A load whose section has a failed state |
| `{ fallback: key }` | A toast with the server's message, else the translation of `key` | A save the server may refuse with a reason worth reading |
| `{ fixed: key }` | A toast with the translation of `key`, always | The server's words would not help. `closeButton: true` may be added |

What the module owns:

- Marking the failure so the interceptor does not also toast it.
- The toast itself: error style, top centre.
- Silence for a wallet the person closed (`getErrorMessage` returns nothing), for own messages.
- Reporting whatever the call throws, not only a refused response, so a handler may check the answer inside the call and have a bad one reported the same way (invoice settlement does).

## Known oddities

Kept as they were, for a ruling later.

- **Offline is uneven.** With no HTTP status the interceptor says nothing, so a generic failure with no connection is silent. Own and fixed messages still show.
- **A final 401 with a declared message shows that message** as well as ending the session.
- **Two failures toast twice.** Removing an agent run's prompt and revoking a server credential each show their own message from a `sample` and never declared anything, so the generic toast joins it. Declaring `{ fixed: key }` on the request and deleting the `sample` is the whole fix.
- **Late failures.** The one difference from before. A request overtaken by a newer one (`TAKE_LATEST`) never reached its failure watcher, so its failure, arriving late, raised the generic toast over a page that had moved on. The declaration travels with the request now, so a late in-place failure is silent and a late declared message is the declared one.
