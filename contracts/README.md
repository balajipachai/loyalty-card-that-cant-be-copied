# LoyaltyCard

A Foundry project for the on-chain half of the loyalty card: one contract,
[`LoyaltyCard.sol`](src/LoyaltyCard.sol), that a backend signer calls after it
has verified who is actually asking.

## State machine

- Each customer wallet address maps to a stamp count in `[0, stampsForFreeCake)`.
- `awardStamp(address customer)` - **owner-only** - increments that count.
- Reaching `stampsForFreeCake` stamps (10 by default) immediately redeems: the
  count resets to 0, a lifetime `freeCakesEarned` counter for that address
  increments, and a `FreeCakeEarned` event fires alongside the
  `StampAwarded` event.
- `setStampsForFreeCake(uint8)` - **owner-only** - changes that threshold.
  `awardStamp` compares with `>=`, not `==`, so lowering the threshold below
  a customer's in-progress count still redeems correctly on their very next
  stamp instead of stranding them past a value they can no longer hit
  exactly.
- The contract is `Ownable2Step`: `transferOwnership` only stages a pending
  owner, who must call `acceptOwnership()` before the role actually moves -
  a typo'd or unreachable address can't strand it.
- The `owner` is the backend signer - the same wallet the Next.js app's
  `BACKEND_WALLET_PRIVATE_KEY` unlocks. `awardStamp` has no notion of "which
  customer is asking"; it trusts whoever holds the owner key, which is why
  the app only ever calls it after verifying a Privy access token.

## Setup

Dependencies (`forge-std`, OpenZeppelin Contracts) aren't committed - install
them after cloning:

```shell
forge install foundry-rs/forge-std --no-git
forge install OpenZeppelin/openzeppelin-contracts@v5.7.0 --no-git
```

(`--no-git` because this directory lives inside the repo's own git history,
not its own - plain copies into `lib/`, not submodules.)

## Build & test

```shell
forge build
forge test -vv
```

14 tests cover: owner-only enforcement (`awardStamp` and
`setStampsForFreeCake`), per-customer isolation, stamp increments, the
free-cake reset at threshold, event emission, zero-address rejection, free
cakes accumulating correctly across repeated cycles, the two-step ownership
handoff (including rejecting acceptance from the wrong address), and
lowering the threshold mid-cycle without stranding an in-progress customer.

## Deploy to Base Sepolia

Never put a private key in a file. Import it into Foundry's encrypted
keystore once:

```shell
cast wallet import backend-signer --interactive
```

Set `BASE_SEPOLIA_RPC_URL` (and optionally `BASESCAN_API_KEY` to verify) in
your shell or a local, gitignored `.env`, then deploy - the deployed
contract's `owner` becomes whichever address you pass as `--sender`, i.e.
`backend-signer`:

```shell
forge script script/Deploy.s.sol \
  --rpc-url base_sepolia \
  --account backend-signer --sender <backend-signer address> \
  --broadcast --verify --etherscan-api-key "$ETHERSCAN_API_KEY"
```

Copy the deployed address into the Next.js app's `LOYALTY_CARD_ADDRESS`, and
that same `backend-signer`'s private key into `BACKEND_WALLET_PRIVATE_KEY` -
fund that address with a small amount of Base Sepolia ETH for gas, nothing
else.
