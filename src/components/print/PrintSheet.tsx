import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { toPng } from "html-to-image";
import { jsPDF } from "jspdf";
import { FileSpreadsheet, FileText, Printer } from "lucide-react";

type Orientation = "portrait" | "landscape";

const layouts: Record<Orientation, { page: string; sheet: string; hint: string }> = {
  portrait: {
    page: "size: letter; margin: 14mm;",
    sheet: "max-w-[800px] text-[11px]",
    hint: "Elige exportar a Excel, guardar PDF o imprimir. Si la descarga no inició sola, usa «Guardar doc PDF».",
  },
  landscape: {
    page: "size: letter landscape; margin: 12mm;",
    sheet: "max-w-[1040px] text-[10.5px]",
    hint: "Elige exportar a Excel, guardar PDF o imprimir. Si la descarga no inició sola, usa «Guardar doc PDF».",
  },
};

const actionBtnBase =
  "inline-flex w-full items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-[11px] font-semibold transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed";

/**
 * La hoja de un formulario controlado (PF-FOR-…): el tamaño de papel, la barra
 * con los botones de guardar PDF, exportar Excel e imprimir —que no salen en el papel— y las
 * clases `no-print` y `avoid-break` que usan las secciones. Fuera del armazón de
 * la aplicación, para que la barra lateral no se imprima.
 */
export function PrintSheet({
  orientation,
  filename,
  onExportExcel,
  extraActions,
  children,
}: {
  orientation: Orientation;
  filename?: string;
  onExportExcel?: () => void | Promise<void>;
  extraActions?: ReactNode;
  children: ReactNode;
}) {
  const layout = layouts[orientation];
  const downloadingRef = useRef(false);
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const sheetContentRef = useRef<HTMLDivElement>(null);
  const autoTriggeredRef = useRef(false);

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

  return (
    <div className={`mx-auto bg-white p-8 leading-snug text-black print:p-0 ${layout.sheet}`}>
      <style>{`
        @page { ${layout.page} }
        @media print {
          body { background: white; }
          .no-print { display: none !important; }
          .avoid-break { break-inside: avoid; }
        }
      `}</style>

      {/* Salida del documento: Excel, PDF e impresión (no sale en papel) */}
      <div className="no-print mb-4 rounded-xl border border-zinc-200/90 bg-zinc-50/60 px-3 py-2.5">
        <div className="mx-auto flex max-w-3xl flex-col gap-2.5 sm:flex-row sm:items-center sm:gap-4">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <div className="flex size-7 shrink-0 items-center justify-center rounded-md border border-zinc-200/80 bg-white text-zinc-600">
              <FileText className="size-3.5" />
            </div>
            <div className="min-w-0 text-left">
              <h1 className="font-heading text-[11px] font-bold leading-tight tracking-tight text-zinc-900">
                Salida del documento oficial
              </h1>
              <p className="text-[10px] leading-snug text-zinc-500">
                {downloading
                  ? "Generando PDF…"
                  : "Excel · PDF · Impresión"}
              </p>
              {downloadError && (
                <p className="mt-0.5 text-[10px] font-semibold leading-snug text-rose-600">{downloadError}</p>
              )}
              {!downloading && !downloadError && (
                <p className="sr-only">{layout.hint}</p>
              )}
            </div>
          </div>

          <div
            className={`grid shrink-0 gap-1.5 sm:w-[min(100%,22rem)] ${
              onExportExcel ? "grid-cols-3" : "grid-cols-2"
            }`}
          >
            {onExportExcel && (
              <button
                type="button"
                onClick={() => void onExportExcel()}
                className={`${actionBtnBase} border border-emerald-200/90 bg-emerald-50 text-emerald-800 hover:bg-emerald-100`}
                title="Descargar en formato Excel (.xlsx)"
              >
                <FileSpreadsheet className="size-3 shrink-0 text-emerald-600" />
                <span className="truncate">Excel</span>
              </button>
            )}

            {extraActions}

            <button
              type="button"
              onClick={handleDownloadPdf}
              disabled={downloading}
              className={`${actionBtnBase} border border-rose-200/90 bg-rose-50 text-rose-800 hover:bg-rose-100`}
              title="Guardar como archivo PDF"
            >
              <FileText className="size-3 shrink-0 text-rose-600" />
              <span className="truncate">{downloading ? "PDF…" : "PDF"}</span>
            </button>

            <button
              type="button"
              onClick={() => window.print()}
              className={`${actionBtnBase} border border-zinc-700 bg-zinc-800 text-white hover:bg-zinc-700`}
              title="Abrir diálogo de impresión nativo"
            >
              <Printer className="size-3 shrink-0 text-zinc-200" />
              <span className="truncate">Imprimir</span>
            </button>
          </div>
        </div>
      </div>

      <div ref={sheetContentRef}>
        {children}
      </div>
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
