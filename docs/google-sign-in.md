# Google sign-in

Status: built on 3 November 2026 on `feat/0-google-sign-in` in each repo. Google's verifier, its test fixture and the log and Sentry redaction come from `feat/0-google-login`. Not run: Google sign-in against real Google, tracker pairing against a real server, a fully isolated network, and Windows or Linux tracker builds. Covers `app`, `web` and `time-tracker`. The app has no users, so nothing here migrates, phases out or stays compatible.

Sign-in becomes two options: Google, and the built-in browser wallet. Everything else that signs in goes.

Related documents: `web/PRODUCT.md` §1, §4.1, §4.7 and G13 state the rules this replaces; [project-access.md](project-access.md) owns the address comparison; `time-tracker/docs/account-session.md` owns the tracker's identity and pairing.

## Why

- **Signing in is too hard.** A wallet app is a large thing to ask of someone who wants to track time.
- **Isolated networks still need a way in.** Where Google can't be reached, the built-in wallet works with nothing but the deployment itself.
- **Reown needs internet.** It's the one thing found in sign-in that does (`shared/lib/wallet-provders/reown-provider.ts`), with a project ID fixed at build time.
- **`address` is the account.** It's required and unique on `User`, and project lists, invoice records, the web API (`web/api/src/service/auth/authenticator.ts:78`) and the tracker's local tables (`AccountIdentity` in `time-tracker/src/AccountSession.h`) all read it. A Google account has to fill it.

## Decisions

| Area | Decision | Not chosen |
| --- | --- | --- |
| Sign-in screen | Google and Browser Wallet. Google shows only when `APP_GOOGLE_CLIENT_ID` is set, which is how an isolated deployment gets a wallet-only screen | Build-time flags, which need one image per deployment; an offline mode |
| Screen layout | A brand band saying what the product is and the path to a first invoice, over two equal halves: Google on the left, the browser wallet run in place on the right, each saying who it suits and what happens next. Without Google the wallet takes the room. On a phone the path follows the ways in. `/connect` keeps its card and dialog, on the same steps | A stacked form with a brand panel; bare halves with no guidance; a dialog on the sign-in page |
| Sign-in failures | Shown in place under the Google button, told apart by the API's exception name: `GoogleEmailTakenException`, `GoogleEmailUnverifiedException`, `AuthenticationException` (invalid credential) and `GoogleUnavailableException` (503) | A toast; matching on message text |
| Browser Wallet | The built-in EVM wallet only | Third-party wallets at sign-in |
| Google flow | ID token: the browser posts Google's credential to `POST /auth/google`, and tokens come back in headers like the wallet login | Redirect flow, which needs a client secret and a callback, and has to carry the pairing nonce through Google |
| Google identity | `address` holds the lowercase Google email. `googleSub`, in its own column, is what sign-in matches | Generated IDs in `address`; matching on email, which hands a reassigned mailbox the old account |
| Accounts | A Google account and a wallet account are separate and never linked. Someone using both has two accounts with separate data | Linking or merging |
| Connected wallet | `connectedWallet`, optional, Google accounts only, proven by signing a nonce. Shown on the profile as verified and used as the invoice pay-to wallet. Gives no sign-in and no project access. Several accounts can connect the same wallet | Typed without proof; wallet accounts setting one |
| Connecting a wallet | Create a built-in wallet, import a private key, or a third-party wallet through the browser's injected provider (MetaMask, Trust Wallet, a phone wallet's in-app browser) | WalletConnect QR codes, which bring Reown back |
| TON and Solana | Removed from sign-in, identity and wallet code. Kept as website deposit chains | Keeping Solana sign-in, which would need a new built-in wallet |
| Profiles | `/profile/:id`, using the existing account id, and sign-in is required to read any of them | Anonymous profiles, which publish emails; addresses in URLs |
| What people see | Email, connected wallet, name and everything else filled in, to anyone who can open the profile or shares the project. `roles` and `premium` stay hidden from others, which closes G13 | Per-viewer filtering |
| Optional `email` | Wallet accounts only. Not unique, not confirmed, shown as entered. `phone` loses its unique constraint too | Confirmation links; SMTP |
| Mail | Sent only by the website's API through Resend, to `address` for Google accounts and `email` for wallet accounts. `/auth/status` returns the destination | A mailer in the app API. Self-hosted deployments send no mail |
| Collaborators | The project form accepts an EVM address or an exact email, and nothing else | Free-form strings; normalising Gmail dots |
| Invoices | Google-only accounts can issue them. Pay-to is `connectedWallet` for a Google account, its own address for a wallet account, and none for a Google account without a wallet | Requiring a wallet to invoice |
| Scraping | `robots.txt` blocking everything and `noindex` by default on the dashboard. The site and job board stay searchable | Rate limits |
| Stance | "Identity is a wallet" stays for wallet accounts, and a Google account can prove a wallet as its identity on the profile. "No OAuth" and "no linking" change accordingly | Dropping the wallet framing |

