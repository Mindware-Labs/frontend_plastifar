import type { ReactNode } from "react";

type Orientation = "portrait" | "landscape";

const layouts: Record<Orientation, { page: string; sheet: string; hint: string }> = {
  portrait: {
    page: "size: letter; margin: 14mm;",
    sheet: "max-w-[800px] text-[11px]",
    hint: "Vista de impresión. Si el diálogo no se abrió, usa el botón.",
  },
  landscape: {
    page: "size: letter landscape; margin: 12mm;",
    sheet: "max-w-[1040px] text-[10.5px]",
    hint: "Vista de impresión (horizontal). Si el diálogo no se abrió, usa el botón.",
  },
};

/**
 * La hoja de un formulario controlado (PF-FOR-…): el tamaño de papel, la barra
 * con el botón de imprimir —que no sale en el papel— y las clases `no-print` y
 * `avoid-break` que usan las secciones. Fuera del armazón de la aplicación,
 * para que la barra lateral no se imprima.
 */
export function PrintSheet({ orientation, children }: { orientation: Orientation; children: ReactNode }) {
  const layout = layouts[orientation];

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

      <div className="no-print mb-4 flex items-center justify-between rounded border border-zinc-200 bg-zinc-50 px-3 py-2 text-[12px] text-zinc-600">
        <span>{layout.hint}</span>
        <button type="button" onClick={() => window.print()} className="rounded bg-black px-3 py-1 text-[12px] font-semibold text-white">
          Imprimir
        </button>
      </div>

      {children}
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
