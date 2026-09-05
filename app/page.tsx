"use client";

import { usePrivy } from "@privy-io/react-auth";
import { LoginScreen } from "./components/LoginScreen";
import { Dashboard } from "./components/Dashboard";

export default function Home() {
  const { ready, authenticated } = usePrivy();

  // The SDK hasn't finished loading the session yet - don't guess which
  // screen to show, since a flash of the wrong one is exactly the kind of
  // "dull state" that erodes trust at the counter.
  if (!ready) {
    return (
      <div className="flex flex-1 items-center justify-center bg-amber-50">
        <p className="text-sm text-amber-700">Loading...</p>
      </div>
    );
  }

  return authenticated ? <Dashboard /> : <LoginScreen />;
}
