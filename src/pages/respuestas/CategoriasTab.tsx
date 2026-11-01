import {
  MessageSquareText,
  Pencil,
  Plus,
  Tag,
  Trash2,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { cannedCategoriesApi } from "../../api/canned";
import { ApiError } from "../../api/client";
import { Button } from "../../components/ui/Button";
import { ConfirmDialog, type ConfirmDialogProps } from "../../components/ui/ConfirmDialog";
import { DataTable, HeadRow, Row, Td, Th } from "../../components/ui/DataTable";
import { ClearFiltersButton } from "../../components/ui/FilterDropdown";
import { ListPanel } from "../../components/ui/ListPanel";
import { RowAction } from "../../components/ui/RowAction";
import { SearchInput } from "../../components/ui/SearchInput";
import { SelectBox } from "../../components/ui/SelectBox";
import { Spinner } from "../../components/ui/Spinner";
import { usePermissions } from "../../hooks/usePermissions";
import { formatDateTime } from "../../lib/format";
import { useLoadErrorReceipt } from "../../hooks/useNoticeReceipts";
import type { CategoriaResponseItem } from "../../types/api";
import { getCategoryBadgeClasses } from "./cannedHelpers";
import { CategoriaModal } from "./CategoriaModal";

interface CategoriasTabProps {
  onCategoriesChanged?: () => void;
}

export function CategoriasTab({ onCategoriesChanged }: CategoriasTabProps) {
  const { can } = usePermissions();
  const canMailSend = can("mail.send");

  const [categories, setCategories] = useState<CategoriaResponseItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [busyId, setBusyId] = useState<number | null>(null);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [confirmation, setConfirmation] = useState<Omit<ConfirmDialogProps, "onClose"> | null>(null);
  const [modal, setModal] = useState<"nueva" | CategoriaResponseItem | null>(null);

  function load() {
    cannedCategoriesApi
      .list()
      .then((data) => {
        setCategories(data);
        onCategoriesChanged?.();
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : "No se pudieron cargar las categorías"));
  }

  useEffect(load, []);

  useLoadErrorReceipt(error, "canned-categories-list", load);

  const term = search.trim().toLowerCase();
  const rows = useMemo(() => {
    return (categories ?? []).filter((item) => {
      if (!term) return true;
      return (
        item.name.toLowerCase().includes(term) ||
        (item.description && item.description.toLowerCase().includes(term))
      );
    });
  }, [categories, term]);

  // Selección múltiple
  const allPageSelected = rows.length > 0 && rows.every((item) => selectedIds.includes(item.id));
  const somePageSelected = rows.some((item) => selectedIds.includes(item.id));
  const pageState: boolean | "mixed" = allPageSelected ? true : somePageSelected ? "mixed" : false;

  function toggleSelection(id: number) {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]));
  }

  function toggleAllOnPage() {
    setSelectedIds((prev) => {
      if (allPageSelected) return prev.filter((id) => !rows.some((item) => item.id === id));
      const ids = new Set(prev);
      for (const item of rows) ids.add(item.id);
      return [...ids];
    });
  }

  function askDelete(item: CategoriaResponseItem) {
    setConfirmation({
      tone: "danger",
      icon: Trash2,
      eyebrow: "Correo · Categorías",
      title: "Eliminar categoría",
      description: (
        <>
          Se eliminará la categoría <strong className="font-semibold text-ink">{item.name}</strong>.
          {item.responseCount > 0 && (
            <span className="block mt-1 text-zinc-500">
              Las {item.responseCount} plantillas asociadas no se borrarán; quedarán en categoría "General".
            </span>
          )}
        </>
      ),
      confirmLabel: "Eliminar",
      onConfirm: async () => {
        setBusyId(item.id);
        try {
          await cannedCategoriesApi.remove(item.id);
          setSelectedIds((prev) => prev.filter((i) => i !== item.id));
          load();
        } finally {
          setBusyId(null);
        }
      },
    });
  }

  function askBulkDelete() {
    const count = selectedIds.length;
    if (count === 0) return;

    setConfirmation({
      tone: "danger",
      icon: Trash2,
      eyebrow: "Correo · Categorías en lote",
      title: `Eliminar ${count} ${count === 1 ? "categoría" : "categorías"}`,
      description: (
        <>
          Se eliminarán <strong className="font-semibold text-ink">{count} categorías</strong> seleccionadas.
          Las respuestas asociadas quedarán en categoría "General".
        </>
      ),
      confirmLabel: "Eliminar seleccionadas",
      onConfirm: async () => {
        try {
          await cannedCategoriesApi.bulkDelete(selectedIds);
          setSelectedIds([]);
          load();
        } catch {
          // Fallback individual
          for (const id of selectedIds) {
            try {
              await cannedCategoriesApi.remove(id);
            } catch {}
          }
          setSelectedIds([]);
          load();
        }
      },
    });
  }

  return (
    <div className="flex flex-col flex-1">
      {/* Panel con barra de selección en lote */}
      <ListPanel
        selection={
          canMailSend && selectedIds.length > 0
            ? {
                count: selectedIds.length,
                pageState,
                onTogglePage: toggleAllOnPage,
                onClear: () => setSelectedIds([]),
                actions: [
                  {
                    key: "bulk-delete",
                    label: "Eliminar seleccionadas",
                    icon: <Trash2 aria-hidden className="h-3.5 w-3.5 text-brand-red" />,
                    onClick: askBulkDelete,
                  },
                ],
              }
            : undefined
        }
        toolbar={
          <div className="flex w-full flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <SearchInput
                value={search}
                onChange={setSearch}
                placeholder="Buscar categoría o descripción…"
                className="w-[280px]"
              />
              {search && <ClearFiltersButton onClick={() => setSearch("")} title="Limpiar búsqueda" />}
            </div>

            {canMailSend && (
              <Button size="sm" onClick={() => setModal("nueva")}>
                <Plus className="h-[15px] w-[15px]" />
                Nueva categoría
              </Button>
            )}
          </div>
        }
      >
        {categories === null ? (
          <div className="flex justify-center py-16">
            <Spinner />
          </div>
        ) : (
          <DataTable>
            <thead>
              <HeadRow>
                {canMailSend && (
                  <Th className="w-10 px-2 text-center">
                    <div className="flex items-center justify-center">
                      <SelectBox
                        checked={pageState}
                        label={
                          pageState === true
                            ? "Quitar la selección de esta página"
                            : "Seleccionar todas las categorías de esta página"
                        }
                        onToggle={toggleAllOnPage}
                      />
                    </div>
                  </Th>
                )}
                <Th className="w-44">Categoría</Th>
                <Th>Descripción</Th>
                <Th className="w-36 text-center">Plantillas</Th>
                <Th className="w-36">Actualizada</Th>
                <Th className="w-24 text-right">Acciones</Th>
              </HeadRow>
            </thead>
            <tbody>
              {rows.map((item) => {
                const checked = selectedIds.includes(item.id);
                const badge = getCategoryBadgeClasses(item.name, item.color);

                return (
                  <Row key={item.id} busy={busyId === item.id} className="hover:bg-zinc-50/70 transition-colors">
                    {/* Checkbox de selección */}
                    {canMailSend && (
                      <Td className="w-10 px-2 text-center" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-center">
                          <SelectBox
                            checked={checked}
                            label={`Seleccionar ${item.name}`}
                            onToggle={() => toggleSelection(item.id)}
                          />
                        </div>
                      </Td>
                    )}

                    {/* Nombre y distintivo */}
                    <Td className="whitespace-nowrap">
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[11.5px] font-semibold ${badge.badge}`}
                      >
                        <span className={`size-1.5 rounded-full ${badge.dot}`} />
                        <span>{item.name}</span>
                      </span>
                    </Td>

                    {/* Descripción */}
                    <Td className="text-[12.5px] text-subtle max-w-[360px] truncate" title={item.description ?? ""}>
                      {item.description || <span className="text-zinc-400 font-mono text-[11px]">—</span>}
                    </Td>

                    {/* Conteo de plantillas asociadas */}
                    <Td className="text-center whitespace-nowrap">
                      <span className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2 py-0.5 font-heading text-[11px] font-semibold text-zinc-700">
                        <MessageSquareText className="h-3 w-3 text-zinc-400" />
                        <span>{item.responseCount} {item.responseCount === 1 ? "plantilla" : "plantillas"}</span>
                      </span>
                    </Td>

                    {/* Fecha de actualización */}
                    <Td className="whitespace-nowrap text-[12px] text-subtle">{formatDateTime(item.updatedAt)}</Td>

                    {/* Acciones */}
                    <Td onClick={(e) => e.stopPropagation()}>
                      {canMailSend && (
                        <div className="flex items-center justify-end gap-1">
                          <RowAction
                            label={`Editar ${item.name}`}
                            icon={Pencil}
                            onClick={() => setModal(item)}
                            disabled={busyId === item.id}
                          />
                          <RowAction
                            label={`Eliminar ${item.name}`}
                            icon={Trash2}
                            onClick={() => askDelete(item)}
                            disabled={busyId === item.id}
                            danger
                          />
                        </div>
                      )}
                    </Td>
                  </Row>
                );
              })}
            </tbody>
          </DataTable>
        )}

        {categories !== null && rows.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-14 text-center">
            <Tag className="h-6 w-6 text-faint" />
            <p className="text-[13.5px] text-faint">
              {term ? "Ninguna categoría coincide con la búsqueda." : "Todavía no hay categorías registradas."}
            </p>
          </div>
        )}
      </ListPanel>

      {confirmation && <ConfirmDialog {...confirmation} onClose={() => setConfirmation(null)} />}

      {modal !== null && (
        <CategoriaModal
          category={modal === "nueva" ? undefined : modal}
          onClose={() => setModal(null)}
          onSaved={load}
        />
      )}
    </div>
  );
}
