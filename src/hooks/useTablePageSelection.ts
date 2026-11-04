import { useCallback, useEffect, useMemo, useState } from "react";

/** Selección de filas en la página visible de una tabla paginada. */
export function useTablePageSelection(pageIds: number[]) {
  const [selectedIds, setSelectedIds] = useState<Set<number>>(() => new Set());

  const pageState: boolean | "mixed" = useMemo(() => {
    if (pageIds.length === 0) return false;
    const selectedOnPage = pageIds.filter((id) => selectedIds.has(id)).length;
    if (selectedOnPage === 0) return false;
    if (selectedOnPage === pageIds.length) return true;
    return "mixed";
  }, [pageIds, selectedIds]);

  const togglePage = useCallback(() => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      const allSelected = pageIds.length > 0 && pageIds.every((id) => next.has(id));
      if (allSelected) {
        pageIds.forEach((id) => next.delete(id));
      } else {
        pageIds.forEach((id) => next.add(id));
      }
      return next;
    });
  }, [pageIds]);

  const toggleSelect = useCallback((id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const clearSelection = useCallback(() => setSelectedIds(new Set()), []);

  useEffect(() => {
    if (selectedIds.size === 0) return;
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") clearSelection();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [selectedIds.size, clearSelection]);

  return {
    selectedIds,
    setSelectedIds,
    pageState,
    togglePage,
    toggleSelect,
    clearSelection,
  };
}
