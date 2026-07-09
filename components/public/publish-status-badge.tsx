import { Badge } from "@/components/ui/badge";

interface PublishStatusBadgeProps {
  published: boolean;
  className?: string;
}

export function PublishStatusBadge({ published, className }: PublishStatusBadgeProps) {
  if (published) return null;

  return (
    <Badge variant="secondary" className={className}>
      پیش‌نویس
    </Badge>
  );
}
