import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  getCompletenessCardClass,
  getCompletenessStatusLabel,
  type CategoryCompletenessSummary,
} from "@/lib/edit-suggestions";
import { cn, formatPersianNumber } from "@/lib/utils";

export interface DashboardCompletenessCardData {
  label: string;
  href: string;
  icon: LucideIcon;
  value: number;
  completeness?: CategoryCompletenessSummary;
  showOwnerHint?: boolean;
}

interface DashboardCompletenessCardsProps {
  cards: DashboardCompletenessCardData[];
}

export function DashboardCompletenessCards({ cards }: DashboardCompletenessCardsProps) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
      {cards.map((card) => {
        const Icon = card.icon;
        const status = card.completeness?.status ?? "empty";
        const errorMessages = card.completeness?.errorMessages.slice(0, 3) ?? [];

        return (
          <Link key={card.href} href={card.href}>
            <Card
              className={cn(
                "h-full cursor-pointer border transition-shadow hover:shadow-md",
                getCompletenessCardClass(status)
              )}
            >
              <CardContent className="space-y-3 p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm text-muted-foreground">{card.label}</p>
                    <p className="mt-1 text-2xl font-bold">{formatPersianNumber(card.value)}</p>
                    {card.showOwnerHint && (
                      <p className="mt-1 text-xs text-muted-foreground">مورد ثبت‌شده</p>
                    )}
                  </div>
                  <Icon className="h-5 w-5 shrink-0 opacity-80" />
                </div>

                {card.completeness ? (
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Badge
                        variant={
                          status === "complete"
                            ? "success"
                            : status === "partial"
                              ? "warning"
                              : status === "incomplete"
                                ? "destructive"
                                : "outline"
                        }
                      >
                        {getCompletenessStatusLabel(status)}
                      </Badge>
                      {card.completeness.incompleteItems > 0 && (
                        <span className="text-xs text-muted-foreground">
                          {formatPersianNumber(card.completeness.incompleteItems)} ناقص از{" "}
                          {formatPersianNumber(card.completeness.totalItems)}
                        </span>
                      )}
                    </div>

                    {status === "empty" ? (
                      <p className="text-xs text-muted-foreground">هنوز موردی ثبت نشده است.</p>
                    ) : errorMessages.length > 0 ? (
                      <ul className="space-y-1 text-xs text-destructive">
                        {errorMessages.map((message) => (
                          <li key={message}>• {message}</li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-xs text-emerald-700 dark:text-emerald-300">
                        همه فیلدهای این بخش کامل است.
                      </p>
                    )}
                  </div>
                ) : null}
              </CardContent>
            </Card>
          </Link>
        );
      })}
    </div>
  );
}
