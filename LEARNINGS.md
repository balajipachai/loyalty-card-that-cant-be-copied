# Learnings

## 1. Social/email login and self-custodial keys collapse into one step

Before this, "sign in with email" and "have a self-custodial wallet" felt like
two separate products bolted together with a "connect wallet" button in
between. Privy's embedded wallets make them the same step: set
`embeddedWallets.ethereum.createOnLogin` to `'users-without-wallets'`, and the
moment someone finishes an email/Google login with no existing wallet, Privy
generates one and attaches it to their user object - no second click, no
"create wallet" button anywhere in the flow. The customer never sees the word
"wallet." They see "signed in."

The key material itself never touches Ramesh's server. Privy's embedded
wallet is generated and secured client-side (details vary by their key
infrastructure; the app never needs to know); the server only ever gets an
address to write against, never a key to hold.

## Where the embedded wallet's private key actually lives

Not in one place, and never in complete form outside a narrow, temporary window.
Privy splits the private key into two encrypted shares the moment it's generated,
in a 2-of-2 scheme - **neither share alone reveals anything about the key**:

- An **enclave share**, encrypted so it's decryptable only inside a Trusted
  Execution Environment (Privy uses AWS Nitro Enclaves - real hardware-enforced
  isolation, not just "a server we promise not to look at").
- An **auth share**, encrypted and held on Privy's servers, released only to a
  session that just passed authentication.

To sign anything, the two shares have to be brought together *inside the
enclave*, momentarily, in memory only - and destroyed the instant signing
finishes. Neither Privy's servers, nor the app, nor the browser ever hold a
complete key at rest.

```mermaid
sequenceDiagram
    actor Customer
    participant App as Bakery app (browser)
    participant Iframe as Privy iframe (sandboxed)
    participant API as Privy API / servers
    participant TEE as Secure enclave (TEE)

    rect rgb(255, 247, 230)
    Note over Customer,TEE: Wallet creation - first login, no wallet yet
    Customer->>App: Sign in (email OTP / Google)
    App->>API: Login request
    API-->>App: Session established (authenticated)
    App->>Iframe: createOnLogin: no wallet found - create one
    Iframe->>API: Request wallet creation
    API->>TEE: Generate a new keypair
    activate TEE
    TEE->>TEE: Generate private key inside the enclave
    TEE->>TEE: Split key into 2 encrypted shares (2-of-2)
    deactivate TEE
    TEE-->>API: Enclave share (TEE-only decryptable) + public address
    API->>API: Store auth share, encrypted, keyed to this user's account
    API-->>App: Wallet address (e.g. user.wallet.address)
    App-->>Customer: "Signed in" - wallet exists, word never used
    end

    rect rgb(230, 240, 255)
    Note over Customer,TEE: Later - if this wallet ever needs to sign something
    App->>API: Sign request + this session's auth token
    API->>API: Validate the auth token
    API->>TEE: Forward the (still-encrypted) auth share
    TEE->>TEE: Decrypt its own enclave share
    TEE->>TEE: Reconstruct the full key - in enclave memory only
    TEE->>TEE: Sign the payload, then destroy the reconstructed key
    TEE-->>API: Signature only (never the key)
    API-->>App: Signature
    end
```

What this buys the bakery: no single compromise - a breached Privy database,
a compromised app server, a stolen laptop - hands anyone the complete key.
The auth share is useless without the enclave, and the enclave share is
useless without a validly-authenticated session. And it's why our own backend
(`lib/privyServer.ts`) never touches key material at all: it only ever asks
Privy for a wallet **address**, after independently verifying the customer's
access token - the key itself is never something our server could leak even
if it wanted to.

