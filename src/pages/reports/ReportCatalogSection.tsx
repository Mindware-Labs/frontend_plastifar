import { REPORT_CATALOG, REPORT_FAMILIES, type ReportFamily } from "../../types/reports";
import { BlockedReports } from "./BlockedReports";
import { ReportsLayout } from "./ReportsLayout";

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
 *
 * Sin barra de fechas: no habia nada que acotar. Un rango que se puede cambiar
 * y no cambia nada es la promesa mas falsa que podia hacer esta pantalla.
 */
export function ReportCatalogSection({ family, blockedBy }: ReportCatalogSectionProps) {
  const familyInfo = REPORT_FAMILIES.find((entry) => entry.key === family);
  const reports = REPORT_CATALOG.filter((report) => report.family === family);

  // Una ruta con una familia sin registrar no puede tumbar la pantalla.
  const label = familyInfo?.label ?? "Esta familia de reportes";

  return (
    <ReportsLayout>
      <BlockedReports
        note={
          <>
            Los reportes de <strong className="font-medium text-ink">{label}</strong> se calculan
            sobre <strong className="font-medium text-ink">{blockedBy}</strong>, que todavía no
            existe. El cálculo real llega en cuanto ese módulo registre datos; mientras tanto, este
            es el catálogo completo de lo que va a mostrar.
          </>
        }
        reports={reports}
      />
    </ReportsLayout>
  );
}
