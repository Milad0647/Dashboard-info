"use client";

import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { AdminUser } from "@/lib/types";
import { cn } from "@/lib/utils";

interface ContentOwnerSelectProps {
  users: AdminUser[];
  value: string | null;
  onChange: (userId: string | null) => void;
  allowClear?: boolean;
  className?: string;
}

export function ContentOwnerSelect({
  users,
  value,
  onChange,
  allowClear = false,
  className,
}: ContentOwnerSelectProps) {
  const [search, setSearch] = useState("");

  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    const sorted = [...users].sort((a, b) => a.name.localeCompare(b.name, "fa"));
    if (!q) return sorted;
    return sorted.filter(
      (user) =>
        user.name.toLowerCase().includes(q) ||
        user.email.toLowerCase().includes(q) ||
        (user.province ?? "").toLowerCase().includes(q)
    );
  }, [search, users]);

  const selected = useMemo(
    () => users.find((user) => user.id === value) ?? null,
    [users, value]
  );

  return (
    <div className={cn("space-y-2 rounded-lg border border-dashed p-3", className)}>
      <Label>مالک محتوا</Label>
      {selected ? (
        <p className="text-xs text-muted-foreground">
          فعلی: {selected.name} — {selected.email}
        </p>
      ) : (
        <p className="text-xs text-muted-foreground">مالک تعیین نشده — یک کاربر انتخاب کنید</p>
      )}
      {allowClear && value ? (
        <button
          type="button"
          onClick={() => onChange(null)}
          className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
        >
          حذف مالک
        </button>
      ) : null}
      <Input
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder="جستجوی کاربر / شرکت..."
        className="h-9 text-xs"
      />
      <div className="max-h-36 space-y-1 overflow-y-auto rounded-md border p-1">
        {filteredUsers.length === 0 ? (
          <p className="px-2 py-1.5 text-xs text-muted-foreground">کاربری یافت نشد</p>
        ) : (
          filteredUsers.slice(0, 40).map((user) => (
            <button
              key={user.id}
              type="button"
              onClick={() => onChange(user.id)}
              className={cn(
                "w-full rounded-md px-2 py-1.5 text-right text-xs",
                value === user.id
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-muted"
              )}
            >
              <span className="block font-medium">{user.name}</span>
              <span className="block text-[10px] opacity-80">{user.email}</span>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
