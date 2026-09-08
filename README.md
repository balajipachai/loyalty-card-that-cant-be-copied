# The Loyalty Card That Can't Be Copied

Ramesh's bakery, digitized: ten stamps, one free cake, and no way for a customer
to photocopy their way to a free pastry. A customer signs in with an identity
they already own - no browser extension, no seed phrase, no wallet to set up -
and gets a wallet the moment they finish logging in. The customer's dashboard
shows a QR code; staff scan it on their own device after ringing up the
purchase, and only that staff-authenticated scan can write a stamp - the
server refuses to write one for anyone it can't independently verify, and a
customer's own session has no path to award itself.

## Login methods enabled

Email and Google, via [Privy](https://docs.privy.io/). Configured in
[`app/providers.tsx`](app/providers.tsx):

```ts
loginMethods: ["email", "google"],
embeddedWallets: { ethereum: { createOnLogin: "users-without-wallets" } },
```

No external-wallet option is offered as a login method - a regular buying bread
on the way to work is never asked to connect anything.

## How the server knows who is asking

The browser is never trusted, and a customer's own device can never award
itself a stamp - only a staff-authenticated device can, and only after
scanning that specific customer's code.

1. The customer's dashboard authenticates with a Privy **access token**
   (`getAccessToken()`, sent as `Authorization: Bearer <token>`) to
   `app/api/qr-claim`, which verifies it against Privy
   ([`lib/privyServer.ts`](lib/privyServer.ts), via `@privy-io/node`'s
   `client.utils().auth().verifyAccessToken()`), resolves the verified
   token's `user_id` to that user's embedded wallet address from Privy's
   user directory, and returns a short-lived, HMAC-signed claim binding that
   wallet address to a random nonce (`lib/staffAuth.ts`) - never the raw
   access token itself, which never needs to leave the customer's device.
2. The dashboard renders that claim as a QR code (`app/components/CustomerQRCode.tsx`),
   refreshing it before it expires.
3. A staff device, unlocked with a separate PIN (`app/staff`,
   `app/components/StaffScanner.tsx`), scans the code and posts it to
   `app/api/staff/award`, which checks the PIN, verifies the claim's
   signature and expiry, rejects a nonce it's already awarded (no replaying
   a photographed code), and only then calls `awardStamp(address)` on the
   [`LoyaltyCard`](contracts/src/LoyaltyCard.sol) contract on Base Sepolia
   using a backend signer wallet that is the contract's `owner` - the only
   account allowed to write.

So the identity that gets stamped is derived entirely from a token the client
cannot forge, resolved server-side to a wallet address the client never
supplied - and the write itself requires a second, staff-side credential the
customer never has. A photocopied punch card has no equivalent here: there is
no client-held secret to copy, and no path from the customer's own session to
the endpoint that actually writes a stamp.

## Architecture

```
Customer browser (Next.js + @privy-io/react-auth)
  |  usePrivy(): ready, authenticated, user, login(), getAccessToken()
  v
app/api/qr-claim  -- verifies Privy token, resolves wallet address,
  |                  issues a short-lived signed claim (lib/staffAuth.ts)
  v
QR code on the customer's dashboard  -- app/components/CustomerQRCode.tsx
  |  (scanned by a separate device)
  v
Staff device (app/staff, PIN-gated)  -- app/components/StaffScanner.tsx
  v
app/api/staff/award  -- checks staff PIN, verifies claim signature/expiry/
  |                     nonce (lib/staffAuth.ts)
  v
LoyaltyCard.sol on Base Sepolia (owner-only awardStamp)  -- lib/contract.ts
```

- **`contracts/`** - Foundry project. `LoyaltyCard.sol` is an `Ownable2Step`
  contract: `awardStamp(address)` is owner-only, increments a customer's
  stamp count, and auto-redeems (resets to 0, emits `FreeCakeEarned`) at
  `stampsForFreeCake` (10 by default, owner-adjustable via
  `setStampsForFreeCake`). See [`contracts/README.md`](contracts/README.md)
  for the test suite and deploy instructions.
- **`app/`** - the Next.js App Router UI. `page.tsx` gates on Privy's `ready`
  flag before ever branching on `authenticated`, so the app never flashes the
  wrong screen while the SDK is still initializing.
- **`lib/`** - server-only helpers (`privyServer.ts`, `contract.ts`,
  `staffAuth.ts`) marked with the `server-only` package so they can never be
  pulled into a client bundle by mistake.

## Handling the dull states

- **Still initializing**: `app/page.tsx` renders a plain loading state while
  `ready` is `false`, before deciding between the login screen and the
  dashboard.
- **Login abandoned halfway**: closing Privy's login modal just leaves
  `authenticated` false; the app re-renders the same login screen, no special
  handling needed because there was never a local "logged in" flag to get out
  of sync.
- **The QR code going stale**: the claim it encodes expires 45 seconds after
  it's issued; `CustomerQRCode` refetches a fresh one before that happens, so
  the code on screen is (almost) never the expired one, with no tap required.
- **A stamp request that fails**: on the staff side, a wrong PIN -> 401; an
  invalid, expired, or already-used claim -> 400 with a "refresh the
  customer's code" message; the on-chain call reverting or timing out -> 502
  - and that last case deliberately does *not* burn the claim's nonce, so
  staff can just scan again instead of the customer needing a fresh code.
  Every failure path is surfaced in the UI (see
  `app/components/StaffScanner.tsx`), never a silent no-op.

## Running it locally

```bash
npm install
cp .env.example .env.local   # fill in the values below
npm run dev
```

You need:

- A [Privy](https://dashboard.privy.io) app, with Email and Google enabled as
  login methods, and embedded wallets enabled for Ethereum. Put its App ID in
  `NEXT_PUBLIC_PRIVY_APP_ID` and its App Secret in `PRIVY_APP_SECRET`.
- A deployed `LoyaltyCard` contract on Base Sepolia (see
  [`contracts/README.md`](contracts/README.md)) - its address goes in
  `LOYALTY_CARD_ADDRESS`.
- A funded backend signer wallet (gas only, nothing else) whose private key
  is the contract's `owner` - goes in `BACKEND_WALLET_PRIVATE_KEY`. This is a
  server secret read from an environment variable, never committed.
- Two more secrets for the staff-scan flow: `STAFF_QR_SECRET` (any random
  string, e.g. `openssl rand -hex 32`) signs the customer's QR claim, and
  `STAFF_PIN` is what staff enter once per device at `/staff` to unlock the
  scanner.

See [`.env.example`](.env.example) for the full list.

## No secrets committed

Every credential above is read from an environment variable at runtime. The
repo's `.gitignore` blocks all `.env*` files except `.env.example` (which
contains no real values) - verified with `git check-ignore -v .env.local`.

## Learnings

See [`LEARNINGS.md`](LEARNINGS.md) for what building this surfaced about
embedded wallets, server-side identity, and Privy's rough edges.
