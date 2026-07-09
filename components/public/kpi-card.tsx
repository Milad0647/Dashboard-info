import { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn, formatPersianNumber } from "@/lib/utils";

interface KPICardProps {
  title: string;
  value: number | string;
  icon: LucideIcon;
  description?: string;
  className?: string;
}

export function KPICard({ title, value, icon: Icon, description, className }: KPICardProps) {
  const displayValue = typeof value === "number" ? formatPersianNumber(value) : value;

  return (
    <Card className={cn("hover:shadow-md transition-shadow", className)}>
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p className="max-w-full break-all text-2xl font-bold leading-tight tracking-tight xl:text-3xl">
              {displayValue}
            </p>
            {description && (
              <p className="text-xs text-muted-foreground">{description}</p>
            )}
          </div>
          <div className="rounded-lg bg-primary/10 p-3">
            <Icon className="h-5 w-5 text-primary" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
