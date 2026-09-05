import "server-only";
import { createPublicClient, createWalletClient, http, parseEventLogs, type Address } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { baseSepolia } from "viem/chains";
import { loyaltyCardAbi } from "./abi";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

function getContractAddress(): Address {
  return requireEnv("LOYALTY_CARD_ADDRESS") as Address;
}

function getTransport() {
  return http(requireEnv("BASE_SEPOLIA_RPC_URL"));
}

function getPublicClient() {
  return createPublicClient({
    chain: baseSepolia,
    transport: getTransport(),
  });
}

function getBackendWalletClient() {
  const account = privateKeyToAccount(requireEnv("BACKEND_WALLET_PRIVATE_KEY") as `0x${string}`);
  return createWalletClient({
    account,
    chain: baseSepolia,
    transport: getTransport(),
  });
}

/**
 * Awards one stamp to `customer` on-chain and waits for the transaction to be
 * mined, so the caller can report the customer's fresh stamp count. Only ever
 * called after the caller (the award API route) has verified who is asking.
 */
export async function awardStampOnChain(customer: Address) {
  const walletClient = getBackendWalletClient();
  const contractAddress = getContractAddress();

  const hash = await walletClient.writeContract({
    address: contractAddress,
    abi: loyaltyCardAbi,
    functionName: "awardStamp",
    args: [customer],
  });

  const publicClient = getPublicClient();
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  const newStampCount = await publicClient.readContract({
    address: contractAddress,
    abi: loyaltyCardAbi,
    functionName: "balanceOf",
    args: [customer],
  });
  const freeCakeEvents = parseEventLogs({
    abi: loyaltyCardAbi,
    eventName: "FreeCakeEarned",
    logs: receipt.logs,
  });

  return { txHash: hash, newStampCount, freeCakeEarned: freeCakeEvents.length > 0 };
}

export async function getStampBalance(customer: Address) {
  const contractAddress = getContractAddress();
  const publicClient = getPublicClient();
  const [stamps, cakes, threshold] = await Promise.all([
    publicClient.readContract({
      address: contractAddress,
      abi: loyaltyCardAbi,
      functionName: "balanceOf",
      args: [customer],
    }),
    publicClient.readContract({
      address: contractAddress,
      abi: loyaltyCardAbi,
      functionName: "freeCakesEarned",
      args: [customer],
    }),
    publicClient.readContract({
      address: contractAddress,
      abi: loyaltyCardAbi,
      functionName: "stampsForFreeCake",
    }),
  ]);
  return { stamps, freeCakesEarned: cakes, stampsForFreeCake: threshold };
}
