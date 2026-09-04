import {
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  Download,
  ExternalLink,
  FileQuestion,
  Paperclip,
  X,
} from "lucide-react";
import { Suspense, lazy, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ApiError } from "../../api/client";
import { emailsApi } from "../../api/emails";
import { Alert } from "../../components/ui/Alert";
import { Button } from "../../components/ui/Button";
import { Spinner } from "../../components/ui/Spinner";
import { useDialogBehavior } from "../../hooks/useDialogBehavior";
import { formatBytes } from "../../lib/format";
import type { AttachmentLinkResponse, EmailAttachmentResponse } from "../../types/api";
import { dividerClass, iconButtonClass } from "./toolbarStyles";

// pdf.js pesa mas que el resto de la app: se descarga recien al abrir un PDF.
const PdfViewer = lazy(() =>
  import("./PdfViewer").then((module) => ({ default: module.PdfViewer })),
);

interface PreviewState {
  id: number;
  link: AttachmentLinkResponse | null;
  error: string | null;
}

interface AttachmentPreviewModalProps {
  emailId: number;
  attachments: EmailAttachmentResponse[];
  index: number;
  onIndexChange: (index: number) => void;
  onClose: () => void;
}

/** El servidor ya decidio que se abre dentro del navegador: aca solo se elige el visor. */
function previewKind(link: AttachmentLinkResponse, fallback: boolean) {
  if (link.contentType.startsWith("image/")) return "image";
  if (link.contentType === "application/pdf" && !fallback) return "pdf";
  return link.inline ? "frame" : "none";
}

