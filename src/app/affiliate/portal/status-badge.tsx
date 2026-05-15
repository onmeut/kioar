import { cn } from "@/lib/utils";

export function AffiliateStatusBadge({
  status,
}: {
  status: "active" | "paused" | "banned";
}) {
  const tone =
    status === "active"
      ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
      : status === "paused"
        ? "bg-amber-50 text-amber-800 ring-amber-200"
        : "bg-rose-50 text-rose-800 ring-rose-200";
  const label =
    status === "active" ? "فعال" : status === "paused" ? "متوقف" : "مسدود";
  return (
    <span
      className={cn(
        "rounded-full px-2.5 py-0.5 text-[10px] font-bold ring-1",
        tone,
      )}
    >
      {label}
    </span>
  );
}