One honest caveat: Privy's docs describe this at two levels of detail that
don't fully reconcile in what's public - a clean "TEE + 2 shares" security-
architecture page, and an older "iframe + per-device share + recovery share"
page describing multi-device access. The diagram above follows the security-
architecture framing (the one that actually explains *why* it's safe); the
device-share layer is best read as a convenience/caching detail on top of it,
not a separate security boundary. Because our `providers.tsx` doesn't set
`recoveryMethod`, this app uses Privy's default (`'privy'`) - Privy's own
infrastructure escrows the recovery material non-custodially, which is the
concrete reason the login screen can honestly say "no recovery phrase to
write down" (the alternative, `'user-passcode'`, would require exactly that).

## 2. A signed-in browser session proves nothing to the server

`authenticated === true` in the browser is a fact about the browser, not a
fact the server can act on. Anyone can open devtools and fake a React state
value, forge a `localStorage` flag, or POST directly to an API route with an
arbitrary `customerId` in the body. None of that is a security boundary.

What actually crosses the trust boundary is the **access token** -
`getAccessToken()` returns a JWT that Privy signed, scoped to a specific user
and session, with a short expiry. The server's only real question is "can I
verify this token was issued by Privy, for this app, and hasn't expired?" -
everything else (which customer, which wallet) is *derived from* a
successful verification, never accepted as a separate, unverified claim
alongside it. This project's award endpoint (`app/api/award/route.ts`)
verifies before it does anything else, and returns 401 the instant
verification throws - there's no code path where a write happens first and a
check happens after.

## 3. Deriving server-side identity from something the client can't forge

The pattern, concretely:

```
claims = await privy.utils().auth().verifyAccessToken(token)   // throws on anything wrong
userId = claims.user_id                                        // a Privy DID, not user input
user   = await privy.users()._get(userId)                      // server-side lookup
wallet = user.linked_accounts.find(isEmbeddedWalletLinkedAccount)
```

Every step after the first line is a lookup keyed on a value the *server*
extracted from a *cryptographically verified* token - never a value read out
of the request body, a query string, or a header the client set itself. If a
customer's laptop were fully compromised, an attacker could still only get a
stamp awarded to that customer's own real wallet - there is no field to tamper
with that changes whose balance gets incremented.

## 4. Designing a first screen for someone who doesn't know a blockchain is involved

The bakery-queue constraint is real: nobody buying bread on the way to work
will tolerate a screen that mentions gas, chains, or seed phrases. The
practical rules this pushed us toward:

- **Never say "wallet" on the first screen.** The login screen
  (`app/components/LoginScreen.tsx`) says "Sign in with email or Google" and
  nothing else. The wallet gets created; it just never gets *named* to the
  user.
- **Gate on `ready`, not on time.** A hardcoded "wait 500ms then show the app"
  is a race condition waiting to happen on a slow connection. Privy's `ready`
  boolean is the actual signal that initialization finished, and
  `app/page.tsx` blocks on it before deciding anything else.
- **An abandoned login should look like nothing happened.** Because there's
  no local "I started logging in" flag to unwind, closing the login modal
  halfway through just leaves you back at the login screen - no error state
  to design for, because there's no intermediate state that needed one.

## Privy - gotchas encountered building this

- **`@privy-io/server-auth` is deprecated** in favor of `@privy-io/node` (you
  get a loud `npm warn deprecated` on install). The APIs are similar in
  spirit but not identical - don't copy code samples across the two without
  checking which package they're written against.
- **`verifyAccessToken`'s response is snake_case**: `user_id`, `session_id`,
  `issued_at` - not the `userId`/`sessionId` you'd guess from the rest of the
  JS SDK's camelCase surface. Easy to typo and get `undefined` silently if
  you don't check the installed package's own `.d.ts`.
- **`embeddedWallets` config is nested, not flat**, in the current major
  version: `embeddedWallets: { ethereum: { createOnLogin: ... } }`, not
  `embeddedWallets: { createOnLogin: ... }`. Older blog posts and even some
  AI-generated snippets show the flat shape - it silently does nothing if
  your installed version expects the nested one, with no runtime warning.
- **Looking a user up by ID uses `users()._get(userId)`**, an
  underscore-prefixed method - the un-prefixed `users().get()` was
  repurposed to look a user up *from an identity token* instead, which reads
  the same at a glance but takes a completely different argument.
- **`isEmbeddedWalletLinkedAccount()` isn't chain-specific.** It matches
  embedded wallets across Ethereum, Solana, and multiple Bitcoin address
  types. If you only care about one chain, you still need an extra
  `account.chain_type === 'ethereum'` check after it - it narrows "is this an
  embedded wallet" but not "on which chain."
- **`NEXT_PUBLIC_PRIVY_APP_ID` is inlined at build time**, not read at
  request time. A production build fails outright if it's missing - it's not
  a "works locally, breaks at runtime in prod" surprise, it's a build-time
  hard stop, which is actually the more useful failure mode but catches
  people who expect all env vars to behave the same way.
- **A wrong or placeholder App ID doesn't error visibly in the UI** - the SDK
  logs `PrivyApiError: Invalid Privy app ID` to the console and `ready` just
  never becomes `true`. From the outside this looks identical to a hang.
  Gating the UI on `ready` (rather than assuming it flips quickly) means the
  app degrades to "stuck on loading" instead of showing something broken -
  but it's worth knowing to check the console first when debugging a stuck
  loading screen.
