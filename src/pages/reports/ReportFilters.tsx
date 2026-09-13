import { Lock } from "lucide-react";
import { ReportPreview } from "./ReportPreview";
import { useId } from "react";
import { LookupField, SelectField, TextField } from "../../components/ui/Field";
import {
  resolveClientLabel,
  resolveStaffLabel,
  searchActiveStaff,
  searchClients,
} from "../../lib/lookups";
import {
  REPORT_CATALOG,
  REPORT_FAMILIES,
  type ReportDefinition,
  type ReportFilterKey,
} from "../../types/reports";
import { MAX_RANGE_MONTHS, maxToFor, minFromFor } from "./useDateRange";

/** Todo lo que el generador puede acotar. Cada reporte usa solo lo suyo. */
export interface ReportCriteria {
  from: string;
  to: string;
  clientId: string;
  productLineId: string;
  responsibleStaffId: string;
  territoryId: string;
  salesRepStaffId: string;
  clientType: string;
  activeOnly: boolean;
}

export interface ReferenceOption {
  value: string;
  label: string;
}

/**
 * Solo catalogos acotados. Cliente, responsable y vendedor no estan aqui a
 * proposito: se buscan en el servidor con `LookupField`, porque ni la cartera de
 * clientes ni el personal caben en una lista precargada.
 */
export interface ReferenceData {
  productLines: ReferenceOption[];
  territories: ReferenceOption[];
  clientTypes: ReferenceOption[];
}

interface ReportFiltersProps {
  report: ReportDefinition;
  onSelectReport: (id: string) => void;
  criteria: ReportCriteria;
  onChange: (criteria: ReportCriteria) => void;
  reference: ReferenceData;
}

const ANY = "";

/**
 * Cuerpo del panel: que reporte y con que criterios.
 *
 * Los criterios se arman desde `report.filters` en vez de pintarlos todos. Un
 * control que el servidor ignora es peor que no tenerlo: quien lo mueve cree
 * que acoto y termina leyendo un numero que responde a otra pregunta.
 */
