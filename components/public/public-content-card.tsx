"use client";

import type { ReactNode } from "react";
import { CalendarDays, FolderOpen, Tags } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { PublicOwnerTag } from "@/components/public/public-owner-tag";
import { cn } from "@/lib/utils";

interface PublicContentCardProps {
  title: string;
  date?: string | null;
  category?: string | null;
  topics?: (string | null | undefined)[];
  ownerUserId?: string | null;
  ownerName?: string | null;
  media: ReactNode;
  score?: ReactNode;
  actions?: ReactNode;
  className?: string;
}

export function PublicContentCard({
  title,
  date,
  category,
  topics = [],
  ownerUserId,
  ownerName,
  media,
  score,
  actions,
  className,
}: PublicContentCardProps) {
  const normalizedTopics = [...new Set(topics.map((topic) => topic?.trim()).filter(Boolean))] as string[];

  return (
    <Card className={cn("flex h-full min-w-0 flex-col gap-0 overflow-hidden py-0", className)}>
      <div className="relative aspect-square w-full shrink-0 overflow-hidden bg-muted">
        {media}
      </div>

      <CardContent className="flex flex-1 flex-col gap-3 p-3">
        <div className="space-y-2">
          <h3 className="break-words text-sm font-semibold leading-6">{title}</h3>
          <PublicOwnerTag ownerUserId={ownerUserId} ownerName={ownerName} />
        </div>

        <div className="flex flex-wrap gap-1.5">
          {category && (
            <Badge variant="secondary" className="max-w-full gap-1 text-[10px] font-normal">
              <FolderOpen className="h-3 w-3 shrink-0" />
              <span className="break-words">{category}</span>
            </Badge>
          )}
          {normalizedTopics.map((topic) => (
            <Badge key={topic} variant="outline" className="max-w-full gap-1 text-[10px] font-normal">
              <Tags className="h-3 w-3 shrink-0" />
              <span className="break-words">{topic.replace("|", " / ")}</span>
            </Badge>
          ))}
        </div>

        <div className="mt-auto space-y-2">
          {date && (
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <CalendarDays className="h-3.5 w-3.5 shrink-0" />
              <span>{date}</span>
            </p>
          )}
          {score}
        </div>
      </CardContent>

      {actions && (
        <CardFooter className="grid grid-cols-2 gap-2 p-3 pt-0 [&>*:only-child]:col-span-2">
          {actions}
        </CardFooter>
      )}
    </Card>
  );
}
