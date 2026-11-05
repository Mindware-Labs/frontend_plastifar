import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { jsPDF } from "jspdf";
import { ArrowLeft, FileDown, FileSpreadsheet, Printer } from "lucide-react";
import { captureElementAsCanvas } from "./printCapture";
import { Button } from "../ui/Button";
import { PrintSheetSkeleton } from "./PrintSheetSkeleton";

type Orientation = "portrait" | "landscape";

const layouts: Record<Orientation, { page: string; sheet: string; hint: string }> = {
  portrait: {
    page: "size: letter; margin: 12mm;",
    sheet: "box-border w-full max-w-[820px] text-[11px]",
    hint: "Elige exportar a Excel, guardar PDF o imprimir.",
  },
  landscape: {
    page: "size: letter landscape; margin: 10mm;",
    sheet: "box-border w-full max-w-[1056px] text-[10px]",
    hint: "Elige exportar a Excel, guardar PDF o imprimir.",
  },
};

/**
 * La hoja de un formulario controlado (PF-FOR-…): tamaño de papel, barra de
 * herramientas ejecutiva con botón claro de retorno, exportación a Excel,
 * descarga de PDF e impresión, con lienzo centrado y simetría.
 */
export function PrintSheet({
  orientation,
  filename,
  onExportExcel,
  title,
  backLabel = "Volver",
  onBack,
  children,
}: {
  orientation: Orientation;
  filename?: string;
  onExportExcel?: () => void | Promise<void>;
  title?: string;
  backLabel?: string;
  onBack?: () => void;
  children: ReactNode;
}) {
  const navigate = useNavigate();
  const layout = layouts[orientation];
  const downloadingRef = useRef(false);
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const sheetContentRef = useRef<HTMLDivElement>(null);
  const autoTriggeredRef = useRef(false);

  const handleGoBack = useCallback(() => {
    if (onBack) {
      onBack();
      return;
    }
    if (window.history.state && window.history.state.idx > 0) {
      navigate(-1);
    } else if (window.history.length > 1) {
      navigate(-1);
    } else {
      window.close();
      navigate("/");
    }
  }, [navigate, onBack]);

  const handleDownloadPdf = useCallback(async () => {
    if (!sheetContentRef.current || downloadingRef.current) return;
    downloadingRef.current = true;
    setDownloading(true);
    setDownloadError(null);

    try {
      const element = sheetContentRef.current;
      const canvas = await captureElementAsCanvas(element, orientation);

      const pdf = new jsPDF({
        orientation,
        unit: "mm",
        format: "letter",
        compress: true,
      });

      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = orientation === "landscape" ? 8 : 10;
      const availWidth = pageWidth - margin * 2;
      const availHeight = pageHeight - margin * 2;

      const imgW = canvas.width;
      const imgH = canvas.height;
      const naturalPrintHeight = (imgH * availWidth) / imgW;

      // Si cabe en una página o la excede moderadamente (formularios oficiales de 1 hoja),
      // se ajusta proporcionalmente dentro del área útil para que nunca salga cortado.
      if (naturalPrintHeight <= availHeight * 1.5) {
        const scale = Math.min(availWidth / imgW, availHeight / imgH);
        const renderWidth = imgW * scale;
        const renderHeight = imgH * scale;
        const offsetX = margin + (availWidth - renderWidth) / 2;
        const offsetY = margin;

        const dataUrl = canvas.toDataURL("image/png");
        pdf.addImage(dataUrl, "PNG", offsetX, offsetY, renderWidth, renderHeight);
      } else {
        // Documento multipágina: rebanar el canvas por página respetando márgenes limpios.
        const sliceHeightPx = Math.max(1, Math.floor((availHeight / availWidth) * imgW));
        let offsetYpx = 0;
        let pageIndex = 0;

        while (offsetYpx < imgH) {
          const currentSlicePx = Math.min(sliceHeightPx, imgH - offsetYpx);
          const sliceCanvas = document.createElement("canvas");
          sliceCanvas.width = imgW;
          sliceCanvas.height = currentSlicePx;

          const sliceCtx = sliceCanvas.getContext("2d");
          if (sliceCtx) {
            sliceCtx.fillStyle = "#ffffff";
            sliceCtx.fillRect(0, 0, imgW, currentSlicePx);
            sliceCtx.drawImage(
              canvas,
              0,
              offsetYpx,
              imgW,
              currentSlicePx,
              0,
              0,
              imgW,
              currentSlicePx,
            );
          }

          if (pageIndex > 0) {
            pdf.addPage("letter", orientation);
          }

          const slicePrintHeight = (currentSlicePx * availWidth) / imgW;
          pdf.addImage(
            sliceCanvas.toDataURL("image/png"),
            "PNG",
            margin,
            margin,
            availWidth,
            slicePrintHeight,
          );

          offsetYpx += currentSlicePx;
          pageIndex += 1;
        }
      }

      const rawName = filename || `${document.title.replace(/[·\/\\:*?"<>|]/g, "_").trim() || "documento"}.pdf`;
      const cleanFilename = rawName.endsWith(".pdf") ? rawName : `${rawName}.pdf`;
      pdf.save(cleanFilename);
    } catch (err) {
      console.error("Fallo al exportar a PDF:", err);
      setDownloadError("No se pudo generar el PDF automáticamente. Puedes usar la opción Imprimir.");
    } finally {
      downloadingRef.current = false;
      setDownloading(false);
    }
  }, [orientation, filename]);

  // Se ejecuta exactamente una vez si se entra en mode=pdf
  useEffect(() => {
    if (autoTriggeredRef.current) return;
    if (window.location.search.includes("mode=pdf")) {
      autoTriggeredRef.current = true;
      const timer = window.setTimeout(() => {
        handleDownloadPdf();
      }, 600);
      return () => window.clearTimeout(timer);
    }
  }, [handleDownloadPdf]);

  const displayTitle = title || document.title.split("·")[0]?.trim() || "Documento Oficial";

  return (
    <div
      data-print-sheet-root="true"
      className="flex h-full min-h-0 flex-1 flex-col overflow-hidden font-sans text-zinc-900 print:block print:h-auto print:min-h-0 print:overflow-visible print:bg-white print:p-0"
    >
      <style>{`
        @page { ${layout.page} }
        @media print {
          html, body, #root {
            background: #ffffff !important;
            height: auto !important;
            min-height: 0 !important;
            max-height: none !important;
            overflow: visible !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          aside,
          nav,
          .no-print {
            display: none !important;
          }
          div:has([data-print-sheet-root="true"]),
          main:has([data-print-sheet-root="true"]) {
            display: block !important;
            height: auto !important;
            min-height: 0 !important;
            max-height: none !important;
            overflow: visible !important;
            padding: 0 !important;
            margin: 0 !important;
            background: #ffffff !important;
          }
          [data-print-sheet-root="true"],
          [data-print-sheet-root="true"] > main,
          [data-print-sheet-canvas="true"] {
            display: block !important;
            width: 100% !important;
            max-width: none !important;
            height: auto !important;
            min-height: 0 !important;
            max-height: none !important;
            overflow: visible !important;
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
            box-shadow: none !important;
            border-radius: 0 !important;
          }
          [data-print-sheet-canvas="true"] table {
            width: 100% !important;
            max-width: 100% !important;
            table-layout: fixed !important;
          }
          [data-print-sheet-canvas="true"] th,
          [data-print-sheet-canvas="true"] td {
            overflow-wrap: anywhere;
            word-break: break-word;
          }
          .avoid-break {
            break-inside: avoid;
          }
        }
        [data-pdf-capture="true"] {
          overflow: visible !important;
          box-sizing: border-box !important;
        }
        [data-pdf-capture="true"] table {
          width: 100% !important;
          max-width: 100% !important;
          table-layout: fixed !important;
        }
        [data-pdf-capture="true"] th,
        [data-pdf-capture="true"] td {
          overflow-wrap: anywhere;
          word-break: break-word;
        }
      `}</style>

      {/* Topbar ejecutiva oficial: contenida al 100% sin desbordes y con simetría visual */}
      <header className="no-print print:hidden sticky top-0 z-30 flex h-14 w-full shrink-0 items-center justify-between border-b border-zinc-200/90 bg-white/95 px-4 sm:px-6 backdrop-blur-md shadow-2xs">
        {/* Lado izquierdo: Retorno + Divisor + Título del Formulario */}
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={handleGoBack}
            title={backLabel}
            aria-label={backLabel}
            className="inline-flex h-8.5 items-center gap-2 rounded-lg border border-zinc-200/90 bg-white px-3 text-xs font-semibold text-zinc-700 shadow-2xs transition-all hover:bg-zinc-50 hover:border-zinc-300 hover:text-zinc-900 active:scale-95 cursor-pointer shrink-0"
          >
            <ArrowLeft className="size-3.5 text-zinc-500" />
            <span>{backLabel}</span>
          </button>

          <div aria-hidden className="hidden sm:block h-4 w-px bg-zinc-200 shrink-0" />

          <div className="flex items-center gap-2.5 min-w-0">
            <h1 className="font-heading text-sm sm:text-base font-bold text-zinc-900 tracking-tight truncate">
              {displayTitle}
            </h1>
            <span className="hidden sm:inline-flex shrink-0 items-center rounded-full border border-zinc-200/80 bg-zinc-100/90 px-2.5 py-0.5 text-[11px] font-medium text-zinc-600">
              {orientation === "portrait" ? "Carta · Vertical" : "Carta · Horizontal"}
            </span>
          </div>
        </div>

        {/* Lado derecho: Acciones de Documento (Excel, PDF, Imprimir) */}
        <div className="flex shrink-0 items-center gap-2 pl-3">
          {onExportExcel && (
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => void onExportExcel()}
              className="gap-1.5 text-emerald-800 border-emerald-200/90 bg-emerald-50/90 hover:bg-emerald-100 hover:border-emerald-300 active:scale-95 cursor-pointer shadow-2xs font-medium"
              title="Descargar en formato Excel (.xlsx)"
            >
              <FileSpreadsheet className="size-3.5 text-emerald-600 shrink-0" />
              <span className="hidden md:inline">Exportar</span>
              <span>Excel</span>
            </Button>
          )}


          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={handleDownloadPdf}
            disabled={downloading}
            className="gap-1.5 text-zinc-700 border-zinc-200 bg-white hover:bg-zinc-50 hover:border-zinc-300 active:scale-95 disabled:opacity-50 cursor-pointer shadow-2xs font-medium"
            title="Guardar como archivo PDF"
          >
            <FileDown className="size-3.5 text-zinc-500 shrink-0" />
            <span>{downloading ? "Generando…" : "Descargar PDF"}</span>
          </Button>

          <Button
            type="button"
            size="sm"
            variant="primary"
            onClick={() => window.print()}
            className="gap-1.5 active:scale-95 cursor-pointer shadow-xs font-semibold"
            title="Abrir diálogo de impresión nativo"
          >
            <Printer className="size-3.5 shrink-0" />
            <span>Imprimir</span>
          </Button>
        </div>
      </header>

      {/* Espacio del lienzo de papel con sombra realista y centrado perfecto */}
      <main className="flex-1 min-h-0 overflow-auto bg-zinc-100/70 py-8 sm:py-10 px-4 sm:px-6 print:block print:p-0 print:m-0 print:bg-white print:overflow-visible">
        {downloadError && (
          <div className="no-print print:hidden mx-auto mb-4 max-w-2xl rounded-lg bg-rose-50 border border-rose-200 p-2.5 text-center text-[12px] font-medium text-rose-700">
            {downloadError}
          </div>
        )}
        <div
          ref={sheetContentRef}
          data-print-sheet-canvas="true"
          className={`mx-auto bg-white rounded-lg p-6 sm:p-10 shadow-[0_4px_24px_rgba(0,0,0,0.07),0_1px_4px_rgba(0,0,0,0.04)] ring-1 ring-zinc-900/[0.05] leading-snug text-black print:p-0 print:m-0 print:shadow-none print:ring-0 print:rounded-none print:min-w-0 print:w-full print:max-w-none ${layout.sheet}`}
        >
          {children}
        </div>
      </main>
    </div>
  );
}