export function ReportFilters({
  report,
  onSelectReport,
  criteria,
  onChange,
  reference,
}: ReportFiltersProps) {
  const id = useId();
  const has = (key: ReportFilterKey) => report.filters.includes(key);
  const set = (patch: Partial<ReportCriteria>) => onChange({ ...criteria, ...patch });

  const reportOptions = REPORT_FAMILIES.flatMap((family) => {
    const entries = REPORT_CATALOG.filter((entry) => entry.family === family.key);
    return [
      // El Select del panel no monta optgroup: el rotulo de familia viaja como
      // una opcion desactivada, que es como se agrupa aqui.
      { value: `__${family.key}`, label: `— ${family.label} —`, disabled: true },
      ...entries.map((entry) => ({
        value: entry.id,
        label:
          entry.blockedBy === null ? `   ${entry.name}` : `   ${entry.name} · aún no disponible`,
        disabled: entry.blockedBy !== null,
      })),
    ];
  });

  const family = REPORT_FAMILIES.find((entry) => entry.key === report.family);
  /* Los recortes que este reporte SI honra, sin contar el periodo: es lo que
     decide si la seccion «Acotar» tiene algo que ofrecer. */
  const narrowers = report.filters.filter((key) => key !== "range");

  return (
    <div className="flex min-h-full flex-col gap-5">
      {/*
        ELEGIR EL REPORTE NO ES UN CAMPO MAS.

        Los cinco controles se apilaban identicos, asi que la decision que
        gobierna la pantalla —cual de los 33 reportes, repartidos en 7 familias—
        pesaba lo mismo que «Tipo de cliente», que es un recorte opcional. Y es
        al reves: el reporte decide QUE se mide y ademas decide que recortes
        existen; los demas controles solo aparecen porque el reporte los admite.

        Aca encabeza el panel con su propia superficie, su familia arriba y su
        descripcion debajo: se lee como una decision tomada, no como el primero
        de una lista de cinco.
      */}
      <div className="rounded-inset border border-line bg-fill/50 p-3.5">
        {family && (
          <p className="mb-2 font-heading text-[10px] font-semibold uppercase tracking-[0.07em] text-faint">
            {family.label}
          </p>
        )}
        <SelectField
          label="Reporte"
          id={`${id}-reporte`}
          value={report.id}
          onChange={onSelectReport}
          options={reportOptions}
        />
        <p className="mt-2 text-[12.5px] leading-relaxed text-brand-gray">{report.description}</p>
      </div>

      {/* Un rotulo antes de los recortes. Sin el, «Cliente» y «Territorio» se
          leian como datos que el reporte PIDE, cuando son opcionales: en blanco
          significan «todos», y eso no se deducia de ningun sitio. */}
      {(has("range") || narrowers.length > 0) && (
        <p className="-mb-1 font-heading text-[10px] font-semibold uppercase tracking-[0.07em] text-faint">
          Acotar
          {narrowers.length > 0 && (
            <span className="ml-2 font-body text-[11.5px] font-normal normal-case tracking-normal text-faint">
              lo que dejes en blanco no recorta
            </span>
          )}
        </p>
      )}

      {has("range") && (
        <div className="grid grid-cols-2 gap-3">
          <TextField
            label="Desde"
            id={`${id}-desde`}
            type="date"
            value={criteria.from}
            min={minFromFor(criteria.to)}
            max={criteria.to}
            onChange={(event) => set({ from: event.target.value })}
          />
          <TextField
            label="Hasta"
            id={`${id}-hasta`}
            type="date"
            value={criteria.to}
            min={criteria.from}
            max={maxToFor(criteria.from)}
            hint={`Máximo ${MAX_RANGE_MONTHS} meses.`}
            onChange={(event) => set({ to: event.target.value })}
          />
        </div>
      )}

      {has("client") && (
        <LookupField
          label="Cliente"
          id={`${id}-cliente`}
          value={criteria.clientId}
          onChange={(value) => set({ clientId: value })}
          placeholder="Todos los clientes"
          searchPlaceholder="Buscar cliente…"
          clearLabel="Todos los clientes"
          search={searchClients}
          resolveSelectedLabel={resolveClientLabel}
        />
      )}

      {has("productLine") && (
        <SelectField
          label="Línea de producto"
          id={`${id}-linea`}
          value={criteria.productLineId}
          onChange={(value) => set({ productLineId: value })}
          options={[{ value: ANY, label: "Todas las líneas" }, ...reference.productLines]}
        />
      )}

      {has("responsible") && (
        <LookupField
          label="Responsable"
          id={`${id}-responsable`}
          value={criteria.responsibleStaffId}
          onChange={(value) => set({ responsibleStaffId: value })}
          placeholder="Cualquiera"
          searchPlaceholder="Buscar responsable…"
          clearLabel="Cualquiera"
          search={searchActiveStaff}
          resolveSelectedLabel={resolveStaffLabel}
        />
      )}

      {has("territory") && (
        <SelectField
          label="Territorio"
          id={`${id}-territorio`}
          value={criteria.territoryId}
          onChange={(value) => set({ territoryId: value })}
          options={[{ value: ANY, label: "Todos los territorios" }, ...reference.territories]}
        />
      )}

      {has("salesRep") && (
        <LookupField
          label="Vendedor"
          id={`${id}-vendedor`}
          value={criteria.salesRepStaffId}
          onChange={(value) => set({ salesRepStaffId: value })}
          placeholder="Todos los vendedores"
          searchPlaceholder="Buscar vendedor…"
          clearLabel="Todos los vendedores"
          search={searchActiveStaff}
          resolveSelectedLabel={resolveStaffLabel}
        />
      )}

      {has("clientType") && (
        <SelectField
          label="Tipo de cliente"
          id={`${id}-tipo`}
          value={criteria.clientType}
          onChange={(value) => set({ clientType: value })}
          options={[{ value: ANY, label: "Todos los tipos" }, ...reference.clientTypes]}
        />
      )}

      {has("activeOnly") && (
        <label className="flex items-center gap-2.5 text-[13px] text-brand-gray">
          <input
            type="checkbox"
            checked={criteria.activeOnly}
            onChange={(event) => set({ activeOnly: event.target.checked })}
            className="h-4 w-4 rounded-edge border-line-strong accent-brand-red"
          />
          Solo clientes activos
        </label>
      )}

      {/* La vista previa cierra el panel: despues de acotar, dice que va a
          traer eso que se acaba de acotar. Va al final y no arriba porque se
          lee DESPUES de elegir, no antes.

          `mt-auto` la ancla al fondo del cuerpo. Con pocos criterios —y la
          mayoria de los reportes tienen dos o tres— quedaban 182 px de aire
          muerto entre ella y el pie, y la consecuencia de lo que acabas de
          acotar se leia lejos del boton que la ejecuta. Pegada abajo, la
          frase y la accion se miran. */}
      <div className="mt-auto pt-1">
        <ReportPreview report={report} criteria={criteria} reference={reference} />
      </div>

      {report.filters.length === 0 && (
        <p className="flex items-start gap-2 border-l-[3px] border-line-strong bg-fill px-3 py-2.5 text-[12.5px] leading-relaxed text-subtle">
          <Lock aria-hidden className="mt-px h-3.5 w-3.5 shrink-0 text-faint" />
          <span>Este reporte no admite criterios: se calcula sobre todo lo que haya.</span>
        </p>
      )}
    </div>
  );
}
