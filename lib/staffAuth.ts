import "server-only";
import { createHmac, randomUUID, timingSafeEqual } from "crypto";
import type { Address } from "viem";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

const CLAIM_TTL_MS = 45_000;

export type CustomerClaim = {
  walletAddress: Address;
  nonce: string;
  iat: number;
  exp: number;
};

export type SignedClaim = {
  claim: CustomerClaim;
  signature: string;
};

function sign(claim: CustomerClaim): string {
  return createHmac("sha256", requireEnv("STAFF_QR_SECRET"))
    .update(JSON.stringify(claim))
    .digest("hex");
}

/**
 * Issues a short-lived, signed claim binding a wallet address to a random
 * nonce - this is what gets encoded into the customer's QR code. Deliberately
 * NOT the customer's raw Privy access token: that never has to leave the
 * customer's own device, and this claim is useless for anything but a single
 * award within its TTL.
 */
export function issueCustomerClaim(walletAddress: Address): SignedClaim {
  const iat = Date.now();
  const claim: CustomerClaim = { walletAddress, nonce: randomUUID(), iat, exp: iat + CLAIM_TTL_MS };
  return { claim, signature: sign(claim) };
}

/**
 * Verifies a scanned claim's signature and expiry. Throws (never returns a
 * "maybe valid" result) so callers can't accidentally fall through to an
 * award on a bad claim.
 */
export function verifyCustomerClaimOrThrow(signed: SignedClaim): CustomerClaim {
  const { claim, signature } = signed;
  const expected = Buffer.from(sign(claim), "hex");
  const actual = Buffer.from(signature ?? "", "hex");
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    throw new Error("Invalid claim signature.");
  }
  if (Date.now() > claim.exp) {
    throw new Error("Claim expired.");
  }
  return claim;
}

/**
 * Nonces of claims that have already been *successfully* awarded, so a
 * photographed or replayed QR code can't be scanned twice. In-memory only
 * (fine for this app's single Node process; a multi-instance deployment
 * would need a shared store), and entries are dropped once their claim
 * would have expired anyway.
 */
const usedNonces = new Map<string, number>();

function pruneExpiredNonces(): void {
  const now = Date.now();
  for (const [nonce, expiry] of usedNonces) {
    if (expiry < now) usedNonces.delete(nonce);
  }
}

/**
 * Throws if this claim's nonce has already been awarded. Deliberately does
 * NOT mark it used - callers must call `markNonceUsed` themselves, and only
 * once the award actually succeeds, so a transient on-chain failure doesn't
 * burn a code the customer never actually got credit for.
 */
export function assertNonceUnused(claim: CustomerClaim): void {
  pruneExpiredNonces();
  if (usedNonces.has(claim.nonce)) {
    throw new Error("This code has already been used.");
  }
}

export function markNonceUsed(claim: CustomerClaim): void {
  usedNonces.set(claim.nonce, claim.exp);
}

/**
 * Constant-time comparison of the staff PIN against the header supplied by
 * the staff device, so a wrong guess can't be distinguished by timing.
 */
export function verifyStaffPinOrThrow(suppliedPin: string | null): void {
  const expected = Buffer.from(requireEnv("STAFF_PIN"));
  const actual = Buffer.from(suppliedPin ?? "");
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    throw new Error("Incorrect staff PIN.");
  }
}
