import {
  Check,
  Copy,
  CopyPlus,
  Eye,
  HelpCircle,
  MessageSquareText,
  Pencil,
  Plus,
  Tag,
  Trash2,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { cannedApi, cannedCategoriesApi } from "../../api/canned";
import { ApiError } from "../../api/client";
import { ModuleHeader } from "../../components/app/ModuleHeader";
import { useLoadErrorReceipt } from "../../hooks/useNoticeReceipts";
import { Button } from "../../components/ui/Button";
import { ConfirmDialog, type ConfirmDialogProps } from "../../components/ui/ConfirmDialog";
import { DataTable, HeadRow, Row, Td, Th } from "../../components/ui/DataTable";
import { ClearFiltersButton, FilterDropdown, type FilterOption } from "../../components/ui/FilterDropdown";
import { ListPanel } from "../../components/ui/ListPanel";
import { RowAction } from "../../components/ui/RowAction";
import { SearchInput } from "../../components/ui/SearchInput";
import { SelectBox } from "../../components/ui/SelectBox";
import { TableSkeleton } from "../../components/ui/Skeleton";
import { useAuth } from "../../context/useAuth";
import { usePermissions } from "../../hooks/usePermissions";
import { formatDateTime } from "../../lib/format";
import type { CannedResponseResponse, CategoriaResponseItem } from "../../types/api";
import { getCategoryBadgeClasses, parseCanned } from "./cannedHelpers";
import { CannedPreviewDrawer } from "./CannedPreviewDrawer";
import { CannedResponseStudio } from "./CannedResponseStudio";
import { CategoriasTab } from "./CategoriasTab";
import { RespuestasHelpSheet } from "./RespuestasHelpSheet";

/** Respuestas predefinidas y categorías de plantilla con selección múltiple y gestión en lote. */
export function RespuestasPage() {
  const { user } = useAuth();
  const { can } = usePermissions();
  const canMailSend = can("mail.send");

  const [activeTab, setActiveTab] = useState<"respuestas" | "categorias">("respuestas");

  // Estado de respuestas
  const [items, setItems] = useState<CannedResponseResponse[] | null>(null);
  const [categories, setCategories] = useState<CategoriaResponseItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [busyId, setBusyId] = useState<number | null>(null);
  const [copiedId, setCopiedId] = useState<number | null>(null);
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

  function load() {
    cannedApi
      .list()
      .then(setItems)
      .catch((err) => setError(err instanceof ApiError ? err.message : "No se pudieron cargar las respuestas"));

    cannedCategoriesApi
      .list()
      .then(setCategories)
      .catch(() => setCategories([]));
  }

  useEffect(load, []);

  useLoadErrorReceipt(error, "respuestas-list", load);

  // Parsear items con su categoría, cleanTitle, cleanBody y suggestedSubject
  const parsedItems = useMemo(() => {
    return (items ?? []).map((item) => {
      const parsed = parseCanned(item.title, item.body, item.categoryName);
      return {
        ...item,
        parsed,
      };
    });
  }, [items]);

  // Lista única de categorías encontradas para el filtro
  const categoryOptions: FilterOption[] = useMemo(() => {
    const options: FilterOption[] = [
      { value: "all", label: "Todas las categorías", hint: `${items?.length ?? 0}` },
    ];

    for (const cat of categories ?? []) {
      const count = parsedItems.filter(
        (i) =>
          i.categoryId === cat.id ||
          i.parsed.category.toLowerCase() === cat.name.toLowerCase(),
      ).length;
      options.push({
        value: cat.name,
        label: cat.name,
        hint: count > 0 ? `${count}` : undefined,
      });
    }

    return options;
  }, [categories, parsedItems, items?.length]);

  const term = search.trim().toLowerCase();
  const rows = useMemo(() => {
    return parsedItems.filter((item) => {
      // Filtro de categoría
      if (selectedCategory !== "all") {
        if (item.parsed.category.toLowerCase() !== selectedCategory.toLowerCase()) {
          return false;
        }
      }
      // Filtro de búsqueda
      if (!term) return true;
      return (
        item.parsed.cleanTitle.toLowerCase().includes(term) ||
        item.parsed.cleanBody.toLowerCase().includes(term) ||
        item.parsed.category.toLowerCase().includes(term) ||
        item.createdByName.toLowerCase().includes(term) ||
        (item.parsed.suggestedSubject && item.parsed.suggestedSubject.toLowerCase().includes(term))
      );
    });
  }, [parsedItems, selectedCategory, term]);

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

  async function handleCopyText(item: CannedResponseResponse, cleanBody: string) {
    try {
      await navigator.clipboard.writeText(cleanBody);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = cleanBody;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
    setCopiedId(item.id);
    setTimeout(() => {
      setCopiedId((curr) => (curr === item.id ? null : curr));
    }, 2000);
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
      eyebrow: "Correo · Respuestas",
      title: "Eliminar respuesta",
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
      eyebrow: "Correo · Respuestas en lote",
      title: `Eliminar ${count} ${count === 1 ? "respuesta" : "respuestas"}`,
      description: (
        <>
          Se eliminarán <strong className="font-semibold text-ink">{count} respuestas</strong> seleccionadas.
          Esta acción no se puede deshacer.
        </>
      ),
      confirmLabel: "Eliminar seleccionadas",
      onConfirm: async () => {
        try {
          await cannedApi.bulkDelete(selectedIds);
          setSelectedIds([]);
          load();
        } catch {
          // Fallback individual si falla en lote
          for (const id of selectedIds) {
            try {
              await cannedApi.remove(id);
            } catch {}
          }
          setSelectedIds([]);
          load();
        }
      },
    });
  }

  const hasActiveFilters = Boolean(search || selectedCategory !== "all");

  return (
    <div className="flex h-full flex-col">
      <ModuleHeader
        title="Respuestas"
        summary={
          <span key={activeTab} className="animate-plf-header-fade">
            {activeTab === "respuestas"
              ? items
                ? `${items.length} ${items.length === 1 ? "respuesta predefinida" : "respuestas predefinidas"} · se insertan desde el editor con "Respuestas rápidas"`
                : "Cargando respuestas…"
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
                <span>Respuestas</span>
                {items !== null && (
                  <span className="ml-1 rounded-full bg-zinc-100 px-1.5 py-0.2 text-[10.5px] font-semibold text-zinc-600">
                    {items.length}
                  </span>
                )}
              </span>
            ),
            active: activeTab === "respuestas",
            onClick: () => setActiveTab("respuestas"),
          },
          {
            label: (
              <span className="flex items-center gap-1.5">
                <Tag className="h-3.5 w-3.5" />
                <span>Categorías</span>
                {categories !== null && (
                  <span className="ml-1 rounded-full bg-zinc-100 px-1.5 py-0.2 text-[10.5px] font-semibold text-zinc-600">
                    {categories.length}
                  </span>
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
              {activeTab === "respuestas" ? (
                <Button size="sm" onClick={() => setStudioState({ mode: "nueva" })}>
                  <Plus className="h-[15px] w-[15px]" />
                  Nueva respuesta
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
              onCategoriesChanged={load}
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
          >
            {items === null ? (
              <TableSkeleton rows={8} columns={canMailSend ? 8 : 7} />
            ) : (
              <>
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
                                  : "Seleccionar todas las respuestas de esta página"
                              }
                              onToggle={toggleAllOnPage}
                            />
                          </div>
                        </Th>
                      )}
                      <Th className="w-36">Categoría</Th>
                      <Th>Título de la plantilla</Th>
                      <Th className="w-52">Asunto sugerido</Th>
                      <Th>Texto</Th>
                      <Th className="w-36">Creada por</Th>
                      <Th className="w-36">Actualizada</Th>
                      <Th className="w-32 text-right">Acciones</Th>
                    </HeadRow>
                  </thead>
                  <tbody>
                    {rows.map((item) => {
                      const { category, cleanTitle, cleanBody, suggestedSubject } = item.parsed;
                      const matchedCat = categories?.find((c) => c.name.toLowerCase() === category.toLowerCase());
                      const badge = getCategoryBadgeClasses(category, matchedCat?.color);
                      const isCopied = copiedId === item.id;
                      const checked = selectedIds.includes(item.id);

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

                          {/* Categoría */}
                          <Td className="whitespace-nowrap">
                            <span
                              className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[11px] font-semibold ${badge.badge}`}
                            >
                              <span className={`size-1.5 rounded-full ${badge.dot}`} />
                              <span className="truncate max-w-[110px]">{category}</span>
                            </span>
                          </Td>

                          {/* Título */}
                          <Td className="text-[13px] font-semibold text-ink">
                            <div className="flex items-center gap-1.5">
                              <span className="truncate max-w-[280px]" title={cleanTitle}>
                                {cleanTitle}
                              </span>
                            </div>
                          </Td>

                          {/* Asunto sugerido */}
                          <Td className="whitespace-nowrap text-[12px] text-subtle">
                            {suggestedSubject ? (
                              <span className="truncate max-w-[190px] block font-medium text-zinc-700" title={suggestedSubject}>
                                {suggestedSubject}
                              </span>
                            ) : (
                              <span className="text-zinc-400 font-mono text-[11px]">—</span>
                            )}
                          </Td>

                          {/* Texto de la respuesta */}
                          <Td className="max-w-[320px] truncate text-[12.5px] text-subtle" title={cleanBody}>
                            {cleanBody}
                          </Td>

                          {/* Creada por */}
                          <Td className="whitespace-nowrap text-[12px] text-subtle">{item.createdByName}</Td>

                          {/* Actualizada */}
                          <Td className="whitespace-nowrap text-[12px] text-subtle">{formatDateTime(item.updatedAt)}</Td>

                          {/* Acciones */}
                          <Td onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-end gap-1">
                              {/* Ver detalle / previsualización */}
                              <RowAction
                                label={`Vista previa de ${cleanTitle}`}
                                icon={Eye}
                                onClick={() => setPreviewItem(item)}
                              />

                              {/* Copiar texto */}
                              <RowAction
                                label={isCopied ? "¡Copiado al portapapeles!" : `Copiar texto de ${cleanTitle}`}
                                icon={isCopied ? Check : Copy}
                                onClick={() => handleCopyText(item, cleanBody)}
                                className={isCopied ? "!text-emerald-600 bg-emerald-50" : ""}
                              />

                              {/* Duplicar plantilla */}
                              {canMailSend && (
                                <RowAction
                                  label={`Duplicar ${cleanTitle}`}
                                  icon={CopyPlus}
                                  onClick={() => handleDuplicate(item)}
                                />
                              )}

                              {/* Editar */}
                              {canManage(item) && (
                                <RowAction
                                  label={`Editar ${cleanTitle}`}
                                  icon={Pencil}
                                  onClick={() => setStudioState({ mode: "editar", item })}
                                  disabled={busyId === item.id}
                                />
                              )}

                              {/* Eliminar */}
                              {canManage(item) && (
                                <RowAction
                                  label={`Eliminar ${cleanTitle}`}
                                  icon={Trash2}
                                  onClick={() => askDelete(item)}
                                  disabled={busyId === item.id}
                                  danger
                                />
                              )}
                            </div>
                          </Td>
                        </Row>
                      );
                    })}
                  </tbody>
                </DataTable>

                {rows.length === 0 && (
                  <div className="flex flex-col items-center gap-2 py-14 text-center">
                    <MessageSquareText className="h-6 w-6 text-faint" />
                    <p className="text-[13.5px] text-faint">
                      {hasActiveFilters
                        ? "Ninguna respuesta coincide con los filtros aplicados."
                        : "Todavía no hay respuestas guardadas."}
                    </p>
                    {hasActiveFilters && (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => {
                          setSearch("");
                          setSelectedCategory("all");
                        }}
                        className="mt-2 text-[12px]"
                      >
                        Restablecer filtros
                      </Button>
                    )}
                  </div>
                )}
              </>
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
            load();
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
