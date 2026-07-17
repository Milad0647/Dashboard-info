"use client";

import type { ReactNode } from "react";
import { CalendarDays, FolderOpen, Tags, User } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface PublicContentDetailFieldsProps {
  category?: string | null;
  topics?: (string | null | undefined)[];
  date?: string | null;
  ownerName?: string | null;
  description?: string | null;
  extras?: ReactNode;
}

export function PublicContentDetailFields({
  category,
  topics = [],
  date,
  ownerName,
  description,
  extras,
}: PublicContentDetailFieldsProps) {
  const normalizedTopics = [...new Set(topics.map((topic) => topic?.trim()).filter(Boolean))] as string[];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5">
        {category && (
          <Badge variant="secondary" className="gap-1 font-normal">
            <FolderOpen className="h-3.5 w-3.5 shrink-0" />
            {category}
          </Badge>
        )}
        {normalizedTopics.map((topic) => (
          <Badge key={topic} variant="outline" className="gap-1 font-normal">
            <Tags className="h-3.5 w-3.5 shrink-0" />
            {topic.replace("|", " / ")}
          </Badge>
        ))}
      </div>

      {(date || ownerName) && (
        <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
          {date && (
            <span className="inline-flex items-center gap-1.5">
              <CalendarDays className="h-3.5 w-3.5 shrink-0" />
              {date}
            </span>
          )}
          {ownerName && (
            <span className="inline-flex items-center gap-1.5">
              <User className="h-3.5 w-3.5 shrink-0" />
              {ownerName}
            </span>
          )}
        </div>
      )}

      {description && (
        <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-muted-foreground">
          {description}
        </p>
      )}

      {extras}
    </div>
  );
}
