"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePrivy } from "@privy-io/react-auth";
import QRCode from "qrcode";

type ClaimState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; dataUrl: string; expiresAt: number };

// Refetch a bit before the server-issued claim actually expires, so the code
// on screen is (almost) never the stale one - a customer shouldn't have to
// tap anything to keep it valid while it's up at the counter.
const REFRESH_MARGIN_MS = 10_000;

export function CustomerQRCode() {
  const { getAccessToken } = usePrivy();
  const [claim, setClaim] = useState<ClaimState>({ status: "loading" });
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchClaim = useCallback(async () => {
    const token = await getAccessToken();
    if (!token) {
      setClaim({ status: "error", message: "Your session expired. Please sign in again." });
      return;
    }
    try {
      const res = await fetch("/api/qr-claim", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) {
        setClaim({ status: "error", message: data.error ?? "Could not load your code." });
        return;
      }
      const dataUrl = await QRCode.toDataURL(JSON.stringify(data), { margin: 1, width: 220 });
      setClaim({ status: "ready", dataUrl, expiresAt: data.claim.exp });
    } catch {
      setClaim({ status: "error", message: "Could not reach the server. Check your connection." });
    }
  }, [getAccessToken]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchClaim();
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [fetchClaim]);

  useEffect(() => {
    if (claim.status !== "ready") return;
    const delay = Math.max(claim.expiresAt - Date.now() - REFRESH_MARGIN_MS, 0);
    timerRef.current = setTimeout(fetchClaim, delay);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [claim, fetchClaim]);

  return (
    <div className="flex w-full max-w-sm flex-col items-center gap-3">
      <div className="flex h-56 w-56 items-center justify-center rounded-2xl bg-white p-3 shadow-sm">
        {claim.status === "loading" && <p className="text-sm text-amber-700">Loading your code...</p>}
        {claim.status === "error" && <p className="text-center text-sm text-red-700">{claim.message}</p>}
        {claim.status === "ready" && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={claim.dataUrl} alt="Your loyalty code" width={220} height={220} />
        )}
      </div>
      <p className="text-center text-xs text-amber-700">
        Staff: scan this at the counter after ringing up the purchase to add a stamp. It refreshes on its
        own and only staff&apos;s device can use it.
      </p>
      {claim.status === "error" && (
        <button type="button" onClick={fetchClaim} className="text-xs font-medium text-amber-700 underline">
          Try again
        </button>
      )}
    </div>
  );
}
