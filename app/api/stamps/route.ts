import { NextRequest, NextResponse } from "next/server";
import { verifyAccessTokenOrThrow, getEmbeddedWalletAddress } from "@/lib/privyServer";
import { getStampBalance } from "@/lib/contract";

export const runtime = "nodejs";

function bearerToken(req: NextRequest): string | null {
  const header = req.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return null;
  return header.slice("Bearer ".length).trim() || null;
}

export async function GET(req: NextRequest) {
  const token = bearerToken(req);
  if (!token) {
    return NextResponse.json({ error: "Missing access token." }, { status: 401 });
  }

  let userId: string;
  try {
    const claims = await verifyAccessTokenOrThrow(token);
    userId = claims.user_id;
  } catch {
    return NextResponse.json({ error: "Invalid or expired session. Please sign in again." }, { status: 401 });
  }

  const walletAddress = await getEmbeddedWalletAddress(userId);
  if (!walletAddress) {
    return NextResponse.json(
      { error: "No wallet found for this account. Please sign out and back in." },
      { status: 400 },
    );
  }

  try {
    const balance = await getStampBalance(walletAddress);
    return NextResponse.json({
      walletAddress,
      stamps: balance.stamps,
      freeCakesEarned: Number(balance.freeCakesEarned),
      stampsForFreeCake: balance.stampsForFreeCake,
    });
  } catch (err) {
    console.error("Reading stamp balance failed", err);
    return NextResponse.json({ error: "Could not read stamp balance right now." }, { status: 502 });
  }
}
