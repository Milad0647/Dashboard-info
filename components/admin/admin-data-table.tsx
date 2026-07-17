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
import { Search, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { AdminItemActions } from "@/components/admin/admin-item-actions";

interface AdminDataTableProps<T> {
  data: T[];
  columns: {
    key: string;
    label: string;
    render?: (item: T) => React.ReactNode;
  }[];
  searchKeys?: (keyof T)[];
  onView?: (item: T) => void;
  onEdit?: (item: T) => void;
  onDelete?: (item: T) => void;
  onBulkDelete?: (items: T[]) => void;
  onTogglePublish?: (item: T) => void;
  getPublished?: (item: T) => boolean;
  isReadOnly?: (item: T) => boolean;
  selectable?: boolean;
  emptyMessage?: string;
}

export function AdminDataTable<T extends { id: string }>({
  data,
  columns,
  searchKeys = [],
  onView,
  onEdit,
  onDelete,
  onBulkDelete,
  onTogglePublish,
  getPublished,
  isReadOnly,
  selectable = false,
  emptyMessage = "موردی یافت نشد.",
}: AdminDataTableProps<T>) {
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const hasActions = Boolean(onView || onEdit || onDelete || onTogglePublish);
  const showSelection = selectable && Boolean(onBulkDelete);

  const filtered = data.filter((item) => {
    if (!search) return true;
    return searchKeys.some((key) => {
      const val = item[key];
      return String(val ?? "").toLowerCase().includes(search.toLowerCase());
    });
  });

  const selectableRows = filtered.filter((item) => !(isReadOnly?.(item) ?? false));
  const selectedCount = selectedIds.size;
  const allVisibleSelected =
    selectableRows.length > 0 && selectableRows.every((item) => selectedIds.has(item.id));

  useEffect(() => {
    const existingIds = new Set(data.map((item) => item.id));
    setSelectedIds((prev) => {
      const next = new Set([...prev].filter((id) => existingIds.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [data]);

  const toggleRow = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleAllVisible = () => {
    if (allVisibleSelected) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        selectableRows.forEach((item) => next.delete(item.id));
        return next;
      });
      return;
    }

    setSelectedIds((prev) => {
      const next = new Set(prev);
      selectableRows.forEach((item) => next.add(item.id));
      return next;
    });
  };

  const handleBulkDelete = () => {
    const selectedItems = data.filter((item) => selectedIds.has(item.id));
    if (selectedItems.length === 0) return;
    onBulkDelete?.(selectedItems);
    setSelectedIds(new Set());
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative max-w-sm flex-1 min-w-[200px]">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="جستجو..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pr-9"
          />
        </div>

        {showSelection && selectedCount > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">{selectedCount} مورد انتخاب شده</span>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm">
                  <Trash2 className="h-4 w-4" />
                  حذف دسته‌جمعی
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>حذف دسته‌جمعی</AlertDialogTitle>
                  <AlertDialogDescription>
                    آیا از حذف {selectedCount} مورد انتخاب‌شده اطمینان دارید؟ این عمل قابل بازگشت نیست.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter className="flex-row-reverse gap-2">
                  <AlertDialogAction onClick={handleBulkDelete}>حذف</AlertDialogAction>
                  <AlertDialogCancel>انصراف</AlertDialogCancel>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground border rounded-xl">
          {emptyMessage}
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="bg-muted/50">
                <tr>
                  {showSelection && (
                    <th className="w-12 px-3 py-3 text-right">
                      <input
                        type="checkbox"
                        checked={allVisibleSelected}
                        onChange={toggleAllVisible}
                        disabled={selectableRows.length === 0}
                        aria-label="انتخاب همه"
                        className="h-4 w-4"
                      />
                    </th>
                  )}
                  {hasActions && (
                    <th className="w-[1%] whitespace-nowrap px-3 py-3 text-right font-medium">
                      عملیات
                    </th>
                  )}
                  {columns.map((col) => (
                    <th
                      key={col.key}
                      className="whitespace-nowrap px-3 py-3 text-right font-medium"
                    >
                      {col.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((item) => {
                  const readOnly = isReadOnly?.(item) ?? false;

                  return (
                    <tr
                      key={item.id}
                      className={
                        readOnly
                          ? "border-t bg-muted/20 hover:bg-muted/30"
                          : "border-t hover:bg-muted/30"
                      }
                    >
                      {showSelection && (
                        <td className="px-3 py-3 align-middle">
                          <input
                            type="checkbox"
                            checked={selectedIds.has(item.id)}
                            onChange={() => toggleRow(item.id)}
                            disabled={readOnly}
                            aria-label="انتخاب ردیف"
                            className="h-4 w-4"
                          />
                        </td>
                      )}
                      {hasActions && (
                        <td className="whitespace-nowrap px-3 py-3 align-middle">
                          {readOnly ? (
                            <span className="text-xs text-muted-foreground">از API — فقط مشاهده</span>
                          ) : (
                            <div className="inline-flex items-center gap-1">
                              <AdminItemActions
                                compact
                                onView={onView ? () => onView(item) : undefined}
                                onEdit={onEdit ? () => onEdit(item) : undefined}
                                onDelete={onDelete ? () => onDelete(item) : undefined}
                              />
                              {onTogglePublish && getPublished && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 px-2 text-xs"
                                  onClick={() => onTogglePublish(item)}
                                >
                                  {getPublished(item) ? "عدم انتشار" : "انتشار"}
                                </Button>
                              )}
                            </div>
                          )}
                        </td>
                      )}
                      {columns.map((col) => (
                        <td
                          key={col.key}
                          className="max-w-[220px] px-3 py-3 text-right align-middle"
                        >
                          <div className="min-w-0 truncate">
                            {col.render
                              ? col.render(item)
                              : String((item as Record<string, unknown>)[col.key] ?? "—")}
                          </div>
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
