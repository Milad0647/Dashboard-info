"use client";

import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Check, ChevronDown, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export interface SearchableSelectOption {
  value: string;
  label: string;
  keywords?: string;
}

interface SearchableSelectProps {
  value: string;
  onValueChange: (value: string) => void;
  options: SearchableSelectOption[];
  placeholder?: string;
  searchPlaceholder?: string;
  disabled?: boolean;
  emptyText?: string;
  className?: string;
  triggerClassName?: string;
  leadingIcon?: ReactNode;
  /** When true, selection clears after pick (useful for "add item" selects). */
  clearAfterSelect?: boolean;
}

function normalizeSearch(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/\u064A/g, "\u06CC")
    .replace(/\u0643/g, "\u06A9")
    .replace(/\u200C/g, " ");
}

export function SearchableSelect({
  value,
  onValueChange,
  options,
  placeholder = "انتخاب...",
  searchPlaceholder = "جستجو...",
  disabled = false,
  emptyText = "موردی یافت نشد",
  className,
  triggerClassName,
  leadingIcon,
  clearAfterSelect = false,
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();

  const selected = options.find((option) => option.value === value);
  const displayLabel = selected?.label ?? (value ? value : "");

  const filtered = useMemo(() => {
    const needle = normalizeSearch(query);
    if (!needle) return options;
    return options.filter((option) => {
      const haystack = normalizeSearch(
        `${option.label} ${option.keywords ?? ""} ${option.value}`
      );
      return haystack.includes(needle);
    });
  }, [options, query]);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        setQuery("");
      }
    };

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => inputRef.current?.focus(), 0);
    return () => window.clearTimeout(timer);
  }, [open]);

  const handleSelect = (nextValue: string) => {
    onValueChange(nextValue);
    setOpen(false);
    setQuery("");
  };

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <button
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => {
          if (disabled) return;
          setOpen((current) => !current);
          setQuery("");
        }}
        className={cn(
          "flex h-10 w-full items-center justify-between rounded-lg border border-input bg-card px-3 py-2 text-sm ring-offset-background",
          "focus:outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
          triggerClassName
        )}
      >
        <span className="flex min-w-0 flex-1 items-center gap-2">
          {leadingIcon}
          <span
            className={cn(
              "min-w-0 flex-1 truncate text-right",
              !displayLabel || clearAfterSelect ? "text-muted-foreground" : undefined
            )}
          >
            {clearAfterSelect ? placeholder : displayLabel || placeholder}
          </span>
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
      </button>

      {open && !disabled && (
        <div
          className="absolute z-[220] mt-1 w-full overflow-hidden rounded-lg border border-border bg-popover text-popover-foreground shadow-md"
          role="listbox"
          id={listId}
        >
          <div className="border-b p-2">
            <div className="relative">
              <Search className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                ref={inputRef}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={searchPlaceholder}
                className="h-8 pr-8 text-xs"
                onKeyDown={(event) => {
                  if (event.key === "Enter" && filtered[0]) {
                    event.preventDefault();
                    handleSelect(filtered[0].value);
                  }
                }}
              />
            </div>
          </div>
          <div className="max-h-56 overflow-y-auto p-1">
            {filtered.length === 0 ? (
              <p className="px-2 py-3 text-center text-xs text-muted-foreground">{emptyText}</p>
            ) : (
              filtered.map((option) => {
                const isSelected = !clearAfterSelect && option.value === value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    className={cn(
                      "relative flex w-full cursor-default select-none items-center rounded-md py-1.5 pr-8 pl-2 text-sm outline-none",
                      "hover:bg-accent hover:text-accent-foreground",
                      isSelected && "bg-accent/60"
                    )}
                    onClick={() => handleSelect(option.value)}
                  >
                    <span className="absolute right-2 flex h-3.5 w-3.5 items-center justify-center">
                      {isSelected ? <Check className="h-4 w-4" /> : null}
                    </span>
                    <span className="truncate text-right">{option.label}</span>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
