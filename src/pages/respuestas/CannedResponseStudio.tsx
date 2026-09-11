import {
  Check,
  Eye,
  Mail,
  Maximize2,
  Minimize2,
  PenLine,
  Send,
  User,
  X,
} from "lucide-react";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { cannedApi } from "../../api/canned";
import { ApiError } from "../../api/client";
import { Alert } from "../../components/ui/Alert";
import { Button } from "../../components/ui/Button";
import { useModalAnimation } from "../../hooks/useModalAnimation";
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
  const { isExiting, requestClose } = useModalAnimation(onClose, 220);

  const [title, setTitle] = useState(item?.title ?? "");
  const [body, setBody] = useState(item?.body ?? "");
  const [activeTab, setActiveTab] = useState<"compose" | "preview">("compose");
  const [isMaximized, setIsMaximized] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const titleId = useId();
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);

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
      inert={isExiting ? true : undefined}
      className={`fixed inset-0 z-50 flex justify-end bg-ink/45 backdrop-blur-[2px] transition-opacity ${
        isExiting ? "animate-plf-scrim-out pointer-events-none" : "animate-plf-scrim-in"
      }`}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !isExiting) requestClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={`relative flex h-full flex-col bg-white shadow-[0_4px_24px_rgba(27,27,29,0.18)] transition-all duration-200 ease-out ${
          isMaximized ? "w-full" : "w-full sm:w-[740px] md:w-[790px] lg:w-[840px]"
        } ${isExiting ? "animate-plf-drawer-out pointer-events-none" : "animate-plf-drawer-in"}`}
      >
        {/* Barra superior de control del Estudio */}
        <div className="flex shrink-0 items-center justify-between border-b border-line bg-canvas/70 px-6 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-edge bg-brand-red/10 text-brand-red">
              <Mail className="h-4 w-4" />
            </div>
            <div>
              <h2 id={titleId} className="font-heading text-[15px] font-bold text-ink">
                {isEdit ? "Editar respuesta predefinida" : "Nueva respuesta predefinida"}
              </h2>
              <p className="text-[11px] text-faint">
                Estructura de correo corporativo para agentes de soporte
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Pestañas de modo: Redactor / Vista previa */}
            <div className="flex items-center rounded-edge border border-line bg-white p-0.5 shadow-2xs">
              <button
                type="button"
                onClick={() => setActiveTab("compose")}
                className={`flex items-center gap-1.5 rounded-edge px-3 py-1 text-[11.5px] font-medium transition-colors ${
                  activeTab === "compose"
                    ? "bg-brand-red text-white shadow-2xs"
                    : "text-brand-gray hover:bg-fill hover:text-ink"
                }`}
              >
                <PenLine className="h-3 w-3" />
                Redacción
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("preview")}
                className={`flex items-center gap-1.5 rounded-edge px-3 py-1 text-[11.5px] font-medium transition-colors ${
                  activeTab === "preview"
                    ? "bg-brand-red text-white shadow-2xs"
                    : "text-brand-gray hover:bg-fill hover:text-ink"
                }`}
              >
                <Eye className="h-3 w-3" />
                Vista previa
              </button>
            </div>

            <div className="mx-1 h-4 w-px bg-line" />

            {/* Maximizar / Normal */}
            <button
              type="button"
              onClick={() => setIsMaximized((prev) => !prev)}
              aria-label={isMaximized ? "Restaurar tamaño normal" : "Maximizar estudio a pantalla completa"}
              title={isMaximized ? "Restaurar ancho" : "Pantalla completa"}
              className="flex h-7 w-7 items-center justify-center rounded-edge text-brand-gray transition-colors hover:bg-fill hover:text-ink"
            >
              {isMaximized ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
            </button>

            {/* Cerrar */}
            <button
              type="button"
              onClick={requestClose}
              aria-label="Cerrar estudio"
              title="Cerrar (Esc)"
              className="flex h-7 w-7 items-center justify-center rounded-edge text-brand-gray transition-colors hover:bg-fill hover:text-ink"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Cuerpo del Estudio */}
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
          {formError && (
            <div className="px-6 pt-4">
              <Alert variant="error">{formError}</Alert>
            </div>
          )}

          {activeTab === "compose" ? (
            <div className="flex flex-1 flex-col">
              {/* Identificador interno de plantilla */}
              <div className="border-b border-line px-6 py-3.5">
                <div className="flex items-center justify-between">
                  <label
                    htmlFor="canned-title"
                    className="font-heading text-[10.5px] font-bold uppercase tracking-[0.08em] text-faint"
                  >
                    Nombre de la plantilla <span className="text-brand-red">*</span>
                  </label>
                  <span className="text-[10.5px] text-faint">{title.length}/120</span>
                </div>
                <input
                  id="canned-title"
                  ref={titleRef}
                  value={title}
                  maxLength={120}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Ej. Solicitud de comprobante de pago, Confirmación de entrega..."
                  className="mt-1.5 w-full rounded-edge border border-line bg-white px-3 py-2 text-[13.5px] font-semibold text-ink outline-none transition-colors placeholder:font-normal placeholder:text-faint focus:border-brand-red/50 focus:ring-3 focus:ring-brand-red/12"
                  autoFocus
                />
                <p className="mt-1 text-[11px] text-faint">
                  Este es el nombre visible en el menú "Respuestas rápidas" para encontrarla al redactar correos.
                </p>
              </div>

              {/* Anatomía / Cabecera visual del Correo */}
              <div className="border-b border-line bg-canvas/30 px-6 py-3">
                <div className="flex flex-col gap-2 rounded-edge border border-line bg-white p-3 shadow-2xs">
                  {/* De: */}
                  <div className="flex items-center gap-3 text-[12px]">
                    <span className="w-14 shrink-0 font-heading text-[10.5px] font-bold uppercase tracking-[0.08em] text-faint">
                      De:
                    </span>
                    <div className="flex min-w-0 items-center gap-2">
                      <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-red text-[10px] font-bold text-white">
                        P
                      </div>
                      <span className="font-semibold text-ink">Soporte Plastifar</span>
                      <span className="text-faint">&lt;soporte@plastifar.com&gt;</span>
                      <span className="ml-auto inline-flex items-center gap-1 rounded-edge bg-brand-green/10 px-1.5 py-0.5 text-[10px] font-semibold text-brand-green">
                        <Check className="h-2.5 w-2.5" /> Verificado
                      </span>
                    </div>
                  </div>

                  <div className="h-px bg-line/60" />

                  {/* Para: */}
                  <div className="flex items-center gap-3 text-[12px]">
                    <span className="w-14 shrink-0 font-heading text-[10.5px] font-bold uppercase tracking-[0.08em] text-faint">
                      Para:
                    </span>
                    <div className="flex min-w-0 items-center gap-2">
                      <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-fill text-[10px] font-semibold text-brand-gray">
                        <User className="h-3 w-3 text-faint" />
                      </div>
                      <span className="rounded-edge border border-line bg-canvas px-2 py-0.5 font-mono text-[11.5px] text-ink">
                        [Destinatario del correo]
                      </span>
                      <span className="text-[11px] text-subtle">
                        (Se definirá al seleccionar o responder un correo)
                      </span>
                    </div>
                  </div>

                  <div className="h-px bg-line/60" />

                  {/* Asunto contextual */}
                  <div className="flex items-center gap-3 text-[12px]">
                    <span className="w-14 shrink-0 font-heading text-[10.5px] font-bold uppercase tracking-[0.08em] text-faint">
                      Asunto:
                    </span>
                    <span className="truncate font-medium text-ink">
                      {title.trim() ? title.trim() : "Asunto del hilo o correo en curso"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Lienzo de Redacción del Correo */}
              <div className="flex flex-1 flex-col px-6 py-4">
                <div className="flex items-center justify-between pb-2">
                  <span className="font-heading text-[10.5px] font-bold uppercase tracking-[0.08em] text-faint">
                    Cuerpo de la plantilla <span className="text-brand-red">*</span>
                  </span>
                  <div className="flex items-center gap-3 text-[11px] text-faint">
                    <span>{stats.words} palabras</span>
                    <span>·</span>
                    <span>{stats.chars}/20,000 caracteres</span>
                  </div>
                </div>

                <div className="relative flex min-h-[300px] flex-1 flex-col rounded-edge border border-line bg-white shadow-2xs focus-within:border-brand-red/50 focus-within:ring-3 focus-within:ring-brand-red/12">
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
                    className="w-full flex-1 resize-none bg-transparent p-4 font-sans text-[13.5px] leading-[1.7] text-ink outline-none placeholder:text-faint/70"
                  />
                </div>

                {/* Controles de pie de redacción */}
                <div className="mt-2.5 flex items-center justify-between text-[11.5px] text-faint">
                  <span>
                    Plantilla reutilizable. Al insertarla desde "Respuestas rápidas", podrás ajustar y completar el texto manualmente.
                  </span>
                </div>
              </div>
            </div>
          ) : (
            /* MODO: VISTA PREVIA INTERACTIVA DE CORREO */
            <div className="flex flex-1 flex-col bg-canvas/40 p-6">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <h3 className="font-heading text-[13px] font-bold text-ink">
                    Vista previa de la plantilla
                  </h3>
                  <p className="text-[11.5px] text-faint">
                    Así se estructurará el mensaje como plantilla de correo.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab("compose")}
                  className="inline-flex items-center gap-1 rounded-edge border border-line bg-white px-2.5 py-1 text-[11.5px] font-medium text-brand-gray transition-colors hover:bg-fill hover:text-ink"
                >
                  <PenLine className="h-3 w-3" />
                  Volver a editar
                </button>
              </div>

              {/* Tarjeta de correo recibido */}
              <div className="flex flex-1 flex-col overflow-hidden rounded-edge border border-line bg-white shadow-sm">
                {/* Header del correo cliente */}
                <div className="border-b border-line bg-white p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-red font-heading text-[14px] font-bold text-white shadow-2xs">
                        PF
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-heading text-[14px] font-bold text-ink">
                            Soporte Plastifar
                          </span>
                          <span className="text-[12px] text-faint">&lt;soporte@plastifar.com&gt;</span>
                        </div>
                        <p className="mt-0.5 text-[12px] text-brand-gray">
                          Para:{" "}
                          <span className="font-medium text-ink">[Destinatario del correo]</span>{" "}
                          <span className="text-faint">&lt;cliente@empresa.com&gt;</span>
                        </p>
                      </div>
                    </div>

                    <div className="text-right text-[11px] text-faint">
                      {formatDateTime(new Date().toISOString())}
                    </div>
                  </div>

                  <div className="mt-4 border-t border-line/60 pt-3">
                    <span className="font-heading text-[10px] font-bold uppercase tracking-[0.08em] text-faint">
                      Asunto
                    </span>
                    <h4 className="font-heading text-[15px] font-semibold text-ink">
                      {title.trim() ? title.trim() : "Sin asunto especificado"}
                    </h4>
                  </div>
                </div>

                {/* Cuerpo de la plantilla */}
                <div className="flex-1 overflow-y-auto p-6">
                  {body.trim() ? (
                    <div className="max-w-2xl space-y-4 font-sans text-[14px] leading-[1.75] text-ink">
                      {body.split(/\n{2,}/).map((para, i) => (
                        <p key={i} className="whitespace-pre-line">
                          {para}
                        </p>
                      ))}
                    </div>
                  ) : (
                    <div className="flex h-48 flex-col items-center justify-center text-center">
                      <Mail className="h-8 w-8 text-faint/60" />
                      <p className="mt-2 text-[13px] text-faint">
                        Escribe el texto de la respuesta en la pestaña "Redacción" para previsualizarlo aquí.
                      </p>
                    </div>
                  )}
                </div>

                {/* Banner inferior de la vista previa */}
                <div className="flex items-center justify-between border-t border-line bg-canvas px-4 py-2 text-[11px] text-faint">
                  <span>Modo plantilla de correo</span>
                  <span className="text-brand-gray">
                    El texto se inserta tal cual en el editor para su ajuste manual antes de enviar
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Pie de Acciones del Estudio */}
        <div className="flex shrink-0 items-center justify-between border-t border-line bg-canvas/90 px-6 py-3.5">
          <div className="flex items-center gap-2 text-[11.5px] text-faint">
            <kbd className="rounded-edge border border-line bg-white px-1.5 py-0.5 font-mono text-[10px] text-brand-gray shadow-2xs">
              Ctrl + Enter
            </kbd>
            <span className="hidden sm:inline">para guardar directamente</span>
          </div>

          <div className="flex items-center gap-2">
            <Button type="button" variant="secondary" onClick={requestClose} disabled={isSubmitting}>
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={handleSave}
              isLoading={isSubmitting}
              className="gap-1.5"
            >
              <Send className="h-3.5 w-3.5" />
              {isEdit ? "Guardar cambios" : "Crear respuesta"}
            </Button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