export function AttachmentPreviewModal({
  emailId,
  attachments,
  index,
  onIndexChange,
  onClose,
}: AttachmentPreviewModalProps) {
  const attachment = attachments[index];
  const panelRef = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<PreviewState>({ id: attachment.id, link: null, error: null });
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [fallbackId, setFallbackId] = useState<number | null>(null);
  const [toolbarSlot, setToolbarSlot] = useState<HTMLDivElement | null>(null);
  const [downloading, setDownloading] = useState(false);

  // El id viaja con el enlace: al saltar de adjunto no se ve por un instante el anterior.
  const link = state.id === attachment.id ? state.link : null;
  const error = state.id === attachment.id ? state.error : null;
  const copied = copiedId === attachment.id;
  const kind = link && previewKind(link, fallbackId === attachment.id);

  useDialogBehavior(panelRef, onClose);

  useEffect(() => {
    let cancelled = false;

    emailsApi
      .attachmentLink(emailId, attachment.id)
      .then((data) => {
        if (!cancelled) setState({ id: attachment.id, link: data, error: null });
      })
      .catch((err) => {
        if (cancelled) return;
        const message = err instanceof ApiError ? err.message : "No se pudo abrir el documento";
        setState({ id: attachment.id, link: null, error: message });
      });

    return () => {
      cancelled = true;
    };
  }, [emailId, attachment.id]);

  // Las flechas saltan entre adjuntos sin tener que volver al panel.
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.target instanceof HTMLInputElement) return;
      if (event.key === "ArrowLeft" && index > 0) onIndexChange(index - 1);
      if (event.key === "ArrowRight" && index < attachments.length - 1) onIndexChange(index + 1);
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [index, attachments.length, onIndexChange]);

  async function handleDownload() {
    if (downloading) return;
    setDownloading(true);

    try {
      // Enlace propio: el del visor abre el archivo en la pestana en vez de bajarlo.
      const target = await emailsApi.attachmentLink(emailId, attachment.id, true);
      const anchor = document.createElement("a");
      anchor.href = target.url;
      anchor.download = attachment.fileName;
      anchor.rel = "noopener";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "No se pudo descargar el documento";
      setState((prev) => ({ ...prev, error: message }));
    } finally {
      setDownloading(false);
    }
  }

  async function handleCopy() {
    if (!link) return;
    await navigator.clipboard.writeText(link.url);
    setCopiedId(attachment.id);
    window.setTimeout(() => setCopiedId(null), 2000);
  }

  return createPortal(
    <div
      className="animate-plf-scrim-in fixed inset-0 z-50 flex items-center justify-center
        bg-ink/55 p-4 backdrop-blur-[2px]"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={`Adjunto ${attachment.fileName}`}
        className="animate-plf-modal-in flex h-full w-full max-w-6xl flex-col overflow-hidden
          rounded-edge border border-line bg-white
          shadow-[0_4px_10px_rgba(27,27,29,0.06),0_32px_64px_-28px_rgba(27,27,29,0.45)]"
      >
        <div className="flex h-12 shrink-0 items-center gap-3 border-b border-line px-3">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <Paperclip className="h-3.5 w-3.5 shrink-0 text-faint" />
            <p className="truncate text-[12.5px] font-semibold text-ink" title={attachment.fileName}>
              {attachment.fileName}
            </p>
            <span className="hidden shrink-0 text-[11.5px] text-faint sm:inline">
              {formatBytes(attachment.sizeBytes)}
            </span>
            {attachments.length > 1 && (
              <div className="flex shrink-0 items-center gap-1">
                <span aria-hidden className={dividerClass} />
                <button
                  type="button"
                  aria-label="Adjunto anterior"
                  disabled={index === 0}
                  onClick={() => onIndexChange(index - 1)}
                  className={iconButtonClass}
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <span className="min-w-[42px] text-center text-[11.5px] font-medium text-subtle">
                  {index + 1}/{attachments.length}
                </span>
                <button
                  type="button"
                  aria-label="Adjunto siguiente"
                  disabled={index === attachments.length - 1}
                  onClick={() => onIndexChange(index + 1)}
                  className={iconButtonClass}
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>

          {/* Hueco central: el visor de PDF dibuja aca sus propios controles. */}
          <div ref={setToolbarSlot} className="flex shrink-0 items-center gap-1" />

          <div className="flex flex-1 items-center justify-end gap-1">
            <button
              type="button"
              onClick={handleCopy}
              disabled={!link}
              aria-label="Copiar enlace temporal"
              title={copied ? "Enlace copiado" : "Copiar enlace temporal"}
              className={iconButtonClass}
            >
              {copied ? (
                <Check className="h-4 w-4 text-brand-green" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </button>

            <button
              type="button"
              onClick={() => link && window.open(link.url, "_blank", "noopener")}
              disabled={!link}
              aria-label="Abrir en una pestaña nueva"
              title="Abrir en una pestaña nueva"
              className={iconButtonClass}
            >
              <ExternalLink className="h-4 w-4" />
            </button>

            <span aria-hidden className={dividerClass} />

            <Button size="sm" className="h-7 px-3" onClick={handleDownload} isLoading={downloading}>
              <Download className="h-4 w-4" />
              Descargar
            </Button>

            <span aria-hidden className={dividerClass} />

            <button type="button" onClick={onClose} aria-label="Cerrar" className={iconButtonClass}>
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {error && (
          <div className="shrink-0 border-b border-line px-3 py-2">
            <Alert variant="error">{error}</Alert>
          </div>
        )}

        <div className="min-h-0 flex-1 bg-canvas">
          {!link ? (
            error ? (
              <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
                <FileQuestion className="h-8 w-8 text-faint" />
                <p className="text-[12.5px] text-subtle">No se pudo mostrar el documento.</p>
              </div>
            ) : (
              <div className="flex h-full items-center justify-center">
                <Spinner />
              </div>
            )
          ) : kind === "image" ? (
            <div className="flex h-full items-center justify-center p-2">
              <img
                src={link.url}
                alt={attachment.fileName}
                className="max-h-full max-w-full object-contain"
              />
            </div>
          ) : kind === "pdf" ? (
            <Suspense
              fallback={
                <div className="flex h-full items-center justify-center">
                  <Spinner />
                </div>
              }
            >
              <PdfViewer
                url={link.url}
                toolbarSlot={toolbarSlot}
                onUnavailable={() => setFallbackId(attachment.id)}
              />
            </Suspense>
          ) : kind === "frame" ? (
            // El documento viene de un remitente externo: al servirse desde el bucket no alcanza el DOM de la app.
            <iframe
              key={attachment.id}
              src={link.url}
              title={attachment.fileName}
              referrerPolicy="no-referrer"
              className="h-full w-full border-0 bg-white"
            />
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center">
              <FileQuestion className="h-8 w-8 text-faint" />
              <p className="text-[13px] font-semibold text-ink">
                Este tipo de archivo no se puede previsualizar.
              </p>
              <p className="text-[12.5px] text-subtle">
                Descárgalo para abrirlo con la aplicación de tu equipo.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
