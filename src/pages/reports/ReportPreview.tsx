import { Check, Minus } from "lucide-react";
import type { ReportCriteria, ReferenceData } from "./ReportFilters";
import { type ReportDefinition, type ReportFilterKey } from "../../types/reports";

/**
 * Lo que el reporte va a traer, antes de pedirlo.
 *
 * ==================================================================
 * QUÉ PROBLEMA RESUELVE
 * ==================================================================
 * El panel ofrece 33 reportes y cada uno honra un subconjunto distinto de
 * criterios. Como los controles que el reporte NO acota simplemente no se
 * dibujan, quien elige uno no tiene forma de saber que ese recorte no existe:
 * ve cuatro campos, los llena, y da por hecho que acotó por todo lo que el
 * panel sabe acotar.
 *
 * Esa es la confusión cara. Alguien que cree haber filtrado por territorio lee
 * un número que responde a otra pregunta, y no hay nada en la pantalla que lo
 * contradiga. Acá se dice al derecho y al revés: por qué acota y por qué no.
 *
 * ==================================================================
 * TODO SALE DE LA DEFINICIÓN, NADA SE INVENTA
 * ==================================================================
 * `report.filters` ya declara qué honra el servidor — es la misma lista con la
 * que se decide qué controles pintar. Acá se lee la inversa contra el catálogo
 * completo de criterios. Si mañana un reporte empieza a honrar territorio, esta
 * vista lo refleja sola.
 *
 * No hay estimación de filas ni conteo previo: eso exigiría una consulta que
 * hoy no existe, y un número aproximado en una pantalla de reportes es peor que
 * ningún número.
 */

const FILTER_LABEL: Record<ReportFilterKey, string> = {
  range: "Período",
  client: "Cliente",
  productLine: "Línea de producto",
  responsible: "Responsable",
  territory: "Territorio",
  salesRep: "Vendedor",
  clientType: "Tipo de cliente",
  activeOnly: "Sólo activos",
};

const ALL_FILTERS = Object.keys(FILTER_LABEL) as ReportFilterKey[];

/** «13 ago» — sin año, que ya lo dice el otro extremo del rango. */
function shortDate(iso: string): string {
  if (!iso) return "—";
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("es-DO", { day: "numeric", month: "short" });
}

function dayspan(from: string, to: string): string | null {
  if (!from || !to) return null;
  const a = new Date(`${from}T00:00:00`);
  const b = new Date(`${to}T00:00:00`);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return null;
  const days = Math.round((b.getTime() - a.getTime()) / 86_400_000) + 1;
  return days > 0 ? `${days} día${days === 1 ? "" : "s"}` : null;
}

export function ReportPreview({
  report,
  criteria,
  reference,
}: {
  report: ReportDefinition;
  criteria: ReportCriteria;
  reference: ReferenceData;
}) {
  const honored = ALL_FILTERS.filter((key) => report.filters.includes(key));
  const ignored = ALL_FILTERS.filter((key) => !report.filters.includes(key));

  /** El nombre de lo elegido, no su id: un id no le dice nada a nadie. */
  const nameOf = (options: { value: string; label: string }[], value: string, fallback: string) =>
    value ? (options.find((o) => o.value === value)?.label ?? fallback) : fallback;

  /*
   * Sólo lo que se ACOTÓ de verdad.
   *
   * Una fila que dice «Cliente: todos los clientes» no informa: repite el valor
   * por defecto del control que está tres centímetros más arriba. Lo que vale
   * saber antes de generar es qué recortes están puestos — y, si no hay
   * ninguno, que no hay ninguno.
   *
   * Cliente, responsable y vendedor se resuelven contra el servidor de forma
   * asíncrona, así que acá se cuentan en vez de nombrarse: meter un fetch por
   * render dentro de una vista previa es pagar una consulta para adornar.
   */
  const applied: { label: string; value: string }[] = [];

  if (report.filters.includes("range")) {
    const span = dayspan(criteria.from, criteria.to);
    applied.push({
      label: "Período",
      value: `${shortDate(criteria.from)} — ${shortDate(criteria.to)}${span ? ` · ${span}` : ""}`,
    });
  }

  const narrowed: { label: string; value: string }[] = [];
  const pushIfSet = (key: ReportFilterKey, label: string, value: string, name: string) => {
    if (report.filters.includes(key) && value) narrowed.push({ label, value: name });
  };

  pushIfSet(
    "productLine",
    "Línea",
    criteria.productLineId,
    nameOf(reference.productLines, criteria.productLineId, "—"),
  );
  pushIfSet(
    "territory",
    "Territorio",
    criteria.territoryId,
    nameOf(reference.territories, criteria.territoryId, "—"),
  );
  pushIfSet(
    "clientType",
    "Tipo",
    criteria.clientType,
    nameOf(reference.clientTypes, criteria.clientType, "—"),
  );
  pushIfSet("client", "Cliente", criteria.clientId, "1 seleccionado");
  pushIfSet("responsible", "Responsable", criteria.responsibleStaffId, "1 seleccionado");
  pushIfSet("salesRep", "Vendedor", criteria.salesRepStaffId, "1 seleccionado");
  if (report.filters.includes("activeOnly") && criteria.activeOnly) {
    narrowed.push({ label: "Alcance", value: "Sólo activos" });
  }

  const rows = [...applied, ...narrowed];
  /* Hay recortes disponibles que nadie puso: vale decirlo. */
  const unnarrowed =
    narrowed.length === 0 && report.filters.filter((f) => f !== "range").length > 0;

  return (
    <section
      aria-label="Resumen del reporte"
      className="rounded-inset border border-line-soft bg-fill/60 p-4"
    >
      <h3 className="font-heading text-[10px] font-medium uppercase tracking-[0.07em] text-faint">
        Lo que vas a obtener
      </h3>

      <p className="mt-2 text-[13px] leading-relaxed text-brand-gray">{report.description}</p>

      {rows.length > 0 && (
        <dl className="mt-3.5 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 border-t border-line-soft pt-3">
          {rows.map((row) => (
            <div key={row.label} className="contents">
              <dt className="text-[12px] text-faint">{row.label}</dt>
              <dd className="text-[12px] font-medium tabular-nums text-ink">{row.value}</dd>
            </div>
          ))}
        </dl>
      )}

      {unnarrowed && (
        <p className="mt-3 text-[12px] leading-relaxed text-subtle">
          Sin más recortes: sale sobre todo lo que haya en ese período.
        </p>
      )}

      {/* Lo que el reporte NO acota. Es la mitad que ningún panel muestra y la
          que evita leer un número creyendo que responde a otra pregunta. */}
      {ignored.length > 0 && (
        <div className="mt-3.5 border-t border-line-soft pt-3">
          <p className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[12px] leading-relaxed text-subtle">
            <Minus aria-hidden className="h-3 w-3 shrink-0 text-faint" />
            <span className="text-faint">No acota por</span>
            <span className="text-subtle">
              {ignored.map((key) => FILTER_LABEL[key].toLowerCase()).join(" · ")}
            </span>
          </p>
        </div>
      )}

      {honored.length > 0 && ignored.length === 0 && (
        <p className="mt-3.5 flex items-center gap-1.5 border-t border-line-soft pt-3 text-[12px] text-subtle">
          <Check aria-hidden className="h-3 w-3 shrink-0 text-brand-green" />
          Acota por todos los criterios del panel.
        </p>
      )}
    </section>
  );
}
