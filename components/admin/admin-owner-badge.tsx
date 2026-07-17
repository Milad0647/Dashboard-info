import { Badge } from "@/components/ui/badge";
import type { Ownable } from "@/lib/types";
import { cn } from "@/lib/utils";

interface AdminOwnerBadgeProps {
  ownerUserId?: string | null;
  ownerName?: string | null;
  className?: string;
}

export function AdminOwnerBadge({ ownerUserId, ownerName, className }: AdminOwnerBadgeProps) {
  if (!ownerUserId) return null;

  const label = ownerName?.trim() || "کاربر";

  return (
    <Badge
      variant="outline"
      className={cn("max-w-[140px] truncate text-[10px] px-1.5 py-0", className)}
      title={label}
    >
      {label}
    </Badge>
  );
}

export function adminOwnerTableColumn<T extends Ownable>() {
  return {
    key: "owner",
    label: "کاربر",
    render: (item: T) => (
      <AdminOwnerBadge ownerUserId={item.ownerUserId} ownerName={item.ownerName} />
    ),
  };
}
