export function StampGrid({ stamps, total }: { stamps: number; total: number }) {
  return (
    <div className="grid grid-cols-5 gap-3">
      {Array.from({ length: total }, (_, i) => {
        const filled = i < stamps;
        return (
          <div
            key={i}
            className={`flex h-12 w-12 items-center justify-center rounded-full border-2 text-xl ${
              filled
                ? "border-amber-700 bg-amber-700 text-amber-50"
                : "border-dashed border-amber-300 text-amber-200"
            }`}
          >
            {filled ? "🍞" : ""}
          </div>
        );
      })}
    </div>
  );
}