## Module

### `User`

| Column | Change |
| --- | --- |
| `address` | Holds an EVM address or a lowercase email. Still required, unique and not editable |
| `googleSub` | New: nullable, unique, never returned by the API |
| `connectedWallet` | New: nullable, not unique, set only by the routes below |
| `email`, `phone` | Lose their unique constraints |
| `roles`, `premium` | Leave the `search` group for `me` |

### API

| Route | Change |
| --- | --- |
| `POST /auth/google` | New. Verifies the credential against `APP_GOOGLE_CLIENT_ID`, and requires a verified email |
| `GET /auth/methods` | New. Says which sign-in methods this deployment offers |
| `POST /user/connected-wallet/nonce`, `POST /user/connected-wallet`, `DELETE /user/connected-wallet` | New. Google accounts only |
| `GET /user/:id` | New, signed in. Replaces `GET /user/:address/address`, whose only caller is the dashboard's profile page |
| `POST /auth/eth`, `POST /auth/nonce` | Keep. Accept only an EVM address |
| `POST /auth/ton`, `POST /auth/ton/nonce`, `POST /auth/solana` | Removed |
| `GET /auth/status` | Adds the mail destination |

`WalletAddress` gets a new name, as it no longer only handles wallets. It keeps the canonical rule in TypeScript and SQL, now for two forms: EVM and email, both compared lowercase.

## Rules to get right

- **Sign-in matches `googleSub`, never `email`.** Anyone can type any address into `email`.
- **A mailbox can't inherit an account.** If the Google email is already in `address` under another `googleSub`, refuse the sign-in. If an account's Google email changes, `address` keeps the original.
- **Sessions resolve by `id`.** `Authenticator.getUserFromJwtToken` (`authenticator.ts:195`) checks email first, so an old token can resolve to whoever takes that email next (read, not reproduced). `emailOrPhone` leaves the token. The `address` claim stays, because the tracker reads it.
- **A login signature can't connect a wallet.** The connect nonce is tied to the user and its purpose, and stored apart from login nonces.
- **`connectedWallet` isn't in the `edit` group.** Otherwise the profile form could skip the signature.
- **Access reads `address` only.** A project listing `0xABC` gives nothing to a Google account whose connected wallet is `0xABC`, and the form says so.
- **Only Google can put an email in `address`.** `POST /auth/eth` and its nonce refuse anything that isn't an EVM address.
- **Emails stay out of URLs and logs.** That includes the site's profile link (`web/web/src/shared/lib/account-nav.ts:96`) and the tracker's "JWT parse" log line (`AccountSession.cpp:221`).
- **Length:** `MAX_ADDRESS_LENGTH` goes from 128 to 254 to fit any email.
- **One key per browser.** The built-in wallet keeps its single slot, so a Google user connecting from a browser that already holds a key uses that key, or replaces it through the existing warning.
- **Google failing to load** swaps its button for a retry, and Browser Wallet still works.
- **Not reaching Google isn't a bad credential.** The API fetches Google's signing keys before verifying, so a network failure answers 503 rather than refusing the person.
- **`/auth/methods` failing isn't "no Google".** The sign-in page shows a retry rather than a wallet-only screen, because the wallet needs the same API. It holds the Google half with a skeleton until the answer arrives.
- **A new key on screen holds Google back.** During the backup step the Google half is inert, and leaving the tab warns.
- **Deposits are untouched.** `EDepositChain`, `web/web/src/features/billing/model/chains.ts` and `deposit-uri.ts` keep TON and Solana. TON handling for account addresses goes, so check what deposits use before removing any of it.

