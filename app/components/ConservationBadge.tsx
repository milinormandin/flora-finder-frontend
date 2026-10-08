import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export default function ConservationBadge({ status }: { status?: string | null }) {
  const normalized = status?.trim().replace(/^sample:\s*/i, "").toLowerCase();
  const color =
    normalized === "endangered" || normalized === "critically endangered" || normalized === "en" || normalized === "cr"
      ? "border-[#E8C9BB] bg-[#F9EEE7] text-[#85452D]"
      : normalized === "vulnerable" || normalized === "near threatened" || normalized === "vu" || normalized === "nt"
        ? "border-[#E5D6B2] bg-[#F7F0DF] text-[#725824]"
        : normalized === "least concern" || normalized === "lc"
          ? "border-[#CDDCC8] bg-[#ECF2E8] text-[#3D5D34]"
          : "border-border bg-secondary/50 text-muted-foreground";

  return (
    <Badge variant="outline" className={cn("max-w-full gap-1.5 whitespace-normal px-2.5 py-1 text-[11px] font-medium leading-4", color)}>
      <span className="size-1.5 shrink-0 rounded-full bg-current" aria-hidden="true" />
      {status?.trim() || "Status unavailable"}
    </Badge>
  );
}
