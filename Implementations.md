# Problem Statement:

The Loyalty Card That Can't Be Copied
Ramesh runs a small bakery and tracks loyalty on paper punch cards: ten stamps, one free cake. He has been losing money for months. Customers photocopy the cards, and the staff at the counter stamp whatever they are handed. He wants the stamps to live somewhere a photocopier cannot reach.

His regulars are people buying bread on the way to work. They will not install a browser extension to earn a pastry, they will not write down a recovery phrase, and if the first screen asks them to connect anything, they will hand the phone back and pay cash.

# Tech Stack

- Next.js
- @privy-io/react-auth
- @privy-io/server-auth or @privy-io/node
- Base Sepolia
- Tailwind CSS

# Learnings

1. How social or email login and self-custodial key management collapse into a single step with an embedded wallet
2. Why a signed-in session in the browser proves nothing to your server, and what does
3. How to derive identity on the server from something the client cannot forge
4. How to design a first screen for someone who does not know a blockchain is involved

# What to do:

1. Build a loyalty app a first-time customer can sign into with an identity they already own email, Google, whatever suits a bakery queue. No browser extension, no external wallet as the primary path.
2. Make sure that by the time they see the signed-in screen they own a wallet, without having clicked anything that says "create wallet".
3. Give staff a way to award a stamp, and the customer a way to see their balance.
4. Make the award trustworthy. The server has to know which customer it is stamping, and it cannot take the browser's word for it.
5. Handle the dull states honestly: the app still initializing, a login abandoned halfway, a stamp request that fails.

# Output

- Deliverable. One public GitHub repo. A README naming the login methods you enabled and how the server establishes who is asking. No secrets committed.
- Create an overall learnings document at the end and also add about privy and its gotchas

# Acceptance Criteria:

A customer signs in with their email in under a minute, has a wallet they never created, and a stamp they receive is one the server could prove belongs to them.

# Test Cases:

1. A sign-in entry point calls a Privy login method - 5 points
Passes if At least one interactive element in the pre-login UI invokes a Privy SDK login method.
Fails if No SDK login method is invoked anywhere in the app, or the only sign-in path is a mock, a hardcoded user, or a route the user is dropped into without authenticating.

2. Authenticated users get a wallet without clicking to create one - 10 points
Passes if createOnLogin is set to 'users-without-wallets' or 'all-users', or a wallet creation call runs automatically on the login success path without waiting for a user gesture.
Fails if createOnLogin is absent or set to 'off' and the only wallet creation is behind a user-clicked control, or no wallet creation appears anywhere in the repo.

3. Route gating reads Privy's authenticated state - 10 points 
Passes if The gate tests authenticated (or an equivalent value from a Privy hook or a server-verified session), so the decision derives from the SDK.
Fails if The gate tests a flag the app itself set and persisted, such as a localStorage or cookie boolean or a bare component state, or no gate exists and the signed-in view renders unconditionally.

4. The initializing state is handled before auth-dependent UI renders - 6 points
Passes if At least one component short-circuits on ready being false, rendering a placeholder or nothing, before any auth-dependent branch.
Fails if No component checks ready or an equivalent initializing value anywhere, so the first render commits to an auth branch.

5. The award endpoint verifies the Privy access token server-side - 20 points
Passes if The handler verifies a Privy-issued token before performing the write, and rejects the request when verification throws or fails.
Fails if The handler performs the write with no token verification, verifies nothing but the presence of a header, does the write before verification, or there is no server-side award path at all because the increment happens entirely in client code.

6. The stamped identity comes from the verified token claims - 15 points
Passes if The identifier written against comes from the verified claims, such as the subject / DID returned by verification, or from a server lookup keyed on it.
Fails if The identifier comes from the request body, query string, path parameter, or an unverified header, or no per-user identifier is used because stamps are stored globally or in client state.

7. The client sends the access token with the award request - 6 points
Passes if The request carries the token obtained from getAccessToken (or the SDK's equivalent) in a header or cookie.
Fails if The request carries no token, carries only a user id or address in the body, or no client-to-server award request exists.

8. No credential appears in any tracked file - 8 points
Passes if No secret value appears in any tracked file; server-side secrets are read from environment variables and any local env file is gitignored.
Fails if Any app secret, provider API key, private key, or authenticated URL is present in a tracked file, including one that is commented out or sitting in an example file with a real value.

# Important

- For smart contracts refer /Users/iamthebatman/Desktop/github.com/balajipachai/solidity-dev-skill
- Privy Docs: https://docs.privy.io/

