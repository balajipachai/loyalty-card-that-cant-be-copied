import { NextRequest, NextResponse } from "next/server";
import { verifyAccessTokenOrThrow, getEmbeddedWalletAddress } from "@/lib/privyServer";
import { awardStampOnChain } from "@/lib/contract";

export const runtime = "nodejs";

function bearerToken(req: NextRequest): string | null {
  const header = req.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return null;
  return header.slice("Bearer ".length).trim() || null;
}

export async function POST(req: NextRequest) {
  const token = bearerToken(req);
  if (!token) {
    return NextResponse.json({ error: "Missing access token." }, { status: 401 });
  }

  // Verify the token before touching anything else - the identity we stamp
  // against comes only from these claims, never from the request body.
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
    const result = await awardStampOnChain(walletAddress);
    return NextResponse.json({
      success: true,
      newStampCount: result.newStampCount,
      freeCakeEarned: result.freeCakeEarned,
      txHash: result.txHash,
    });
  } catch (err) {
    console.error("awardStamp on-chain call failed", err);
    return NextResponse.json(
      { error: "Could not record the stamp on-chain. Please ask staff to try again." },
      { status: 502 },
    );
  }
}
