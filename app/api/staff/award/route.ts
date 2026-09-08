import { NextRequest, NextResponse } from "next/server";
import { assertNonceUnused, markNonceUsed, verifyCustomerClaimOrThrow, verifyStaffPinOrThrow, type SignedClaim } from "@/lib/staffAuth";
import { awardStampOnChain } from "@/lib/contract";

export const runtime = "nodejs";

/**
 * The only route that can actually write a stamp. It never trusts the
 * customer's own device: the identity here comes from a signed claim the
 * *server* issued (`/api/qr-claim`) and a staff device scanned off the
 * customer's screen, gated behind a staff PIN this request must also supply.
 * A customer's own session, however it's called, has no path to this route
 * that awards itself - see FUTURE-ENHANCEMENTS.md for why that mattered.
 */
export async function POST(req: NextRequest) {
  try {
    verifyStaffPinOrThrow(req.headers.get("x-staff-pin"));
  } catch {
    return NextResponse.json({ error: "Incorrect staff PIN." }, { status: 401 });
  }

  let signed: SignedClaim;
  try {
    signed = await req.json();
  } catch {
    return NextResponse.json({ error: "Malformed scan." }, { status: 400 });
  }

  let claim;
  try {
    claim = verifyCustomerClaimOrThrow(signed);
    assertNonceUnused(claim);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid or expired code.";
    return NextResponse.json({ error: `${message} Ask the customer to refresh their code.` }, { status: 400 });
  }

  try {
    const result = await awardStampOnChain(claim.walletAddress);
    markNonceUsed(claim);
    return NextResponse.json({
      success: true,
      walletAddress: claim.walletAddress,
      newStampCount: result.newStampCount,
      freeCakeEarned: result.freeCakeEarned,
      txHash: result.txHash,
    });
  } catch (err) {
    console.error("awardStamp on-chain call failed", err);
    return NextResponse.json({ error: "Could not record the stamp on-chain. Try scanning again." }, { status: 502 });
  }
}
