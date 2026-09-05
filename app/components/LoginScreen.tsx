"use client";

import { usePrivy } from "@privy-io/react-auth";

export function LoginScreen() {
  const { login } = usePrivy();

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-8 bg-amber-50 px-6 py-16 text-center">
      <div className="flex flex-col items-center gap-2">
        <span className="text-5xl">🥐</span>
        <h1 className="text-2xl font-semibold text-amber-950">Ramesh&apos;s Bakery</h1>
        <p className="max-w-xs text-sm text-amber-800">
          Ten stamps, one free cake. Sign in once and your card follows you - no photocopier required.
        </p>
      </div>

      <button
        type="button"
        onClick={() => login()}
        className="rounded-full bg-amber-900 px-8 py-3 text-base font-medium text-amber-50 shadow-sm transition-colors hover:bg-amber-800"
      >
        Sign in with email or Google
      </button>

      <p className="max-w-xs text-xs text-amber-700">
        No app to install, no wallet to set up, no recovery phrase to write down.
      </p>
    </div>
  );
}
