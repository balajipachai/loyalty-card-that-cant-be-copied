# The Loyalty Card That Can't Be Copied

Ramesh's bakery, digitized: ten stamps, one free cake, and no way for a customer
to photocopy their way to a free pastry. A customer signs in with an identity
they already own - no browser extension, no seed phrase, no wallet to set up -
and gets a wallet the moment they finish logging in. Staff award a stamp with
one tap; the server refuses to write a stamp for anyone it can't independently
verify.

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

The browser is never trusted. Every request that changes state carries a
Privy **access token**, obtained client-side with `getAccessToken()` and sent
as `Authorization: Bearer <token>`. The server:

1. Verifies the token against Privy (`app/api/award/route.ts` ->
   [`lib/privyServer.ts`](lib/privyServer.ts), via `@privy-io/node`'s
   `client.utils().auth().verifyAccessToken()`). An invalid, expired, or
   forged token throws, and the request is rejected *before* anything is
   written - the route never proceeds on good faith.
2. Takes the verified token's `user_id` (a Privy DID) and looks up that
   user's embedded wallet address directly from Privy's user directory
   (`client.users()._get(userId)`), never from anything the client sent in
   the request body.
3. Calls `awardStamp(address)` on the [`LoyaltyCard`](contracts/src/LoyaltyCard.sol)
   contract on Base Sepolia, using a backend signer wallet that is the
   contract's `owner` - the only account allowed to write.

So the identity that gets stamped is derived entirely from a token the client
cannot forge, resolved server-side to a wallet address the client never
supplied. A photocopied punch card has no equivalent here: there is no
client-held secret to copy, only a session token Privy issues and can verify.

## Architecture

```
Browser (Next.js + @privy-io/react-auth)
  |  usePrivy(): ready, authenticated, user, login(), getAccessToken()
  v
Next.js API routes (app/api/award, app/api/stamps)
  |  verifyAccessToken() via @privy-io/node        -- lib/privyServer.ts
  |  resolve embedded wallet address from the DID  -- lib/privyServer.ts
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
- **`lib/`** - server-only helpers (`privyServer.ts`, `contract.ts`) marked
  with the `server-only` package so they can never be pulled into a client
  bundle by mistake.

## Handling the dull states

- **Still initializing**: `app/page.tsx` renders a plain loading state while
  `ready` is `false`, before deciding between the login screen and the
  dashboard.
- **Login abandoned halfway**: closing Privy's login modal just leaves
  `authenticated` false; the app re-renders the same login screen, no special
  handling needed because there was never a local "logged in" flag to get out
  of sync.
- **A stamp request that fails**: token verification failure -> 401 with a
  "sign in again" message; no embedded wallet found -> 400; the on-chain call
  reverting or timing out -> 502 with a "please ask staff to try again"
  message. Every failure path is surfaced in the UI (see
  `app/components/Dashboard.tsx`), never a silent no-op.

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

See [`.env.example`](.env.example) for the full list.

## No secrets committed

Every credential above is read from an environment variable at runtime. The
repo's `.gitignore` blocks all `.env*` files except `.env.example` (which
contains no real values) - verified with `git check-ignore -v .env.local`.

## Learnings

See [`LEARNINGS.md`](LEARNINGS.md) for what building this surfaced about
embedded wallets, server-side identity, and Privy's rough edges.
