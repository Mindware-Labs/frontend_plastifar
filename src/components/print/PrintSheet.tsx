import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { toPng } from "html-to-image";
import { jsPDF } from "jspdf";
import { FileDown, FileSpreadsheet, Printer } from "lucide-react";
import { ModuleHeader } from "../app/ModuleHeader";
import { Button } from "../ui/Button";

type Orientation = "portrait" | "landscape";

const layouts: Record<Orientation, { page: string; sheet: string; hint: string }> = {
  portrait: {
    page: "size: letter; margin: 14mm;",
    sheet: "max-w-[820px] text-[11px]",
    hint: "Elige exportar a Excel, guardar PDF o imprimir.",
  },
  landscape: {
    page: "size: letter landscape; margin: 12mm;",
    sheet: "max-w-[1040px] text-[10.5px]",
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
  extraActions,
  title,
  backLabel = "Volver",
  onBack,
  children,
}: {
  orientation: Orientation;
  filename?: string;
  onExportExcel?: () => void | Promise<void>;
  extraActions?: ReactNode;
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
      const dataUrl = await toPng(element, {
        pixelRatio: 2,
        backgroundColor: "#ffffff",
      });

      const pdf = new jsPDF({
        orientation,
        unit: "mm",
        format: "letter",
      });

      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = orientation === "landscape" ? 10 : 12;
      const printWidth = pageWidth - margin * 2;

      const img = new Image();
      img.src = dataUrl;
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
      });

      const printHeight = (img.height * printWidth) / img.width;
      const maxPageContentHeight = pageHeight - margin * 2;

      let remainingHeight = printHeight;
      let position = margin;

      pdf.addImage(dataUrl, "PNG", margin, position, printWidth, printHeight);
      remainingHeight -= maxPageContentHeight;

      while (remainingHeight > 0) {
        position -= maxPageContentHeight;
        pdf.addPage("letter", orientation);
        pdf.addImage(dataUrl, "PNG", margin, position, printWidth, printHeight);
        remainingHeight -= maxPageContentHeight;
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
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden font-sans text-zinc-900 print:min-h-0 print:bg-white print:p-0">
      <style>{`
        @page { ${layout.page} }
        @media print {
          body { background: white !important; }
          .no-print { display: none !important; }
          .avoid-break { break-inside: avoid; }
        }
      `}</style>

      {/* Header oficial de la aplicación integrado a la perfección */}
      <ModuleHeader
        className="no-print !mb-0"
        onBack={handleGoBack}
        backLabel={backLabel}
        title={
          <div className="flex items-center gap-2">
            <span>{displayTitle}</span>
            <span className="hidden sm:inline-flex rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-semibold text-zinc-600">
              {orientation === "portrait" ? "Carta · Vertical" : "Carta · Horizontal"}
            </span>
          </div>
        }
        action={
          <div className="flex shrink-0 items-center gap-2">
            {onExportExcel && (
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={() => void onExportExcel()}
                className="gap-1.5 text-emerald-800 border-emerald-200/90 bg-emerald-50/90 hover:bg-emerald-100 hover:border-emerald-300 active:scale-95 cursor-pointer"
                title="Descargar en formato Excel (.xlsx)"
              >
                <FileSpreadsheet className="size-3.5 text-emerald-600 shrink-0" />
                <span className="hidden sm:inline">Exportar</span>
                <span>Excel</span>
              </Button>
            )}

            {extraActions}

            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={handleDownloadPdf}
              disabled={downloading}
              className="gap-1.5 text-rose-800 border-rose-200/90 bg-rose-50/90 hover:bg-rose-100 hover:border-rose-300 active:scale-95 disabled:opacity-50 cursor-pointer"
              title="Guardar como archivo PDF"
            >
              <FileDown className="size-3.5 text-rose-600 shrink-0" />
              <span>{downloading ? "Generando…" : "Descargar PDF"}</span>
            </Button>

            <Button
              type="button"
              size="sm"
              variant="primary"
              onClick={() => window.print()}
              className="gap-1.5 active:scale-95 cursor-pointer"
              title="Abrir diálogo de impresión nativo"
            >
              <Printer className="size-3.5 text-zinc-300 shrink-0" />
              <span>Imprimir</span>
            </Button>
          </div>
        }
      />

      {/* Espacio del lienzo de papel con sombra realista y centrado perfecto */}
      <main className="flex-1 min-h-0 overflow-y-auto -mx-3 -mb-3 lg:-mx-4 lg:-mb-3.5 py-6 sm:py-8 px-4 sm:px-6 bg-canvas print:p-0 print:m-0 print:bg-white print:overflow-visible">
        {downloadError && (
          <div className="mx-auto mb-4 max-w-2xl rounded-lg bg-rose-50 border border-rose-200 p-2.5 text-center text-[12px] font-medium text-rose-700">
            {downloadError}
          </div>
        )}
        <div
          ref={sheetContentRef}
          className={`mx-auto bg-white rounded-md p-8 sm:p-10 shadow-[0_4px_24px_rgba(0,0,0,0.06),0_1px_3px_rgba(0,0,0,0.04)] ring-1 ring-zinc-900/[0.05] leading-snug text-black print:p-0 print:m-0 print:shadow-none print:ring-0 print:rounded-none ${layout.sheet}`}
        >
          {children}
        </div>
      </main>
    </div>
  );
}

/** Lo que se ve mientras el registro no llegó, o si no se pudo cargar. */
export function PrintPending({ error }: { error: string | null }) {
  return error ? (
    <p className="p-8 text-[13px] text-red-700">{error}</p>
  ) : (
    <p className="p-8 text-[13px] text-zinc-500">Preparando la impresión…</p>
  );
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
