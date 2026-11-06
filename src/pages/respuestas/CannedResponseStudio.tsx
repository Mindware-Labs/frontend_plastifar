import {
  Bookmark,
  Eye,
  Mail,
  Maximize2,
  Minimize2,
  PenLine,
  Plus,
  Send,
  Sparkles,
  Tag,
  X,
} from "lucide-react";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { cannedApi, cannedCategoriesApi } from "../../api/canned";
import { ApiError } from "../../api/client";
import { Alert } from "../../components/ui/Alert";
import { dialogHeaderShellClass, dialogHeaderStackClass } from "../../components/ui/dialogHeaderStyles";
import { Button } from "../../components/ui/Button";
import { SegmentedTabs } from "../../components/ui/SegmentedTabs";
import { useAuth } from "../../context/useAuth";
import { useReceipts } from "../../context/useReceipts";
import { useDialogMotion } from "../../hooks/useDialogMotion";
import {
  applyCannedVariables,
  buildCannedVariableContext,
  CANNED_BODY_PLACEHOLDER,
  templateToReadablePlain,
} from "../../lib/cannedVariables";
import { formatDateTime } from "../../lib/format";
import type { CannedResponseResponse, CategoriaResponseItem } from "../../types/api";
import {
  formatCannedBody,
  formatCannedTitle,
  getCategoryBadgeClasses,
  parseCanned,
} from "./cannedHelpers";
import { CategoriaModal } from "./CategoriaModal";
import {
  CannedTemplateBodyEditor,
  type CannedTemplateBodyEditorHandle,
} from "./CannedTemplateBodyEditor";
import { CannedTemplateInline } from "./CannedTemplateInline";
import { CannedVariableChips } from "./CannedVariableChips";

interface CannedResponseStudioProps {
  /** Presente = edición; ausente = nueva respuesta rápida. */
  item?: CannedResponseResponse;
  /** Datos iniciales (por ejemplo, para duplicar una plantilla existente). */
  initialData?: {
    title: string;
    body: string;
    categoryId?: number | null;
  };
  onClose: () => void;
  onSaved: () => void;
}

