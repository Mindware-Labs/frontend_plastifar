import {
  Calendar,
  Check,
  Copy,
  CopyPlus,
  Mail,
  Maximize2,
  Minimize2,
  Pencil,
  Trash2,
  User,
  X,
} from "lucide-react";
import { useEffect, useId, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "../../components/ui/Button";
import { dialogHeaderShellClass, dialogHeaderStackClass } from "../../components/ui/dialogHeaderStyles";
import { useDialogMotion } from "../../hooks/useDialogMotion";
import { formatDateTime } from "../../lib/format";
import type { CannedResponseResponse } from "../../types/api";
import { templateToReadablePlain } from "../../lib/cannedVariables";
import { getCategoryBadgeClasses, parseCanned } from "./cannedHelpers";
import { CannedTemplateInline } from "./CannedTemplateInline";

interface CannedPreviewDrawerProps {
  item: CannedResponseResponse;
  canManage: boolean;
  onClose: () => void;
  onEdit: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}

export function CannedPreviewDrawer({
  item,
  canManage,
  onClose,
  onEdit,
  onDuplicate,
  onDelete,
}: CannedPreviewDrawerProps) {
  const { isExiting, requestClose, scrimRef, panelRef } = useDialogMotion(onClose, { variant: "drawer" });
  const titleId = useId();
  const [isMaximized, setIsMaximized] = useState(false);
  const [copied, setCopied] = useState(false);

  const { category, cleanTitle, cleanBody, suggestedSubject } = useMemo(
    () => parseCanned(item.title, item.body),
    [item.title, item.body],
  );

  const badgeStyle = getCategoryBadgeClasses(category);

  // Estadísticas del cuerpo
  const stats = useMemo(() => {
    const trimmed = cleanBody.trim();
    const words = trimmed ? trimmed.split(/\s+/).length : 0;
    const chars = cleanBody.length;
    return { words, chars };
  }, [cleanBody]);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(templateToReadablePlain(cleanBody));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
      const ta = document.createElement("textarea");
      ta.value = templateToReadablePlain(cleanBody);
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  // Cerrar con Escape
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && !isExiting) {
        requestClose();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isExiting, requestClose]);

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
          isMaximized ? "w-full" : "w-full sm:w-[640px] md:w-[700px] lg:w-[760px]"
        } ${isExiting ? "pointer-events-none" : ""}`}
      >
        {/* Cabecera del Drawer */}
        <div className={dialogHeaderShellClass}>
          <div className={dialogHeaderStackClass}>
            <div className="flex items-center gap-2">
              <span className="font-heading text-[10px] font-bold uppercase tracking-[0.1em] text-zinc-400">
                Correo · Detalle de plantilla
              </span>
              <span
                className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10.5px] font-semibold ${badgeStyle.badge}`}
              >
                <span className={`size-1.5 rounded-full ${badgeStyle.dot}`} />
                {category}
              </span>
            </div>

            <h2 id={titleId} className="font-heading text-[17px] font-bold tracking-[-0.01em] text-ink truncate">
              {cleanTitle}
            </h2>
          </div>

          <div className="flex items-center gap-1.5">
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
              aria-label="Cerrar vista previa"
              title="Cerrar (Esc)"
              className="-mr-1.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-subtle outline-none transition-colors hover:bg-fill hover:text-ink focus-visible:ring-2 focus-visible:ring-brand-red/25"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Metadatos de la plantilla */}
        <div className="border-b border-line bg-zinc-50/60 px-6 py-2.5">
          <div className="flex flex-wrap items-center justify-between gap-y-2 gap-x-4 text-[11.5px] text-zinc-600">
            <div className="flex flex-wrap items-center gap-4">
              <span className="inline-flex items-center gap-1.5">
                <User className="h-3.5 w-3.5 text-zinc-400" />
                <span>Creada por: <strong className="font-medium text-zinc-800">{item.createdByName}</strong></span>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5 text-zinc-400" />
                <span>Actualizada: <strong className="font-medium text-zinc-800">{formatDateTime(item.updatedAt)}</strong></span>
              </span>
            </div>

            <div className="flex items-center gap-2 font-mono text-[11px] text-zinc-500">
              <span>{stats.words} {stats.words === 1 ? "palabra" : "palabras"}</span>
              <span>·</span>
              <span>{stats.chars} caracteres</span>
            </div>
          </div>
        </div>

        {/* Cuerpo / Previsualización tipo correo */}
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-zinc-50/40 p-6">
          <div className="flex flex-1 flex-col overflow-hidden rounded-xl border border-zinc-200/80 bg-white shadow-2xs">
            {/* Cabecera del correo simulado */}
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
              </div>

              {/* Asunto sugerido */}
              <div className="mt-4 border-t border-zinc-100 pt-3">
                <div className="flex items-center justify-between">
                  <span className="font-heading text-[10px] font-bold uppercase tracking-[0.08em] text-zinc-400">
                    Asunto {suggestedSubject ? "(Sugerido)" : ""}
                  </span>
                  {suggestedSubject && (
                    <span className="rounded bg-brand-red/5 px-1.5 py-0.5 text-[10px] font-medium text-brand-red">
                      Se auto-completa en correos nuevos
                    </span>
                  )}
                </div>
                <h4 className="mt-0.5 font-heading text-[15px] font-semibold text-ink">
                  {suggestedSubject || cleanTitle}
                </h4>
              </div>
            </div>

            {/* Texto de la respuesta */}
            <div className="flex-1 overflow-y-auto p-6">
              {cleanBody.trim() ? (
                <div className="max-w-2xl space-y-4 font-sans text-[13.5px] leading-[1.75] text-ink">
                  {cleanBody.split(/\n{2,}/).map((para, i) => (
                    <p key={i}>
                      <CannedTemplateInline value={para} size="md" />
                    </p>
                  ))}
                </div>
              ) : (
                <div className="flex h-48 flex-col items-center justify-center text-center">
                  <Mail className="h-8 w-8 text-zinc-300" />
                  <p className="mt-2 text-[13px] text-zinc-400">Sin contenido.</p>
                </div>
              )}
            </div>

            {/* Pie informativo */}
            <div className="flex items-center justify-between border-t border-zinc-100 bg-zinc-50/80 px-4 py-2.5 text-[11.5px] text-subtle">
              <span>Plantilla reutilizable · Puede modificarse en el editor tras insertarse</span>
              <button
                type="button"
                onClick={handleCopy}
                className="inline-flex items-center gap-1 font-medium text-brand-red hover:underline cursor-pointer"
              >
                {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                <span>{copied ? "¡Copiado!" : "Copiar texto"}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Barra inferior de acciones */}
        <div className="flex shrink-0 items-center justify-between gap-3 border-t border-line bg-white px-6 py-3.5">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={handleCopy}
            className={`gap-1.5 transition-colors ${copied ? "!border-emerald-500 !text-emerald-700 bg-emerald-50/50" : ""}`}
          >
            {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
            <span>{copied ? "Texto copiado" : "Copiar al portapapeles"}</span>
          </Button>

          <div className="ml-auto flex items-center gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => {
                requestClose();
                onDuplicate();
              }}
              className="gap-1.5"
            >
              <CopyPlus className="h-3.5 w-3.5 text-zinc-600" />
              <span>Duplicar</span>
            </Button>

            {canManage && (
              <>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    requestClose();
                    onEdit();
                  }}
                  className="gap-1.5"
                >
                  <Pencil className="h-3.5 w-3.5 text-zinc-600" />
                  <span>Editar</span>
                </Button>

                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    requestClose();
                    onDelete();
                  }}
                  className="gap-1.5 text-red-600 hover:bg-red-50 hover:text-red-700"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span>Eliminar</span>
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
