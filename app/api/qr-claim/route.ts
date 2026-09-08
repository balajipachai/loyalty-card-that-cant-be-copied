import { NextRequest, NextResponse } from "next/server";
import { verifyAccessTokenOrThrow, getEmbeddedWalletAddress } from "@/lib/privyServer";
import { issueCustomerClaim } from "@/lib/staffAuth";

export const runtime = "nodejs";

function bearerToken(req: NextRequest): string | null {
  const header = req.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return null;
  return header.slice("Bearer ".length).trim() || null;
}

/**
 * Issues the short-lived signed claim the customer's dashboard encodes into a
 * QR code. This route only ever proves identity - it never touches the
 * chain - so a customer's own device still can't award itself a stamp; only
 * `/api/staff/award` can, and only after a staff device scans the code this
 * returns.
 */
export async function POST(req: NextRequest) {
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

  const signed = issueCustomerClaim(walletAddress);
  return NextResponse.json(signed);
}
