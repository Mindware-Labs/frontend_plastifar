import {
  HelpCircle,
  MessageSquareText,
  Pencil,
  Plus,
  Tag,
  Trash2,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { cannedApi, cannedCategoriesApi } from "../../api/canned";
import { ModuleHeader } from "../../components/app/ModuleHeader";
import { SEGMENTED_TAB_COUNT_BADGE_CLASS } from "../../components/ui/SegmentedTabs";
import { useLoadErrorReceipt } from "../../hooks/useNoticeReceipts";
import { Button } from "../../components/ui/Button";
import { ConfirmDialog, type ConfirmDialogProps } from "../../components/ui/ConfirmDialog";
import { DataTable, HeadRow, Row, Td, Th } from "../../components/ui/DataTable";
import { ClearFiltersButton, FilterDropdown, type FilterOption } from "../../components/ui/FilterDropdown";
import { ListEmptyState } from "../../components/ui/ListEmptyState";
import { ListPanel } from "../../components/ui/ListPanel";
import { Pagination } from "../../components/ui/Pagination";
import { RowAction } from "../../components/ui/RowAction";
import { SearchInput } from "../../components/ui/SearchInput";
import { SelectBox } from "../../components/ui/SelectBox";
import { TableSkeleton } from "../../components/ui/Skeleton";
import { useAuth } from "../../context/useAuth";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";
import { usePagedList } from "../../hooks/usePagedList";
import { usePermissions } from "../../hooks/usePermissions";
import { formatDateTime } from "../../lib/format";
import { templateToReadablePlain } from "../../lib/cannedVariables";
import type { CannedResponseResponse, CategoriaResponseItem } from "../../types/api";
import { getCategoryBadgeClasses, parseCanned } from "./cannedHelpers";
import { CannedPreviewDrawer } from "./CannedPreviewDrawer";
import { CannedResponseStudio } from "./CannedResponseStudio";
import { CategoriasTab } from "./CategoriasTab";
import { RespuestasHelpSheet } from "./RespuestasHelpSheet";

const NO_CATEGORIES: CategoriaResponseItem[] = [];

/** Plantillas de correo y categorías con selección múltiple y gestión en lote. */
export function RespuestasPage() {
  const { user } = useAuth();
  const { can } = usePermissions();
  const canMailSend = can("mail.send");

  const [activeTab, setActiveTab] = useState<"plantillas" | "categorias">("plantillas");

  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [pageSize, setPageSize] = useState(10);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [confirmation, setConfirmation] = useState<Omit<ConfirmDialogProps, "onClose"> | null>(null);

  // Estados de modal / drawers
  const [studioState, setStudioState] = useState<
    | { mode: "nueva" }
    | { mode: "editar"; item: CannedResponseResponse }
    | { mode: "duplicar"; initialData: { title: string; body: string; categoryId?: number | null } }
    | null
  >(null);
  const [previewItem, setPreviewItem] = useState<CannedResponseResponse | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const [pendingNewCategory, setPendingNewCategory] = useState(false);

  const debouncedSearch = useDebouncedValue(search).trim();

  const { data, error, setPage, refresh } = usePagedList({
    queryKey: ["canned"],
    fetch: cannedApi.list,
    criteria: {
      pageSize,
      search: debouncedSearch || undefined,
      categoryId: selectedCategory === "all" ? undefined : Number(selectedCategory),
      sort: "updated",
    },
    fallbackError: "No se pudieron cargar las plantillas de correo.",
  });

  // Misma clave que el estudio de plantillas: comparten la lectura de categorías.
  const categoriesQuery = useQuery({
    queryKey: ["canned-categories", "all"],
    queryFn: () => cannedCategoriesApi.listAll(),
  });
  // Si falla, el filtro queda sin categorías, como antes.
  const categories: CategoriaResponseItem[] | null = categoriesQuery.isError
    ? NO_CATEGORIES
    : (categoriesQuery.data ?? null);
  const { refetch: refetchCategories } = categoriesQuery;

  useLoadErrorReceipt(error, "plantillas-list", refresh);

  function reloadAll() {
    refresh();
    void refetchCategories();
  }

  const items = data?.items ?? null;

  const parsedItems = useMemo(() => {
    return (items ?? []).map((item) => {
      const parsed = parseCanned(item.title, item.body, item.categoryName);
      return { ...item, parsed };
    });
  }, [items]);

  const rows = parsedItems;

  const categoryOptions: FilterOption[] = useMemo(() => {
    const options: FilterOption[] = [
      { value: "all", label: "Todas las categorías", hint: data ? `${data.total}` : undefined },
    ];
    for (const cat of categories ?? []) {
      options.push({
        value: String(cat.id),
        label: cat.name,
        hint: cat.responseCount > 0 ? `${cat.responseCount}` : undefined,
      });
    }
    return options;
  }, [categories, data?.total]);

  // Selección múltiple para respuestas
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

  function canManage(item: CannedResponseResponse) {
    if (!canMailSend) return false;
    return Boolean(user?.isAdmin) || item.createdByStaffId === user?.staffId;
  }

  function handleDuplicate(item: CannedResponseResponse) {
    const { cleanTitle } = parseCanned(item.title, item.body, item.categoryName);
    setStudioState({
      mode: "duplicar",
      initialData: {
        title: `${cleanTitle} (Copia)`,
        body: item.body,
        categoryId: item.categoryId,
      },
    });
  }

  function askDelete(item: CannedResponseResponse) {
    const { cleanTitle } = parseCanned(item.title, item.body, item.categoryName);
    setConfirmation({
      tone: "danger",
      icon: Trash2,
      eyebrow: "Correo · Plantillas",
      title: "Eliminar plantilla",
      description: (
        <>
          Se eliminará <strong className="font-semibold text-ink">{cleanTitle}</strong>. Los correos ya
          enviados con ella no cambian.
        </>
      ),
      confirmLabel: "Eliminar",
      onConfirm: async () => {
        setBusyId(item.id);
        try {
          await cannedApi.remove(item.id);
          if (previewItem?.id === item.id) {
            setPreviewItem(null);
          }
          setSelectedIds((prev) => prev.filter((id) => id !== item.id));
          reloadAll();
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
      eyebrow: "Correo · Plantillas en lote",
      title: `Eliminar ${count} ${count === 1 ? "plantilla" : "plantillas"}`,
      description: (
        <>
          Se eliminarán <strong className="font-semibold text-ink">{count} plantillas</strong> seleccionadas.
          Esta acción no se puede deshacer.
        </>
      ),
      confirmLabel: "Eliminar seleccionadas",
      onConfirm: async () => {
        try {
          await cannedApi.bulkDelete(selectedIds);
          setSelectedIds([]);
          reloadAll();
        } catch {
          // Fallback individual si falla en lote
          for (const id of selectedIds) {
            try {
              await cannedApi.remove(id);
            } catch {}
          }
          setSelectedIds([]);
          reloadAll();
        }
      },
    });
  }

  const hasActiveFilters = Boolean(search || selectedCategory !== "all");

  return (
    <div className="flex h-full flex-col">
      <ModuleHeader
        title="Plantillas de correo"
        summary={
          <span key={activeTab} className="animate-plf-header-fade">
            {activeTab === "plantillas"
              ? data
                ? `${data.total} ${data.total === 1 ? "plantilla" : "plantillas"} · se insertan desde la bandeja con «Insertar plantilla»`
                : "Cargando plantillas…"
              : categories
                ? `${categories.length} ${categories.length === 1 ? "categoría registrada" : "categorías registradas"}`
                : "Cargando categorías…"}
          </span>
        }
        sections={[
          {
            label: (
              <span className="flex items-center gap-1.5">
                <MessageSquareText className="h-3.5 w-3.5" />
                <span>Plantillas</span>
                {data !== null && (
                  <span className={SEGMENTED_TAB_COUNT_BADGE_CLASS}>{data.total}</span>
                )}
              </span>
            ),
            active: activeTab === "plantillas",
            onClick: () => setActiveTab("plantillas"),
          },
          {
            label: (
              <span className="flex items-center gap-1.5">
                <Tag className="h-3.5 w-3.5" />
                <span>Categorías</span>
                {categories !== null && (
                  <span className={SEGMENTED_TAB_COUNT_BADGE_CLASS}>{categories.length}</span>
                )}
              </span>
            ),
            active: activeTab === "categorias",
            onClick: () => setActiveTab("categorias"),
          },
        ]}
        action={
          canMailSend ? (
            <div key={activeTab} className="animate-plf-header-fade">
              {activeTab === "plantillas" ? (
                <Button size="sm" onClick={() => setStudioState({ mode: "nueva" })}>
                  <Plus className="h-[15px] w-[15px]" />
                  Nueva plantilla
                </Button>
              ) : (
                <Button size="sm" onClick={() => setPendingNewCategory(true)}>
                  <Plus className="h-[15px] w-[15px]" />
                  Nueva categoría
                </Button>
              )}
            </div>
          ) : undefined
        }
      />

      <div className="min-h-0 flex-1 overflow-y-auto pb-8">
        <div key={activeTab} className="animate-plf-apple-tab">
          {activeTab === "categorias" ? (
            <CategoriasTab
              onCategoriesChanged={reloadAll}
              pendingNew={pendingNewCategory}
              onPendingNewConsumed={() => setPendingNewCategory(false)}
            />
          ) : (
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
                    placeholder="Buscar por título, texto o categoría…"
                    className="w-[280px]"
                  />

                  <FilterDropdown
                    value={selectedCategory}
                    onChange={setSelectedCategory}
                    options={categoryOptions}
                    defaultIcon={<Tag className="h-3.5 w-3.5 text-zinc-500" />}
                    aria-label="Filtrar por categoría"
                  />

                  {hasActiveFilters && (
                    <ClearFiltersButton
                      onClick={() => {
                        setSearch("");
                        setSelectedCategory("all");
                      }}
                      title="Limpiar filtros"
                    />
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => setHelpOpen(true)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-[12px] font-medium text-zinc-700 shadow-2xs hover:border-zinc-300 hover:bg-zinc-50 hover:text-zinc-900 transition-all cursor-pointer active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-brand-red/25"
                >
                  <HelpCircle className="h-3.5 w-3.5 text-brand-red" />
                  <span>¿Para qué sirve?</span>
                </button>
              </div>
            }
            footer={
              data !== null && data.total > 0 ? (
                <Pagination
                  page={data.page}
                  pageSize={data.pageSize}
                  total={data.total}
                  totalPages={data.totalPages}
                  onPageChange={setPage}
                  onPageSizeChange={setPageSize}
                  noun="plantillas"
                />
              ) : undefined
            }
          >
            {items === null ? (
              error === null && <TableSkeleton rows={pageSize} columns={canMailSend ? 10 : 9} />
            ) : rows.length === 0 ? (
              <ListEmptyState
                icon={MessageSquareText}
                isFiltered={hasActiveFilters}
                filteredTitle="Ninguna plantilla coincide con los filtros aplicados."
                onClearFilters={() => {
                  setSearch("");
                  setSelectedCategory("all");
                }}
                emptyTitle="Todavía no hay plantillas de correo."
                emptyDescription="Crea la primera con «Nueva plantilla» y úsala al redactar desde la bandeja con «Insertar plantilla»."
              />
            ) : (
              <div className="plf-results-in">
                <DataTable fixed>
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
                                  : "Seleccionar todas las plantillas de esta página"
                              }
                              onToggle={toggleAllOnPage}
                            />
                          </div>
                        </Th>
                      )}
                      <Th className="w-[11%]">Categoría</Th>
                      <Th className="w-[14%]">Título</Th>
                      <Th className="w-[13%]">Asunto sugerido</Th>
                      <Th>Vista previa</Th>
                      <Th className="w-16 text-center">Usos</Th>
                      <Th className="w-[10%]">Último uso</Th>
                      <Th className="w-[10%]">Creada por</Th>
                      <Th className="w-[11%]">Creado</Th>
                      {canMailSend && <Th className="w-[4.5rem] text-right">Acciones</Th>}
                    </HeadRow>
                  </thead>
                  <tbody>
                    {rows.map((item) => {
                      const { category, cleanTitle, cleanBody, suggestedSubject } = item.parsed;
                      const matchedCat = categories?.find((c) => c.name.toLowerCase() === category.toLowerCase());
                      const badge = getCategoryBadgeClasses(category, matchedCat?.color);
                      const checked = selectedIds.includes(item.id);
                      const manageable = canManage(item);

                      return (
                        <Row
                          key={item.id}
                          busy={busyId === item.id}
                          className="cursor-pointer group hover:bg-zinc-50/70 transition-colors"
                          onClick={() => setPreviewItem(item)}
                        >
                          {/* Checkbox */}
                          {canMailSend && (
                            <Td className="w-10 px-2 text-center" onClick={(e) => e.stopPropagation()}>
                              <div className="flex items-center justify-center">
                                <SelectBox
                                  checked={checked}
                                  label={`Seleccionar ${cleanTitle}`}
                                  onToggle={() => toggleSelection(item.id)}
                                />
                              </div>
                            </Td>
                          )}

                          <Td className="overflow-hidden">
                            <span
                              className={`inline-flex max-w-full items-center gap-1.5 rounded-md border px-2 py-0.5 text-[11px] font-semibold ${badge.badge}`}
                            >
                              <span className={`size-1.5 shrink-0 rounded-full ${badge.dot}`} />
                              <span className="truncate">{category}</span>
                            </span>
                          </Td>

                          <Td className="overflow-hidden text-[13px] font-semibold text-ink">
                            <span className="block truncate" title={cleanTitle}>
                              {cleanTitle}
                            </span>
                          </Td>

                          <Td className="overflow-hidden text-[12px] text-subtle">
                            {suggestedSubject ? (
                              <span className="block truncate font-medium text-zinc-700" title={suggestedSubject}>
                                {suggestedSubject}
                              </span>
                            ) : (
                              <span className="text-zinc-400">—</span>
                            )}
                          </Td>

                          <Td
                            className="overflow-hidden truncate text-[12.5px] text-subtle"
                            title={templateToReadablePlain(cleanBody)}
                          >
                            {templateToReadablePlain(cleanBody)}
                          </Td>

                          <Td className="text-center whitespace-nowrap">
                            <span className="font-heading text-[11.5px] font-bold tabular-nums text-zinc-700">
                              {item.usageCount}
                            </span>
                          </Td>

                          <Td className="overflow-hidden whitespace-nowrap text-[12px] text-subtle">
                            {item.lastUsedAt ? (
                              <span className="block truncate" title={formatDateTime(item.lastUsedAt)}>
                                {formatDateTime(item.lastUsedAt)}
                              </span>
                            ) : (
                              "—"
                            )}
                          </Td>

                          <Td className="overflow-hidden text-[12px] text-subtle">
                            <span className="block truncate" title={item.createdByName}>
                              {item.createdByName}
                            </span>
                          </Td>

                          <Td className="overflow-hidden whitespace-nowrap text-[12px] text-subtle">
                            <span className="block truncate" title={formatDateTime(item.createdAt)}>
                              {formatDateTime(item.createdAt)}
                            </span>
                          </Td>

                          {canMailSend && (
                            <Td onClick={(e) => e.stopPropagation()}>
                              {manageable ? (
                                <div className="flex items-center justify-end gap-1">
                                  <RowAction
                                    label={`Editar ${cleanTitle}`}
                                    icon={Pencil}
                                    onClick={() => setStudioState({ mode: "editar", item })}
                                    disabled={busyId === item.id}
                                  />
                                  <RowAction
                                    label={`Eliminar ${cleanTitle}`}
                                    icon={Trash2}
                                    onClick={() => askDelete(item)}
                                    disabled={busyId === item.id}
                                    danger
                                  />
                                </div>
                              ) : null}
                            </Td>
                          )}
                        </Row>
                      );
                    })}
                  </tbody>
                </DataTable>
              </div>
            )}
            </ListPanel>
          )}
        </div>
      </div>

      {confirmation && <ConfirmDialog {...confirmation} onClose={() => setConfirmation(null)} />}

      {/* Drawer de Previsualización Rápida */}
      {previewItem && (
        <CannedPreviewDrawer
          item={previewItem}
          canManage={canManage(previewItem)}
          onClose={() => setPreviewItem(null)}
          onEdit={() => {
            const it = previewItem;
            setPreviewItem(null);
            setStudioState({ mode: "editar", item: it });
          }}
          onDuplicate={() => {
            const it = previewItem;
            setPreviewItem(null);
            handleDuplicate(it);
          }}
          onDelete={() => {
            const it = previewItem;
            setPreviewItem(null);
            askDelete(it);
          }}
        />
      )}

      {/* Estudio de Creación / Edición / Duplicado */}
      {studioState !== null && (
        <CannedResponseStudio
          item={studioState.mode === "editar" ? studioState.item : undefined}
          initialData={studioState.mode === "duplicar" ? studioState.initialData : undefined}
          onClose={() => setStudioState(null)}
          onSaved={() => {
            reloadAll();
            setStudioState(null);
          }}
        />
      )}

      {/* Hoja de Ayuda */}
      {helpOpen && (
        <RespuestasHelpSheet
          onClose={() => setHelpOpen(false)}
          onNewResponse={() => {
            setHelpOpen(false);
            setStudioState({ mode: "nueva" });
          }}
        />
      )}
    </div>
  );
}
