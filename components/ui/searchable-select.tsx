"use client";

import {
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
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

/** Search box + max-h-64 list — used to decide whether to open upward. */
const DROPDOWN_ESTIMATED_HEIGHT = 320;

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
  const [panelStyle, setPanelStyle] = useState<CSSProperties | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
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

  useLayoutEffect(() => {
    if (!open) {
      setPanelStyle(null);
      return;
    }

    const updatePosition = () => {
      const trigger = rootRef.current;
      if (!trigger) return;

      const rect = trigger.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;
      const openUp =
        spaceBelow < DROPDOWN_ESTIMATED_HEIGHT && spaceAbove > spaceBelow;
      const maxHeight = Math.min(
        DROPDOWN_ESTIMATED_HEIGHT,
        Math.max(160, openUp ? spaceAbove - 12 : spaceBelow - 12)
      );
      const width = Math.min(Math.max(rect.width, 0), window.innerWidth - 16);
      const left = Math.min(Math.max(8, rect.left), window.innerWidth - width - 8);

      setPanelStyle({
        position: "fixed",
        left,
        width,
        maxHeight,
        zIndex: 220,
        ...(openUp
          ? { bottom: window.innerHeight - rect.top + 4 }
          : { top: rect.bottom + 4 }),
      });
    };

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open, filtered.length]);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (rootRef.current?.contains(target) || panelRef.current?.contains(target)) {
        return;
      }
      setOpen(false);
      setQuery("");
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

  const dropdown =
    open && !disabled && panelStyle
      ? createPortal(
          <div
            ref={panelRef}
            style={panelStyle}
            className="flex flex-col overflow-hidden rounded-lg border border-border bg-popover text-popover-foreground shadow-md"
            role="listbox"
            id={listId}
          >
            <div className="shrink-0 border-b p-2">
              <div className="relative">
                <Search className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  ref={inputRef}
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={searchPlaceholder}
                  className="h-9 pr-8 text-sm"
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && filtered[0]) {
                      event.preventDefault();
                      handleSelect(filtered[0].value);
                    }
                  }}
                />
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">
              {filtered.length === 0 ? (
                <p className="px-3 py-3 text-center text-sm text-muted-foreground">{emptyText}</p>
              ) : (
                filtered.map((option, index) => {
                  const isSelected = !clearAfterSelect && option.value === value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      title={option.label}
                      className={cn(
                        "relative flex w-full cursor-default select-none items-start py-2.5 pr-9 pl-3 text-sm outline-none",
                        "hover:bg-accent hover:text-accent-foreground",
                        isSelected && "bg-accent/60",
                        index > 0 && "border-t border-border/70"
                      )}
                      onClick={() => handleSelect(option.value)}
                    >
                      <span className="absolute right-2.5 top-3 flex h-3.5 w-3.5 items-center justify-center">
                        {isSelected ? <Check className="h-4 w-4" /> : null}
                      </span>
                      <span className="w-full whitespace-normal break-words text-right text-[13px] font-medium leading-relaxed">
                        {option.label}
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          </div>,
          document.body
        )
      : null;

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <button
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        title={clearAfterSelect ? undefined : displayLabel || undefined}
        onClick={() => {
          if (disabled) return;
          setOpen((current) => !current);
          setQuery("");
        }}
        className={cn(
          "flex min-h-10 w-full items-center justify-between gap-2 rounded-lg border border-input bg-card px-3 py-2 text-sm ring-offset-background",
          "focus:outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
          triggerClassName
        )}
      >
        <span className="flex min-w-0 flex-1 items-center gap-2">
          {leadingIcon}
          <span
            className={cn(
              "min-w-0 flex-1 text-right text-[13px] font-medium leading-snug line-clamp-2",
              !displayLabel || clearAfterSelect ? "text-muted-foreground font-normal" : undefined
            )}
          >
            {clearAfterSelect ? placeholder : displayLabel || placeholder}
          </span>
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
      </button>
      {dropdown}
    </div>
  );
}