export function CannedResponseStudio({ item, initialData, onClose, onSaved }: CannedResponseStudioProps) {
  const isEdit = item !== undefined;
  const receipts = useReceipts();
  const { user } = useAuth();
  const { isExiting, requestClose, scrimRef, panelRef } = useDialogMotion(onClose, { variant: "drawer" });

  const rawInit = useMemo(() => {
    const rawTitle = item?.title ?? initialData?.title ?? "";
    const rawBody = item?.body ?? initialData?.body ?? "";
    return parseCanned(rawTitle, rawBody, item?.categoryName);
  }, [item, initialData]);

  const [dbCategories, setDbCategories] = useState<CategoriaResponseItem[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(
    item?.categoryId ?? initialData?.categoryId ?? null,
  );
  const [categoryName, setCategoryName] = useState(rawInit.category || "General");
  const [title, setTitle] = useState(rawInit.cleanTitle);
  const [suggestedSubject, setSuggestedSubject] = useState(rawInit.suggestedSubject ?? "");
  const [body, setBody] = useState(rawInit.cleanBody);
  const [activeTab, setActiveTab] = useState<"compose" | "preview">("compose");
  const [previewMode, setPreviewMode] = useState<"simulated" | "tokens">("simulated");
  const [isMaximized, setIsMaximized] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [createCategoryModalOpen, setCreateCategoryModalOpen] = useState(false);

  const titleId = useId();
  const bodyEditorRef = useRef<CannedTemplateBodyEditorHandle>(null);
  const titleRef = useRef<HTMLInputElement>(null);

  const sampleContext = useMemo(
    () =>
      buildCannedVariableContext({
        user,
        contactEmail: "cliente@empresa.com",
        ticketId: 1042,
      }),
    [user],
  );

  // Cargar categorías del catálogo de base de datos
  function loadCategories() {
    cannedCategoriesApi
      .listAll()
      .then((data) => {
        setDbCategories(data);
        if (selectedCategoryId) {
          const match = data.find((c) => c.id === selectedCategoryId);
          if (match) setCategoryName(match.name);
        } else if (rawInit.category && rawInit.category !== "General") {
          const match = data.find((c) => c.name.toLowerCase() === rawInit.category.toLowerCase());
          if (match) {
            setSelectedCategoryId(match.id);
            setCategoryName(match.name);
          }
        }
      })
      .catch(() => {});
  }

  useEffect(loadCategories, []);

  // Estilo del distintivo
  const currentCategoryColor = useMemo(() => {
    return dbCategories.find((c) => c.id === selectedCategoryId)?.color;
  }, [dbCategories, selectedCategoryId]);

  const badgeStyle = getCategoryBadgeClasses(categoryName, currentCategoryColor);

  // Métricas del cuerpo sobre texto legible (sin contar llaves internas)
  const stats = useMemo(() => {
    const readable = templateToReadablePlain(body);
    const trimmed = readable.trim();
    const words = trimmed ? trimmed.split(/\s+/).length : 0;
    const chars = readable.length;
    return { words, chars };
  }, [body]);

  const handleSave = useCallback(async () => {
    const cleanTitle = title.trim();
    const cleanBody = body.trim();
    const cleanSubject = suggestedSubject.trim();

    if (!cleanTitle) {
      setFormError("Ingresa un nombre o título para identificar la respuesta.");
      titleRef.current?.focus();
      return;
    }
    if (cleanTitle.length > 100) {
      setFormError("El título no puede exceder 100 caracteres.");
      return;
    }
    if (!cleanBody) {
      setFormError("Escribe el cuerpo del correo de la plantilla.");
      bodyEditorRef.current?.focus();
      return;
    }
    if (cleanBody.length > 20000) {
      setFormError("El texto es demasiado largo.");
      return;
    }

    const finalTitle = formatCannedTitle(cleanTitle, categoryName);
    const finalBody = formatCannedBody(cleanBody, cleanSubject);

    if (finalTitle.length > 120) {
      setFormError("El nombre combinado con la categoría supera los 120 caracteres.");
      return;
    }

    setFormError(null);
    setIsSubmitting(true);
    try {
      if (isEdit) {
        await cannedApi.update(item.id, finalTitle, finalBody, selectedCategoryId);
      } else {
        await cannedApi.create(finalTitle, finalBody, selectedCategoryId);
      }
      receipts.done({
        action: isEdit ? "editar-plantilla" : "crear-plantilla",
        title: isEdit ? "Plantilla actualizada" : "Plantilla creada exitosamente",
        detail: finalTitle,
      });
      onSaved();
      requestClose();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "No se pudo guardar la respuesta");
    } finally {
      setIsSubmitting(false);
    }
  }, [title, body, suggestedSubject, categoryName, selectedCategoryId, isEdit, item, onSaved, requestClose, receipts]);

  // Cerrar con Escape y atajo para guardar
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && !isExiting && !createCategoryModalOpen) {
        requestClose();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter" && !createCategoryModalOpen) {
        e.preventDefault();
        handleSave();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isExiting, requestClose, handleSave, createCategoryModalOpen]);

  return createPortal(
    <div
      ref={scrimRef}
      inert={isExiting ? true : undefined}
      className={`fixed inset-0 z-50 flex justify-end bg-ink/45 backdrop-blur-[2px] transition-opacity ${
        isExiting ? "pointer-events-none" : ""
      }`}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !isExiting && !createCategoryModalOpen) requestClose();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={`relative flex h-full flex-col bg-white shadow-[0_4px_32px_rgba(27,27,29,0.22)] transition-all duration-200 ease-out ${
          isMaximized ? "w-full" : "w-full sm:w-[680px] md:w-[740px] lg:w-[820px]"
        } ${isExiting ? "pointer-events-none" : ""}`}
      >
        {/* Cabecera del Drawer */}
        <div className={dialogHeaderShellClass}>
          <div className={dialogHeaderStackClass}>
            <p className="font-heading text-[10px] font-bold uppercase tracking-[0.1em] text-zinc-400">
              Correo · Plantillas
            </p>
            <h2 id={titleId} className="font-heading text-[17px] font-bold tracking-[-0.01em] text-ink">
              {isEdit ? "Editar plantilla" : "Nueva plantilla"}
            </h2>
          </div>

          <div className="flex items-center gap-2">
            {/* Control segmentado para alternar Redacción / Vista previa */}
            <SegmentedTabs
              ariaLabel="Modo de trabajo"
              activeKey={activeTab}
              items={[
                {
                  key: "compose",
                  label: (
                    <>
                      <PenLine className="h-3.5 w-3.5" />
                      <span>Redacción</span>
                    </>
                  ),
                  onClick: () => setActiveTab("compose"),
                },
                {
                  key: "preview",
                  label: (
                    <>
                      <Eye className="h-3.5 w-3.5" />
                      <span>Vista previa</span>
                    </>
                  ),
                  onClick: () => setActiveTab("preview"),
                },
              ]}
            />

            <span aria-hidden className="mx-0.5 h-4 w-px bg-zinc-200" />

            {/* Maximizar / Normal */}
            <button
              type="button"
              onClick={() => setIsMaximized((prev) => !prev)}
              aria-label={isMaximized ? "Restaurar tamaño normal" : "Maximizar a pantalla completa"}
              title={isMaximized ? "Restaurar ancho" : "Pantalla completa"}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-subtle outline-none transition-colors hover:bg-fill hover:text-ink focus-visible:ring-2 focus-visible:ring-brand-red/25"
            >
              {isMaximized ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
            </button>

            {/* Cerrar */}
            <button
              type="button"
              onClick={requestClose}
              aria-label="Cerrar estudio"
              title="Cerrar (Esc)"
              className="-mr-1.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-subtle outline-none transition-colors hover:bg-fill hover:text-ink focus-visible:ring-2 focus-visible:ring-brand-red/25"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Cuerpo del Sheet */}
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
          {formError && (
            <div className="px-6 pt-3.5">
              <Alert variant="error">{formError}</Alert>
            </div>
          )}

          {activeTab === "compose" ? (
            <div className="flex flex-1 flex-col">
              {/* 1. Nombre de la plantilla */}
              <div className="border-b border-line px-6 py-3.5">
                <div className="flex items-center justify-between">
                  <label
                    htmlFor="canned-title"
                    className="flex items-center gap-2 font-heading text-[10.5px] font-bold uppercase tracking-[0.08em] text-ink"
                  >
                    <span
                      aria-hidden
                      className="flex size-5 shrink-0 items-center justify-center rounded-md bg-brand-red/10 text-brand-red"
                    >
                      <PenLine className="size-3" strokeWidth={2.25} />
                    </span>
                    <span>
                      Nombre de la plantilla <span className="text-brand-red">*</span>
                    </span>
                  </label>
                  <span className="font-heading text-[10.5px] font-bold tabular-nums text-zinc-400">
                    {title.length}/100
                  </span>
                </div>
                <input
                  id="canned-title"
                  ref={titleRef}
                  value={title}
                  maxLength={100}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Ej. Confirmación de entrega, Datos de cuenta bancaria..."
                  className="mt-2 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-[13px] font-medium text-ink shadow-2xs outline-none transition-colors placeholder:font-normal placeholder:text-zinc-400 hover:border-zinc-300 focus:border-zinc-300 focus:ring-2 focus:ring-brand-red/25"
                  autoFocus={!rawInit.cleanTitle}
                />
              </div>

              {/* 2. Categoría temática */}
              <div className="border-b border-line px-6 py-3.5">
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 font-heading text-[10.5px] font-bold uppercase tracking-[0.08em] text-ink">
                    <span
                      aria-hidden
                      className="flex size-5 shrink-0 items-center justify-center rounded-md bg-brand-red/10 text-brand-red"
                    >
                      <Tag className="size-3" strokeWidth={2.25} />
                    </span>
                    <span>Categoría temática</span>
                  </label>

                  <button
                    type="button"
                    onClick={() => setCreateCategoryModalOpen(true)}
                    className="inline-flex items-center gap-1 text-[11px] font-medium text-brand-red hover:underline cursor-pointer"
                  >
                    <Plus className="h-3 w-3" />
                    <span>Nueva categoría</span>
                  </button>
                </div>

                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedCategoryId(null);
                      setCategoryName("General");
                    }}
                    className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[12px] font-medium transition-all cursor-pointer ${
                      selectedCategoryId === null && categoryName === "General"
                        ? "border-zinc-300 bg-zinc-100 text-zinc-800 ring-1.5 ring-brand-red/30 shadow-2xs font-semibold"
                        : "border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300 hover:bg-zinc-50"
                    }`}
                  >
                    <span className="size-1.5 rounded-full bg-zinc-400" />
                    General
                  </button>

                  {dbCategories.map((cat) => {
                    const isSelected =
                      selectedCategoryId === cat.id || categoryName.toLowerCase() === cat.name.toLowerCase();
                    const style = getCategoryBadgeClasses(cat.name, cat.color);
                    return (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => {
                          setSelectedCategoryId(cat.id);
                          setCategoryName(cat.name);
                        }}
                        className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[12px] font-medium transition-all cursor-pointer ${
                          isSelected
                            ? `${style.badge} ring-1.5 ring-brand-red/30 shadow-2xs font-semibold`
                            : "border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300 hover:bg-zinc-50"
                        }`}
                      >
                        <span className={`size-1.5 rounded-full ${style.dot}`} />
                        {cat.name}
                      </button>
                    );
                  })}
                </div>

                {dbCategories.length === 0 && (
                  <p className="mt-2 text-[11.5px] leading-relaxed text-zinc-500">
                    Todavía no hay categorías en el catálogo. Usa «Nueva categoría» o créalas en la pestaña
                    Categorías.
                  </p>
                )}
              </div>

              {/* 3. Asunto sugerido (opcional) */}
              <div className="border-b border-line px-6 py-3.5">
                <div className="flex items-center justify-between">
                  <label
                    htmlFor="canned-subject"
                    className="flex items-center gap-2 font-heading text-[10.5px] font-bold uppercase tracking-[0.08em] text-ink"
                  >
                    <span
                      aria-hidden
                      className="flex size-5 shrink-0 items-center justify-center rounded-md bg-brand-red/10 text-brand-red"
                    >
                      <Bookmark className="size-3" strokeWidth={2.25} />
                    </span>
                    <span>Asunto sugerido (opcional)</span>
                  </label>
                </div>
                <input
                  id="canned-subject"
                  value={suggestedSubject}
                  maxLength={120}
                  onChange={(e) => setSuggestedSubject(e.target.value)}
                  placeholder="Ej. Solicitud de Información · Plastifar"
                  className="mt-2 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-[13px] font-medium text-ink shadow-2xs outline-none transition-colors placeholder:font-normal placeholder:text-zinc-400 hover:border-zinc-300 focus:border-zinc-300 focus:ring-2 focus:ring-brand-red/25"
                />
              </div>

              {/* 4. Cuerpo del correo con Variables Inteligentes */}
              <div className="flex flex-1 flex-col px-6 py-3.5">
                <div className="flex items-center justify-between pb-2">
                  <span className="flex items-center gap-2 font-heading text-[10.5px] font-bold uppercase tracking-[0.08em] text-ink">
                    <span
                      aria-hidden
                      className="flex size-5 shrink-0 items-center justify-center rounded-md bg-brand-red/10 text-brand-red"
                    >
                      <Mail className="size-3" strokeWidth={2.25} />
                    </span>
                    <span>
                      Cuerpo del correo <span className="text-brand-red">*</span>
                    </span>
                  </span>
                  <div className="flex items-center gap-2 font-heading text-[10.5px] font-bold tabular-nums text-zinc-400">
                    <span>
                      {stats.words} {stats.words === 1 ? "palabra" : "palabras"}
                    </span>
                    <span>·</span>
                    <span>{stats.chars}/20,000 caracteres</span>
                  </div>
                </div>

                <div className="relative overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-2xs transition-all hover:border-zinc-300 focus-within:border-zinc-300 focus-within:ring-2 focus-within:ring-brand-red/25">
                  <CannedVariableChips
                    onInsert={(token) => {
                      bodyEditorRef.current?.insertVariable(token);
                    }}
                  />
                  <CannedTemplateBodyEditor
                    ref={bodyEditorRef}
                    value={body}
                    maxLength={20000}
                    onChange={setBody}
                    placeholder={CANNED_BODY_PLACEHOLDER}
                  />
                </div>
              </div>
            </div>
          ) : (
            /* MODO: VISTA PREVIA INTERACTIVA DE CORREO */
            <div className="flex flex-1 flex-col bg-zinc-50/60 px-6 pt-4 pb-6">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-heading text-[13.5px] font-bold text-ink">
                      Vista previa de la plantilla
                    </h3>
                    <span
                      className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10.5px] font-semibold ${badgeStyle.badge}`}
                    >
                      <span className={`size-1.5 rounded-full ${badgeStyle.dot}`} />
                      {categoryName}
                    </span>
                  </div>
                  <p className="text-[11.5px] text-subtle">
                    {previewMode === "simulated"
                      ? "Simulación con datos reales del destinatario (cliente@empresa.com)."
                      : "Visualización de las etiquetas de variables inteligentes en la plantilla."}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <div className="inline-flex h-7 items-center gap-0.5 rounded-lg border border-zinc-200 bg-white p-0.5">
                    <button
                      type="button"
                      onClick={() => setPreviewMode("simulated")}
                      className={`inline-flex h-6 items-center gap-1 rounded-md px-2 text-[11px] font-medium transition-colors cursor-pointer ${
                        previewMode === "simulated"
                          ? "bg-brand-red/10 font-semibold text-brand-red"
                          : "text-zinc-500 hover:text-ink"
                      }`}
                    >
                      <Sparkles className="size-3" />
                      <span>Simular envío</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setPreviewMode("tokens")}
                      className={`inline-flex h-6 items-center gap-1 rounded-md px-2 text-[11px] font-medium transition-colors cursor-pointer ${
                        previewMode === "tokens"
                          ? "bg-zinc-100 font-semibold text-ink"
                          : "text-zinc-500 hover:text-ink"
                      }`}
                    >
                      <span>Ver variables</span>
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => setActiveTab("compose")}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-2.5 py-1 text-[12px] font-medium text-zinc-700 shadow-2xs hover:bg-zinc-50 hover:text-ink transition-colors cursor-pointer"
                  >
                    <PenLine className="h-3.5 w-3.5 text-zinc-500" />
                    <span>Volver a redacción</span>
                  </button>
                </div>
              </div>

              {/* Tarjeta de correo recibido */}
              <div className="flex flex-1 flex-col overflow-hidden rounded-xl border border-zinc-200/80 bg-white shadow-2xs">
                {/* Header del correo cliente */}
                <div className="border-b border-zinc-100 bg-white p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-red font-heading text-[14px] font-bold text-white shadow-2xs">
                        PF
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-heading text-[14px] font-bold text-ink">
                            {sampleContext.agentName ?? "Soporte Plastifar"}
                          </span>
                          <span className="text-[12px] text-zinc-400">
                            &lt;{sampleContext.agentEmail ?? "soporte@plastifar.com"}&gt;
                          </span>
                        </div>
                        <p className="mt-0.5 text-[12px] text-zinc-500">
                          Para:{" "}
                          <span className="font-medium text-ink">{sampleContext.contactEmail}</span>
                        </p>
                      </div>
                    </div>

                    <div className="font-heading text-[11px] tabular-nums text-zinc-400">
                      {formatDateTime(new Date().toISOString())}
                    </div>
                  </div>

                  <div className="mt-4 border-t border-zinc-100 pt-3">
                    <div className="flex items-center justify-between">
                      <span className="font-heading text-[10px] font-bold uppercase tracking-[0.08em] text-zinc-400">
                        Asunto {suggestedSubject.trim() ? "(Sugerido)" : ""}
                      </span>
                      {suggestedSubject.trim() && (
                        <span className="text-[10px] text-brand-red font-medium">
                          Auto-completado en correos nuevos
                        </span>
                      )}
                    </div>
                    <h4 className="mt-0.5 font-heading text-[15px] font-semibold text-ink">
                      {previewMode === "simulated" ? (
                        applyCannedVariables(
                          suggestedSubject.trim() || title.trim() || "Sin asunto especificado",
                          sampleContext,
                        )
                      ) : (
                        <CannedTemplateInline
                          value={suggestedSubject.trim() || title.trim() || "Sin asunto especificado"}
                          size="md"
                        />
                      )}
                    </h4>
                  </div>
                </div>

                {/* Cuerpo de la plantilla */}
                <div className="flex-1 overflow-y-auto p-6">
                  {body.trim() ? (
                    <div className="max-w-2xl space-y-4 font-sans text-[13.5px] leading-[1.75] text-ink">
                      {body.split(/\n{2,}/).map((para, i) => (
                        <p key={i} className="whitespace-pre-wrap">
                          {previewMode === "simulated" ? (
                            applyCannedVariables(para, sampleContext)
                          ) : (
                            <CannedTemplateInline value={para} size="md" />
                          )}
                        </p>
                      ))}
                    </div>
                  ) : (
                    <div className="flex h-48 flex-col items-center justify-center text-center">
                      <Mail className="h-8 w-8 text-zinc-300" />
                      <p className="mt-2 text-[13px] text-zinc-400">
                        Escribe el texto de la respuesta en la pestaña "Redacción" para previsualizarlo aquí.
                      </p>
                    </div>
                  )}
                </div>

                {/* Banner inferior de la vista previa */}
                <div className="flex items-center justify-between border-t border-zinc-100 bg-zinc-50/80 px-4 py-2.5 text-[11.5px] text-subtle">
                  <span className="font-medium text-ink">Variables inteligentes activas</span>
                  <span>
                    Al usar la plantilla en un correo, las variables se sustituyen por los datos reales del destinatario
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Pie de Acciones del Estudio */}
        <div className="flex shrink-0 items-center justify-between gap-3 border-t border-line bg-white px-6 py-3.5">
          <div className="hidden items-center gap-1.5 text-[11.5px] text-zinc-400 sm:flex">
            <kbd className="rounded-md border border-zinc-200 bg-zinc-50 px-1.5 py-0.5 font-mono text-[10px] font-medium text-zinc-600">
              Ctrl
            </kbd>
            <span>+</span>
            <kbd className="rounded-md border border-zinc-200 bg-zinc-50 px-1.5 py-0.5 font-mono text-[10px] font-medium text-zinc-600">
              Enter
            </kbd>
            <span className="ml-1">para guardar rápidamente</span>
          </div>

          <div className="ml-auto flex items-center gap-2">
            <Button type="button" variant="secondary" onClick={requestClose} disabled={isSubmitting}>
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={handleSave}
              isLoading={isSubmitting}
              disabled={!title.trim() || !body.trim()}
            >
              <Send className="h-3.5 w-3.5" />
              {isEdit ? "Guardar cambios" : "Crear plantilla"}
            </Button>
          </div>
        </div>
      </div>

      {createCategoryModalOpen && (
        <CategoriaModal
          onClose={() => setCreateCategoryModalOpen(false)}
          onSaved={loadCategories}
        />
      )}
    </div>,
    document.body,
  );
}