## Tests

- **Google sign-in:** new account, returning account, unverified email, wrong audience, an email held under another `googleSub`, a Google email that changed, each failure's exception name, and Google's keys being out of reach.
- **Connected wallet:** a valid signature, a login signature replayed, another user's nonce, a wallet account refused, two accounts sharing one wallet, and disconnecting.
- **Access:** in `test/service/project-access.test.ts`, email rows replace the TON and Solana rows, and a connected wallet grants nothing.
- **Profiles:** an anonymous read is refused, and other users don't get `roles` or `premium`.
- **Dashboard:** the demo's mocks stay held to the API by `test/contract/api-contract.test.ts`.
- **Tracker:** `tests/AccountSessionTests.cpp` pins identity for an email address.

By hand:

- **Isolated network:** with no internet and no Google setting, only Browser Wallet shows, and sign-in, tracker pairing and upload all work. This has never been tested, and it's why this work exists.
- **Real Google:** sign-in, tracker pairing and website pairing on a real server. `account-session.md` records that real pairing hasn't been run.
- **Tracker builds:** Windows and Linux, which haven't been built since its last refactor.

## Steps

Before starting, create the Google OAuth client and add the dashboard's address as an allowed origin.

Everything ships together, in this order.

1. **App API.** Columns, the address rule, `/auth/google`, `/auth/methods`, sessions by `id`, connected wallet routes, `GET /user/:id` and invoice pay-to. Remove TON and Solana sign-in, `@ton/*`, `bs58`, `tweetnacl` and `APP_TON_ALLOWED_DOMAINS`. Add the schema change: the repo has no migration files, so this may be the first. Regenerate `openapi.json` and the API client.
2. **Dashboard.** The two-option sign-in and `/connect`. Remove Reown, TON Connect and the Solana adapters with their packages, `VITE_WC_PROJECT_ID`, `VITE_TON_DEV_MANIFEST_URL` and the manifest. Check whether the Node polyfills are still needed. Move profiles to `/profile/:id` behind sign-in, and add the connect card for Google accounts. Show emails in full, and the QR code only for a wallet. Add collaborator validation, `robots.txt` and `noindex` by default. Update the demo mocks and all five language files.
3. **Website.** Read the new mail destination, build profile links from `id`, and remove TON handling for account addresses. Rewrite the authentication docs in all five languages, deleting the TON and Solana pages but keeping deposit instructions, and add the new settings to the self-hosting docs. Update `PRODUCT.md`, the decentralized pages, and the privacy policy and terms, which need a review for legal accuracy.
4. **Tracker.** Rename `walletAddress`, remove the TON conversion in `SystemHelper`, and replace the wallet icon and wording, including translations. Stop logging the address. Pairing logic doesn't change.
5. **Glossaries.** Define "address" in each repo's `GLOSSARY.md`. Update [project-access.md](project-access.md), [demo-contract.md](demo-contract.md) and `account-session.md` where they describe TON and Solana.
6. Run the checks by hand.

## Behaviour that changes

- Google is a way in, wherever it's configured.
- Third-party wallets, TON and Solana no longer sign anyone in.
- Profiles need a signed-in reader, and their URLs change.
- `email` and `phone` can be shared by several accounts.

## Known limits

- **Scraping:** robots rules only ask, so the sign-in requirement is the real protection. A signed-in account can read profiles by id, the job board publishes owner ids, and nothing slows bulk reads. Adding an email to a project also shows whether that person has an account.
- **Impersonation:** the optional `email` is unproven and unmarked. The Google address in `address` is the only email known to be real.
- **Misdirected mail:** receipts go to whatever a wallet account typed.
- **Reassigned mailboxes:** a collaborator entry for an email grants access to whoever signs in with it first. A later holder with a different `googleSub` is refused.
- **Gmail dots:** `johndoe@gmail.com` won't match an account registered as `john.doe@gmail.com`.
- **Key storage:** a built-in payment wallet keeps its key in browser storage behind a password, with no backup unless it's exported.
- **Lost keys:** a wallet account can't add Google, so losing the key without a backup loses the account.

## Follow-up, not this work

- Restricting a self-hosted instance to one company's Google domain.
- Confirming the optional `email`, which the app doesn't do for now.
