import type { DataOwnerGroup } from "@/lib/types";
import { hasUserOwnedGroups } from "@/lib/owner-groups";
import { Badge } from "@/components/ui/badge";

interface OwnerGroupedSectionProps<T> {
  groups: DataOwnerGroup<T>[];
  children: (items: T[], group: DataOwnerGroup<T>) => React.ReactNode;
}

function GroupHeader({
  label,
  count,
  variant = "outline",
}: {
  label: string;
  count: number;
  variant?: "outline" | "secondary";
}) {
  return (
    <div className="flex items-center gap-2">
      <Badge variant={variant}>{label}</Badge>
      <span className="text-xs text-muted-foreground">{count} مورد</span>
    </div>
  );
}

function UserContentDivider() {
  return (
    <div className="relative py-2" role="separator" aria-label="محتوای کاربران">
      <div className="absolute inset-0 flex items-center">
        <span className="w-full border-t" />
      </div>
      <div className="relative flex justify-center">
        <span className="bg-background px-4 text-sm font-medium text-muted-foreground">
          محتوای کاربران
        </span>
      </div>
    </div>
  );
}

export function OwnerGroupedSection<T>({ groups, children }: OwnerGroupedSectionProps<T>) {
  if (groups.length === 0) return null;

  const adminGroups = groups.filter((group) => group.ownerUserId === null);
  const userGroups = groups.filter((group) => group.ownerUserId !== null);
  const showUserDivider = adminGroups.length > 0 && userGroups.length > 0;
  const showGroupHeaders = hasUserOwnedGroups(groups);

  if (!showGroupHeaders) {
    const onlyGroup = groups[0];
    return onlyGroup ? <>{children(onlyGroup.items, onlyGroup)}</> : null;
  }

  return (
    <div className="space-y-8">
      {adminGroups.map((group) => (
        <div key={group.ownerKey} className="space-y-4">
          {showUserDivider && <GroupHeader label={group.ownerLabel} count={group.items.length} variant="secondary" />}
          {children(group.items, group)}
        </div>
      ))}

      {showUserDivider && <UserContentDivider />}

      {userGroups.map((group) => (
        <div key={group.ownerKey} className="space-y-4">
          <GroupHeader label={group.ownerLabel} count={group.items.length} />
          {children(group.items, group)}
        </div>
      ))}
    </div>
  );
}
