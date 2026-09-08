"use client";

import { useCallback, useEffect, useState } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { StampGrid } from "./StampGrid";
import { CustomerQRCode } from "./CustomerQRCode";

type BalanceState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | {
      status: "ready";
      stamps: number;
      freeCakesEarned: number;
      stampsForFreeCake: number;
      walletAddress: string;
    };

export function Dashboard() {
  const { user, logout, getAccessToken } = usePrivy();
  const [balance, setBalance] = useState<BalanceState>({ status: "loading" });

  // No setState synchronously up front here - the initial `useState` value is
  // already "loading", and callers that re-trigger this after it's settled
  // (the "Try again" button) set that state themselves before calling in.
  const fetchBalance = useCallback(async () => {
    const token = await getAccessToken();
    if (!token) {
      setBalance({ status: "error", message: "Your session expired. Please sign in again." });
      return;
    }
    try {
      const res = await fetch("/api/stamps", { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (!res.ok) {
        setBalance({ status: "error", message: data.error ?? "Could not load your card." });
        return;
      }
      setBalance({
        status: "ready",
        stamps: data.stamps,
        freeCakesEarned: data.freeCakesEarned,
        stampsForFreeCake: data.stampsForFreeCake,
        walletAddress: data.walletAddress,
      });
    } catch {
      setBalance({ status: "error", message: "Could not reach the server. Check your connection." });
    }
  }, [getAccessToken]);

  useEffect(() => {
    // fetchBalance's first statement is `await getAccessToken()`, so nothing
    // runs synchronously here - this is the standard fetch-on-mount pattern.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchBalance();
  }, [fetchBalance]);

  const retryBalance = useCallback(() => {
    setBalance({ status: "loading" });
    fetchBalance();
  }, [fetchBalance]);

  const walletAddress = balance.status === "ready" ? balance.walletAddress : user?.wallet?.address;

  return (
    <div className="flex flex-1 flex-col items-center gap-8 bg-amber-50 px-6 py-12">
      <div className="flex w-full max-w-sm items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-amber-700">Signed in as</p>
          <p className="font-mono text-xs text-amber-900">
            {walletAddress ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}` : "..."}
          </p>
        </div>
        <button
          type="button"
          onClick={() => logout()}
          className="text-xs font-medium text-amber-700 underline underline-offset-2"
        >
          Sign out
        </button>
      </div>

      <div className="flex w-full max-w-sm flex-col items-center gap-4 rounded-2xl bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-amber-950">Your punch card</h2>

        {balance.status === "loading" && <p className="text-sm text-amber-700">Loading your card...</p>}
        {balance.status === "error" && (
          <div className="flex flex-col items-center gap-2">
            <p className="text-sm text-red-700">{balance.message}</p>
            <button type="button" onClick={retryBalance} className="text-xs font-medium text-amber-700 underline">
              Try again
            </button>
          </div>
        )}
        {balance.status === "ready" && (
          <>
            <StampGrid stamps={balance.stamps} total={balance.stampsForFreeCake} />
            <p className="text-sm text-amber-800">
              {balance.stamps}/{balance.stampsForFreeCake} stamps
              {balance.freeCakesEarned > 0 &&
                ` · ${balance.freeCakesEarned} free cake${balance.freeCakesEarned > 1 ? "s" : ""} earned`}
            </p>
          </>
        )}
      </div>

      <CustomerQRCode />

      {balance.status === "ready" && (
        <button type="button" onClick={retryBalance} className="text-xs font-medium text-amber-700 underline">
          Refresh my card
        </button>
      )}
    </div>
  );
}
