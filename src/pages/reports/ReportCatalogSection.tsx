import { Lock } from "lucide-react";
import { Button } from "../../components/ui/Button";
import { REPORT_CATALOG, REPORT_FAMILIES, type ReportFamily } from "../../types/reports";
import { DateRangeBar } from "./DateRangeBar";
import { ReportsLayout } from "./ReportsLayout";
import { useDateRange } from "./useDateRange";

interface ReportCatalogSectionProps {
  family: ReportFamily;
  /** Que necesita existir antes de poder calcular estos reportes de verdad. */
  blockedBy: string;
}

/**
 * Las cinco familias que agregan sobre datos que otro modulo todavia no
 * escribe (Tickets, Calidad, Auditoria de escritura). Se muestra el catalogo
 * completo -para que se vea el alcance real del modulo- sin inventar cifras
 * que hoy no hay como sostener.
 */
export function ReportCatalogSection({ family, blockedBy }: ReportCatalogSectionProps) {
  const { range, setRange } = useDateRange();
  const familyInfo = REPORT_FAMILIES.find((entry) => entry.key === family)!;
  const reports = REPORT_CATALOG.filter((report) => report.family === family);

  return (
    <ReportsLayout>
      <DateRangeBar range={range} onChange={setRange} />

      <div className="mb-3 flex items-start gap-2.5 border border-dashed border-line-strong bg-canvas px-3.5 py-3">
        <Lock aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-faint" />
        <p className="text-[12.5px] leading-relaxed text-muted">
          {familyInfo.label} agrega sobre <strong className="font-medium text-ink">{blockedBy}</strong>,
          que todavía no existe. El cálculo real llega en cuanto ese módulo registre datos; mientras
          tanto, este es el catálogo completo de lo que va a mostrar.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        {reports.map((report) => (
          <div
            key={report.id}
            className="flex flex-col gap-1.5 border border-line-soft px-4 py-3.5"
          >
            <span className="text-[13px] font-medium leading-tight text-ink">{report.name}</span>
            <span className="text-[12px] leading-relaxed text-faint">{report.description}</span>
            <Button variant="ghost" size="sm" disabled className="mt-1 self-start">
              Vista previa pendiente
            </Button>
          </div>
        ))}
      </div>
    </ReportsLayout>
  );
}
