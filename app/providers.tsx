"use client";

import { PrivyProvider } from "@privy-io/react-auth";
import { baseSepolia } from "viem/chains";

export function Providers({ children }: { children: React.ReactNode }) {
  const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;

  if (!appId) {
    throw new Error("NEXT_PUBLIC_PRIVY_APP_ID is not set. Add it to .env.local (see .env.example).");
  }

  return (
    <PrivyProvider
      appId={appId}
      config={{
        // A bakery-queue customer signs in with something they already have.
        // No external wallet in this list, so it is never the primary path.
        loginMethods: ["email", "google"],
        embeddedWallets: {
          ethereum: {
            // A wallet is created the moment someone who has none finishes
            // logging in - no separate "create wallet" click, ever.
            createOnLogin: "users-without-wallets",
          },
        },
        defaultChain: baseSepolia,
        supportedChains: [baseSepolia],
        appearance: {
          theme: "light",
          accentColor: "#B45309",
        },
      }}
    >
      {children}
    </PrivyProvider>
  );
}
