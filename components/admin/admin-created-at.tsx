import { cn, formatPersianDateTime } from "@/lib/utils";

interface AdminCreatedAtTextProps {
  createdAt?: string | null;
  className?: string;
  /** Compact cards use a short prefix; previews/tables can pass an empty prefix. */
  prefix?: string;
}

export function AdminCreatedAtText({
  createdAt,
  className,
  prefix = "ثبت: ",
}: AdminCreatedAtTextProps) {
  if (!createdAt) return null;

  const formatted = formatPersianDateTime(createdAt);

  return (
    <p
      className={cn("truncate text-[10px] text-muted-foreground", className)}
      title={`تاریخ ثبت: ${formatted}`}
    >
      {prefix}
      {formatted}
    </p>
  );
}

export function adminCreatedAtDetail(createdAt?: string | null): {
  label: string;
  value: string;
} {
  return {
    label: "تاریخ ثبت",
    value: createdAt ? formatPersianDateTime(createdAt) : "—",
  };
}

export function adminCreatedAtTableColumn<T extends { createdAt?: string | null }>() {
  return {
    key: "createdAt",
    label: "تاریخ ثبت",
    render: (item: T) =>
      item.createdAt ? formatPersianDateTime(item.createdAt) : "—",
  };
}
