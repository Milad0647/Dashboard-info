"use client";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import { useState } from "react";

interface AdminDataTableProps<T> {
  data: T[];
  columns: {
    key: string;
    label: string;
    render?: (item: T) => React.ReactNode;
  }[];
  searchKeys?: (keyof T)[];
  onEdit?: (item: T) => void;
  onDelete?: (item: T) => void;
  onTogglePublish?: (item: T) => void;
  getPublished?: (item: T) => boolean;
  emptyMessage?: string;
}

export function AdminDataTable<T extends { id: string }>({
  data,
  columns,
  searchKeys = [],
  onEdit,
  onDelete,
  onTogglePublish,
  getPublished,
  emptyMessage = "موردی یافت نشد.",
}: AdminDataTableProps<T>) {
  const [search, setSearch] = useState("");
  const hasActions = Boolean(onEdit || onDelete || onTogglePublish);

  const filtered = data.filter((item) => {
    if (!search) return true;
    return searchKeys.some((key) => {
      const val = item[key];
      return String(val ?? "").toLowerCase().includes(search.toLowerCase());
    });
  });

  return (
    <div className="space-y-4">
      <div className="relative max-w-sm">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="جستجو..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pr-9"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground border rounded-xl">
          {emptyMessage}
        </div>
      ) : (
        <div className="border rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] table-fixed text-sm">
              <colgroup>
                {hasActions && <col className="w-[200px]" />}
                {columns.map((col) => (
                  <col key={col.key} />
                ))}
              </colgroup>
              <thead className="bg-muted/50">
                <tr>
                  {hasActions && (
                    <th className="text-right px-4 py-3 font-medium whitespace-nowrap">
                      عملیات
                    </th>
                  )}
                  {columns.map((col) => (
                    <th key={col.key} className="text-right px-4 py-3 font-medium">
                      {col.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((item) => (
                  <tr key={item.id} className="border-t hover:bg-muted/30">
                    {hasActions && (
                      <td className="px-4 py-3 align-middle">
                        <div className="flex flex-wrap items-center justify-start gap-1">
                          {onEdit && (
                            <Button variant="ghost" size="sm" onClick={() => onEdit(item)}>
                              ویرایش
                            </Button>
                          )}
                          {onTogglePublish && getPublished && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => onTogglePublish(item)}
                            >
                              {getPublished(item) ? "عدم انتشار" : "انتشار"}
                            </Button>
                          )}
                          {onDelete && (
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="sm" className="text-destructive">
                                  حذف
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>حذف مورد</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    آیا از حذف این مورد اطمینان دارید؟ این عمل قابل بازگشت نیست.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter className="flex-row-reverse gap-2">
                                  <AlertDialogAction onClick={() => onDelete(item)}>
                                    حذف
                                  </AlertDialogAction>
                                  <AlertDialogCancel>انصراف</AlertDialogCancel>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          )}
                        </div>
                      </td>
                    )}
                    {columns.map((col) => (
                      <td key={col.key} className="px-4 py-3 text-right align-middle">
                        {col.render
                          ? col.render(item)
                          : String((item as Record<string, unknown>)[col.key] ?? "—")}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
