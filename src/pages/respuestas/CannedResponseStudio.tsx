import {
  Eye,
  Mail,
  Maximize2,
  Minimize2,
  PenLine,
  Send,
  X,
} from "lucide-react";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { cannedApi } from "../../api/canned";
import { ApiError } from "../../api/client";
import { Alert } from "../../components/ui/Alert";
import { Button } from "../../components/ui/Button";
import { useDialogMotion } from "../../hooks/useDialogMotion";
import { formatDateTime } from "../../lib/format";
import type { CannedResponseResponse } from "../../types/api";

interface CannedResponseStudioProps {
  /** Presente = edición; ausente = nueva respuesta rápida. */
  item?: CannedResponseResponse;
  onClose: () => void;
  onSaved: () => void;
}

export function CannedResponseStudio({ item, onClose, onSaved }: CannedResponseStudioProps) {
  const isEdit = item !== undefined;
  const { isExiting, requestClose, scrimRef, panelRef } = useDialogMotion(onClose, { variant: "drawer" });

  const [title, setTitle] = useState(item?.title ?? "");
  const [body, setBody] = useState(item?.body ?? "");
  const [activeTab, setActiveTab] = useState<"compose" | "preview">("compose");
  const [isMaximized, setIsMaximized] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const titleId = useId();
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  // Métricas del cuerpo
  const stats = useMemo(() => {
    const trimmed = body.trim();
    const words = trimmed ? trimmed.split(/\s+/).length : 0;
    const chars = body.length;
    const paragraphs = trimmed ? trimmed.split(/\n{2,}/).length : 0;
    return { words, chars, paragraphs };
  }, [body]);

  const handleSave = useCallback(async () => {
    const cleanTitle = title.trim();
    const cleanBody = body.trim();

    if (!cleanTitle) {
      setFormError("Ingresa un nombre o título para identificar la respuesta.");
      titleRef.current?.focus();
      return;
    }
    if (cleanTitle.length > 120) {
      setFormError("El título no puede exceder 120 caracteres.");
      return;
    }
    if (!cleanBody) {
      setFormError("Escribe el cuerpo del correo de la respuesta.");
      bodyRef.current?.focus();
      return;
    }
    if (cleanBody.length > 20000) {
      setFormError("El texto es demasiado largo.");
      return;
    }

    setFormError(null);
    setIsSubmitting(true);
    try {
      if (isEdit) {
        await cannedApi.update(item.id, cleanTitle, cleanBody);
      } else {
        await cannedApi.create(cleanTitle, cleanBody);
      }
      onSaved();
      requestClose();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "No se pudo guardar la respuesta");
    } finally {
      setIsSubmitting(false);
    }
  }, [title, body, isEdit, item, onSaved, requestClose]);

  // Cerrar con Escape y atajo para guardar
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && !isExiting) {
        requestClose();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        handleSave();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isExiting, requestClose, handleSave]);

  return createPortal(
    <div
      ref={scrimRef}
      inert={isExiting ? true : undefined}
      className={`fixed inset-0 z-50 flex justify-end bg-ink/45 backdrop-blur-[2px] transition-opacity ${
        isExiting ? "pointer-events-none" : ""
      }`}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !isExiting) requestClose();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={`relative flex h-full flex-col bg-white shadow-[0_4px_32px_rgba(27,27,29,0.22)] transition-all duration-200 ease-out ${
          isMaximized ? "w-full" : "w-full sm:w-[680px] md:w-[740px] lg:w-[800px]"
        } ${isExiting ? "pointer-events-none" : ""}`}
      >
        {/* Cabecera del Drawer con nueva jerarquía */}
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-line px-6 py-4">
          <div className="min-w-0">
            <p className="font-heading text-[10px] font-bold uppercase tracking-[0.1em] text-zinc-400">
              Correo · Respuestas rápidas
            </p>
            <h2 id={titleId} className="mt-1 font-heading text-[17px] font-bold tracking-[-0.01em] text-ink">
              {isEdit ? "Editar respuesta predefinida" : "Nueva respuesta predefinida"}
            </h2>
            <p className="mt-0.5 text-[12px] leading-relaxed text-subtle">
              Estructura de correo corporativo para agilizar la atención por soporte.
            </p>
          </div>

          <div className="flex items-center gap-2">
            {/* Control segmentado para alternar Redacción / Vista previa */}
            <div
              role="tablist"
              aria-label="Modo de trabajo"
              className="inline-flex h-8 items-center gap-0.5 rounded-lg border border-zinc-200 bg-zinc-50 p-0.5"
            >
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === "compose"}
                onClick={() => setActiveTab("compose")}
                className={`inline-flex h-7 items-center gap-1.5 rounded-md px-2.5 text-[12px] transition-colors duration-150 outline-none select-none cursor-pointer focus-visible:ring-2 focus-visible:ring-brand-red/25 ${
                  activeTab === "compose"
                    ? "border border-zinc-200 bg-white font-semibold text-zinc-900 shadow-2xs"
                    : "border-transparent font-medium text-zinc-500 hover:bg-white/60 hover:text-zinc-800"
                }`}
              >
                <PenLine className="h-3.5 w-3.5" />
                <span>Redacción</span>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === "preview"}
                onClick={() => setActiveTab("preview")}
                className={`inline-flex h-7 items-center gap-1.5 rounded-md px-2.5 text-[12px] transition-colors duration-150 outline-none select-none cursor-pointer focus-visible:ring-2 focus-visible:ring-brand-red/25 ${
                  activeTab === "preview"
                    ? "border border-zinc-200 bg-white font-semibold text-zinc-900 shadow-2xs"
                    : "border-transparent font-medium text-zinc-500 hover:bg-white/60 hover:text-zinc-800"
                }`}
              >
                <Eye className="h-3.5 w-3.5" />
                <span>Vista previa</span>
              </button>
            </div>

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
              ref={closeButtonRef}
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
            <div className="px-6 pt-4">
              <Alert variant="error">{formError}</Alert>
            </div>
          )}

          {activeTab === "compose" ? (
            <div className="flex flex-1 flex-col">
              {/* Título de la plantilla */}
              <div className="border-b border-line px-6 py-4">
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
                    {title.length}/120
                  </span>
                </div>
                <input
                  id="canned-title"
                  ref={titleRef}
                  value={title}
                  maxLength={120}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Ej. Solicitud de comprobante de pago, Confirmación de entrega..."
                  className="mt-2 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-[13px] font-medium text-ink shadow-2xs outline-none transition-colors placeholder:font-normal placeholder:text-zinc-400 focus:border-zinc-300 focus:ring-2 focus:ring-brand-red/25"
                  autoFocus
                />
                <p className="mt-1.5 text-[11.5px] text-subtle">
                  Este es el nombre visible en el menú "Respuestas rápidas" para encontrarla al redactar correos.
                </p>
              </div>


              {/* Lienzo de Redacción del Correo */}
              <div className="flex flex-1 flex-col px-6 py-4">
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
                    <span>{stats.words} {stats.words === 1 ? "palabra" : "palabras"}</span>
                    <span>·</span>
                    <span>{stats.chars}/20,000 caracteres</span>
                  </div>
                </div>

                <div className="relative flex min-h-[300px] flex-1 flex-col rounded-lg border border-zinc-200 bg-white shadow-2xs focus-within:border-zinc-300 focus-within:ring-2 focus-within:ring-brand-red/25">
                  <textarea
                    ref={bodyRef}
                    value={body}
                    maxLength={20000}
                    onChange={(e) => setBody(e.target.value)}
                    placeholder={
                      "Estimado/a [Nombre del Cliente],\n\n" +
                      "Gracias por comunicarse con Plastifar. Hemos recibido su consulta sobre [Detalle / Pedido] y nuestro equipo ya está atendiendo los detalles.\n\n" +
                      "Quedamos a su entera disposición ante cualquier duda adicional.\n\n" +
                      "Atentamente,"
                    }
                    className="w-full flex-1 resize-none bg-transparent p-4 font-sans text-[13px] leading-[1.7] text-ink outline-none placeholder:text-zinc-400"
                  />
                </div>

                {/* Controles de pie de redacción */}
                <div className="mt-2.5 flex items-center justify-between text-[11.5px] text-subtle">
                  <span>
                    Plantilla reutilizable. Al insertarla desde "Respuestas rápidas", podrás ajustar y completar el texto manualmente.
                  </span>
                </div>
              </div>
            </div>
          ) : (
            /* MODO: VISTA PREVIA INTERACTIVA DE CORREO */
            <div className="flex flex-1 flex-col bg-zinc-50/60 p-6">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <h3 className="font-heading text-[13.5px] font-bold text-ink">
                    Vista previa de la plantilla
                  </h3>
                  <p className="text-[11.5px] text-subtle">
                    Así se estructurará el mensaje como plantilla de correo.
                  </p>
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
                            Soporte Plastifar
                          </span>
                          <span className="text-[12px] text-zinc-400">&lt;soporte@plastifar.com&gt;</span>
                        </div>
                        <p className="mt-0.5 text-[12px] text-zinc-500">
                          Para:{" "}
                          <span className="font-medium text-ink">[Destinatario del correo]</span>{" "}
                          <span className="text-zinc-400">&lt;cliente@empresa.com&gt;</span>
                        </p>
                      </div>
                    </div>

                    <div className="font-heading text-[11px] tabular-nums text-zinc-400">
                      {formatDateTime(new Date().toISOString())}
                    </div>
                  </div>

                  <div className="mt-4 border-t border-zinc-100 pt-3">
                    <span className="font-heading text-[10px] font-bold uppercase tracking-[0.08em] text-zinc-400">
                      Asunto
                    </span>
                    <h4 className="mt-0.5 font-heading text-[15px] font-semibold text-ink">
                      {title.trim() ? title.trim() : "Sin asunto especificado"}
                    </h4>
                  </div>
                </div>

                {/* Cuerpo de la plantilla */}
                <div className="flex-1 overflow-y-auto p-6">
                  {body.trim() ? (
                    <div className="max-w-2xl space-y-4 font-sans text-[13.5px] leading-[1.75] text-ink">
                      {body.split(/\n{2,}/).map((para, i) => (
                        <p key={i} className="whitespace-pre-line">
                          {para}
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
                  <span className="font-medium text-ink">Modo plantilla de correo</span>
                  <span>
                    El texto se inserta tal cual en el editor para su ajuste manual antes de enviar
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
            <span aria-hidden>+</span>
            <kbd className="rounded-md border border-zinc-200 bg-zinc-50 px-1.5 py-0.5 font-mono text-[10px] font-medium text-zinc-600">
              Enter
            </kbd>
            <span>para guardar</span>
          </div>

          <div className="ml-auto flex items-center gap-2">
            <Button type="button" variant="secondary" size="sm" onClick={requestClose} disabled={isSubmitting}>
              Cancelar
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleSave}
              isLoading={isSubmitting}
              className="gap-1.5"
            >
              <Send className="h-3.5 w-3.5" />
              <span>{isEdit ? "Guardar cambios" : "Crear respuesta"}</span>
            </Button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
