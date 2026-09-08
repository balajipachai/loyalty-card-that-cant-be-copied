import { StaffScanner } from "../components/StaffScanner";

export default function StaffPage() {
  return (
    <div className="flex flex-1 flex-col items-center gap-8 bg-amber-50 px-6 py-12">
      <div className="w-full max-w-sm text-center">
        <p className="text-xs uppercase tracking-wide text-amber-700">Staff device only</p>
        <h1 className="text-lg font-semibold text-amber-950">Award a stamp</h1>
      </div>
      <StaffScanner />
    </div>
  );
}
