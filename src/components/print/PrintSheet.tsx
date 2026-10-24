import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { toPng } from "html-to-image";
import { jsPDF } from "jspdf";

type Orientation = "portrait" | "landscape";

const layouts: Record<Orientation, { page: string; sheet: string; hint: string }> = {
  portrait: {
    page: "size: letter; margin: 14mm;",
    sheet: "max-w-[800px] text-[11px]",
    hint: "Vista oficial de impresión / PDF. Si el diálogo no se abrió, usa los botones.",
  },
  landscape: {
    page: "size: letter landscape; margin: 12mm;",
    sheet: "max-w-[1040px] text-[10.5px]",
    hint: "Vista oficial de impresión / PDF (horizontal). Si el diálogo no se abrió, usa los botones.",
  },
};

/**
 * La hoja de un formulario controlado (PF-FOR-…): el tamaño de papel, la barra
 * con los botones de guardar PDF e imprimir —que no salen en el papel— y las
 * clases `no-print` y `avoid-break` que usan las secciones. Fuera del armazón de
 * la aplicación, para que la barra lateral no se imprima.
 */
export function PrintSheet({
  orientation,
  filename,
  children,
}: {
  orientation: Orientation;
  filename?: string;
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

      <div className="no-print mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-zinc-200 bg-zinc-50 px-3.5 py-2 text-[12px] text-zinc-600 shadow-2xs">
        <div>
          <span>{downloading ? "Generando y guardando documento PDF…" : layout.hint}</span>
          {downloadError && <span className="ml-2 font-semibold text-rose-600">{downloadError}</span>}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleDownloadPdf}
            disabled={downloading}
            className="rounded-md bg-rose-600 px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-rose-700 transition-colors cursor-pointer disabled:opacity-50"
          >
            {downloading ? "Guardando PDF…" : "Guardar doc PDF"}
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="rounded-md bg-zinc-800 px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-zinc-900 transition-colors cursor-pointer"
          >
            Imprimir
          </button>
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
