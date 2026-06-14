"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";

interface CollapsibleSectionProps {
  id?: string;
  title: string;
  description?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
  controls?: React.ReactNode;
}

export function CollapsibleSection({
  id,
  title,
  description,
  defaultOpen = true,
  children,
  controls,
}: CollapsibleSectionProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section id={id} className="rounded-xl border bg-card/40">
      <div className="flex flex-col gap-3 border-b p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 items-start gap-3 text-right">
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            className="mt-0.5 shrink-0 rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-expanded={open}
            aria-label={open ? "بستن بخش" : "باز کردن بخش"}
          >
            {open ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
          </button>

          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            className="min-w-0 flex-1 space-y-1 text-right"
          >
            <h2 className="text-xl font-bold tracking-tight">{title}</h2>
            {description && <p className="text-sm text-muted-foreground">{description}</p>}
          </button>
        </div>

        {controls && <div className="flex flex-wrap items-center gap-2">{controls}</div>}
      </div>

      <div className={cn("p-4 transition-all", open ? "block" : "hidden")}>{children}</div>
    </section>
  );
}
