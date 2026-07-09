import { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn, formatPersianNumber } from "@/lib/utils";

interface KPICardProps {
  title: string;
  value: number | string;
  icon: LucideIcon;
  description?: string;
  className?: string;
  onClick?: () => void;
  todayDelta?: number;
  compactValue?: boolean;
}

export function KPICard({
  title,
  value,
  icon: Icon,
  description,
  className,
  onClick,
  todayDelta,
  compactValue = false,
}: KPICardProps) {
  const displayValue = typeof value === "number" ? formatPersianNumber(value) : value;

  return (
    <Card
      className={cn(
        "@container/kpi hover:shadow-md transition-shadow",
        onClick && "cursor-pointer hover:border-primary/40",
        className
      )}
      onClick={onClick}
      onKeyDown={
        onClick
          ? (event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onClick();
              }
            }
          : undefined
      }
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      <CardContent className="p-6">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1 space-y-2">
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <div className="flex min-w-0 items-baseline gap-2">
              <p
                className={cn(
                  "min-w-0 whitespace-nowrap font-bold tabular-nums leading-none tracking-tight",
                  compactValue
                    ? "text-[clamp(0.75rem,10cqw,1.5rem)]"
                    : "text-[clamp(1rem,12cqw,1.875rem)]"
                )}
              >
                {displayValue}
              </p>
              {todayDelta != null && todayDelta > 0 && (
                <span className="shrink-0 text-xs font-semibold text-emerald-600">
                  +{formatPersianNumber(todayDelta)}
                </span>
              )}
            </div>
            {description && <p className="text-xs text-muted-foreground">{description}</p>}
          </div>
          <div className="shrink-0 rounded-lg bg-primary/10 p-3">
            <Icon className="h-5 w-5 text-primary" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
