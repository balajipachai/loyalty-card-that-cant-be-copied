import "server-only";
import { PrivyClient, isEmbeddedWalletLinkedAccount } from "@privy-io/node";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

let client: PrivyClient | null = null;

function getPrivyClient(): PrivyClient {
  if (!client) {
    client = new PrivyClient({
      appId: requireEnv("NEXT_PUBLIC_PRIVY_APP_ID"),
      appSecret: requireEnv("PRIVY_APP_SECRET"),
    });
  }
  return client;
}

/**
 * Verifies a Privy access token and returns the DID (`user_id`) it was issued
 * for. Throws if the token is missing, malformed, expired, or was not issued
 * by this app — callers must treat a thrown error as "reject the request",
 * never fall back to trusting anything the client sent.
 */
export async function verifyAccessTokenOrThrow(accessToken: string) {
  const claims = await getPrivyClient().utils().auth().verifyAccessToken(accessToken);
  return claims;
}

/**
 * Resolves the verified user's embedded Ethereum wallet address by looking
 * the DID up against Privy's user directory - never from anything the client
 * sent in the request itself.
 */
export async function getEmbeddedWalletAddress(userId: string): Promise<`0x${string}` | null> {
  const user = await getPrivyClient().users()._get(userId);
  const embeddedWallet = user.linked_accounts.find(
    (account) => isEmbeddedWalletLinkedAccount(account) && account.chain_type === "ethereum",
  );
  return (embeddedWallet?.address as `0x${string}` | undefined) ?? null;
}