export { PrintSheetSkeleton };

/** Lo que se ve mientras el registro no llegó, o si no se pudo cargar: Skeleton completo en vez de spinner. */
export function PrintPending({
  error,
  orientation = "portrait",
  backLabel = "Volver",
}: {
  error: string | null;
  orientation?: "portrait" | "landscape";
  backLabel?: string;
}) {
  if (error) {
    return (
      <div className="flex min-h-screen flex-col font-sans text-zinc-900 bg-zinc-100/70">
        <header className="sticky top-0 z-30 flex h-14 w-full shrink-0 items-center justify-between border-b border-zinc-200/90 bg-white/95 px-4 sm:px-6 backdrop-blur-md shadow-2xs">
          <button
            type="button"
            onClick={() => (window.history.length > 1 ? window.history.back() : window.close())}
            className="inline-flex h-8.5 items-center gap-2 rounded-lg border border-zinc-200/90 bg-white px-3 text-xs font-semibold text-zinc-700 shadow-2xs transition-all hover:bg-zinc-50 hover:border-zinc-300 hover:text-zinc-900 active:scale-95 cursor-pointer shrink-0"
          >
            <ArrowLeft className="size-3.5 text-zinc-500" />
            <span>{backLabel}</span>
          </button>
        </header>
        <main className="flex-1 flex items-center justify-center p-6">
          <div className="max-w-md w-full rounded-xl border border-rose-200 bg-white p-6 shadow-sm text-center">
            <p className="text-sm font-semibold text-rose-800">{error}</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-4 inline-flex items-center justify-center rounded-lg border border-zinc-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-zinc-700 shadow-2xs hover:bg-zinc-50 hover:border-zinc-300 active:scale-95 cursor-pointer transition-all"
            >
              Reintentar
            </button>
          </div>
        </main>
      </div>
    );
  }

  return <PrintSheetSkeleton orientation={orientation} backLabel={backLabel} />;
}

/** Celda con etiqueta en negrita, como las del formulario en papel. */
export function PrintCell({ label, children, className = "" }: { label: string; children?: ReactNode; className?: string }) {
  return (
    <div className={`border border-black px-1.5 py-1 ${className}`}>
      <span className="font-semibold">{label} </span>
      <span>{children ?? ""}</span>
    </div>
  );
}
