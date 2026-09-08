import { BarChart3, Download, Lock, ShieldAlert, SlidersHorizontal } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ApiError } from "../../api/client";
import { fetchAllPages } from "../../api/paging";
import { productLinesApi } from "../../api/productLines";
import {
  reportsApi,
  type AuditReport,
  type AuditSliceReport,
  type ClientsReport,
  type QualityReport,
} from "../../api/reports";
import { territoriesApi } from "../../api/territories";
import { ModuleHeader } from "../../components/app/ModuleHeader";
import { Alert } from "../../components/ui/Alert";
import { Button } from "../../components/ui/Button";
import { Drawer } from "../../components/ui/Drawer";
import { Pagination } from "../../components/ui/Pagination";
import { usePermissions } from "../../hooks/usePermissions";
import type { Territory } from "../../types/clients";
import { REPORT_CATALOG, type ReportDefinition } from "../../types/reports";
import type { ProductLine } from "../../types/settings";
import { ReportFilters, type ReferenceData, type ReportCriteria } from "./ReportFilters";
import { AuditSliceResult, ClientsResult, QualityResult } from "./results";
import { defaultRange } from "./useDateRange";

/**
 * Generador de reportes.
 *
 * El recorrido es: pantalla vacia -> Generar reporte -> panel con el reporte y
 * sus criterios -> tarjetas de cifras y tabla de detalle. Nada se consulta al
 * entrar. La pantalla no adivina que reporte queria nadie, y no gasta dos
 * consultas agregadas en SQL para pintar algo que probablemente no era lo que
 * se venia a buscar.
 *
 * Reemplaza las siete secciones que colgaban del menu. Cuatro de aquellas
 * —Operacion, SLA, Productividad y Volumen— no tenian un solo dato: eran el
 * catalogo de lo que algun dia mostraran, y suponian cuatro de cada siete clics
 * terminando en una pared. Aqui lo bloqueado sigue visible en el selector, con
 * su motivo, pero deja de ocupar navegacion.
 *
 * El reporte generado viaja en `?reporte=`: es algo que la gente se pasa por
 * chat, y sin eso el enlace abria siempre la pantalla vacia.
 */

const DEFAULT_REPORT = "hca-por-periodo";

function emptyCriteria(): ReportCriteria {
  const range = defaultRange();
  return {
    from: range.from,
    to: range.to,
    clientId: "",
    productLineId: "",
    responsibleStaffId: "",
    territoryId: "",
    salesRepStaffId: "",
    clientType: "",
    activeOnly: false,
  };
}

const CLIENT_TYPES = ["Distribuidor", "Mayorista", "Detallista", "Institucional"].map((t) => ({
  value: t,
  label: t,
}));

type Payload =
  | { kind: "quality"; data: QualityReport }
  | { kind: "clients"; data: ClientsReport }
  | { kind: "audit"; data: AuditReport | AuditSliceReport };

function findReport(id: string | null): ReportDefinition {
  return (
    REPORT_CATALOG.find((entry) => entry.id === id && entry.blockedBy === null) ??
    REPORT_CATALOG.find((entry) => entry.id === DEFAULT_REPORT)!
  );
}

export function ReportsPage() {
  const { can } = usePermissions();
  const [searchParams, setSearchParams] = useSearchParams();
  const canRead = can("reports.read");

  // Un `?reporte=` en la direccion abre ya generado; sin el, la pantalla arranca
  // vacia. Es la diferencia entre entrar al modulo y abrir un enlace compartido.
  const linked = searchParams.get("reporte");

  const [report, setReport] = useState<ReportDefinition>(() => findReport(linked));
  const [criteria, setCriteria] = useState<ReportCriteria>(emptyCriteria);
  const [isPanelOpen, setPanelOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [payload, setPayload] = useState<Payload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [hasRun, setHasRun] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  /** Un fallo al exportar no invalida el reporte que se esta viendo: va aparte. */
  const [exportError, setExportError] = useState<string | null>(null);
  const [reference, setReference] = useState<ReferenceData>({
    productLines: [],
    territories: [],
    clientTypes: CLIENT_TYPES,
  });

  // Solo los catalogos acotados —lineas y territorios— se precargan, y enteros:
  // el corte de 200 dejaba fuera cualquiera que pasara de ahi. Cliente,
  // responsable y vendedor no se precargan: sus tres selectores buscan en el
  // servidor porque ni la cartera ni el personal tienen tope.
  useEffect(() => {
    if (!canRead) return;
    void Promise.all([
      fetchAllPages<ProductLine>((page, pageSize) => productLinesApi.list({ page, pageSize })),
      fetchAllPages<Territory>((page, pageSize) => territoriesApi.list({ page, pageSize })),
    ])
      .then(([lines, territories]) =>
        setReference({
          productLines: lines.map((l) => ({ value: String(l.id), label: l.name })),
          territories: territories.map((t) => ({ value: String(t.id), label: t.name })),
          clientTypes: CLIENT_TYPES,
        }),
      )
      // Un catalogo que no llega deja su selector vacio, y eso ya se ve. No es
      // motivo para tumbar la pantalla: el reporte se puede generar sin acotar.
      .catch(() => undefined);
  }, [canRead]);

  const num = (value: string) => (value === "" ? undefined : Number(value));

  const generate = useCallback(
    (target: ReportDefinition, values: ReportCriteria, atPage: number, size: number) => {
      setError(null);
      setIsGenerating(true);
      setHasRun(true);

      const run = (): Promise<Payload> => {
        switch (target.family) {
          case "calidad":
            return reportsApi
              .quality(values.from, values.to, {
                clientId: num(values.clientId),
                productLineId: num(values.productLineId),
                responsibleStaffId: num(values.responsibleStaffId),
              })
              .then((data) => ({ kind: "quality", data }) as Payload);
          case "clientes":
            return reportsApi
              .clients({
                territoryId: num(values.territoryId),
                salesRepStaffId: num(values.salesRepStaffId),
                type: values.clientType === "" ? undefined : values.clientType,
                activeOnly: values.activeOnly ? true : undefined,
              })
              .then((data) => ({ kind: "clients", data }) as Payload);
          default: {
            const slice =
              target.id === "accesos-por-usuario"
                ? reportsApi.auditLogins
                : target.id === "bajas-desactivaciones"
                  ? reportsApi.auditDeactivations
                  : target.id === "sesiones-revocadas"
                    ? reportsApi.auditRevokedSessions
                    : reportsApi.audit;
            return slice(values.from, values.to, atPage, size).then(
              (data) => ({ kind: "audit", data }) as Payload,
            );
          }
        }
      };

      run()
        .then(setPayload)
        .catch((err) =>
          setError(
            err instanceof ApiError
              ? err.message
              : "No se pudo generar el reporte. Vuelve a intentarlo.",
          ),
        )
        .finally(() => setIsGenerating(false));
    },
    [],
  );

  // Solo al abrir un enlace que ya trae reporte. Entrar al modulo sin `?reporte=`
  // deja la pantalla vacia, que es el primer paso del recorrido.
  useEffect(() => {
    if (canRead && linked !== null) generate(findReport(linked), emptyCriteria(), 1, 25);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canRead]);

  function applyFromPanel() {
    setPanelOpen(false);
    setPage(1);
    const next = new URLSearchParams(searchParams);
    next.set("reporte", report.id);
    setSearchParams(next, { replace: true });
    generate(report, criteria, 1, pageSize);
  }

  function changePage(next: number) {
    setPage(next);
    generate(report, criteria, next, pageSize);
  }

  function changePageSize(size: number) {
    setPageSize(size);
    setPage(1);
    generate(report, criteria, 1, size);
  }

  /**
   * El CSV lo arma el servidor sobre el conjunto filtrado COMPLETO, no sobre la
   * pagina cargada. La version anterior serializaba `payload.data.items` --lo
   * que ya estaba en memoria-- mientras la pantalla invitaba a exportar «para
   * llevarte el período completo»: el archivo decia una cosa y el texto otra.
   *
   * El nombre lo pone Content-Disposition; el de aqui solo cubre el caso de que
   * esa cabecera no llegue.
   */
  async function exportCsv() {
    setExportError(null);
    setIsExporting(true);
    try {
      const stamp = report.filters.includes("range") ? `_${criteria.from}_${criteria.to}` : "";
      await reportsApi.exportCsv(
        report.id,
        {
          from: report.filters.includes("range") ? criteria.from : undefined,
          to: report.filters.includes("range") ? criteria.to : undefined,
          clientId: num(criteria.clientId),
          productLineId: num(criteria.productLineId),
          responsibleStaffId: num(criteria.responsibleStaffId),
          territoryId: num(criteria.territoryId),
          salesRepStaffId: num(criteria.salesRepStaffId),
          type: criteria.clientType === "" ? undefined : criteria.clientType,
          activeOnly: criteria.activeOnly ? true : undefined,
        },
        `${report.id}${stamp}.csv`,
      );
    } catch (err) {
      setExportError(
        err instanceof ApiError
          ? `${err.message} Vuelve a intentarlo.`
          : "No se pudo exportar el CSV. Vuelve a intentarlo.",
      );
    } finally {
      setIsExporting(false);
    }
  }

  if (!canRead) {
    return (
      <div>
        <ModuleHeader />
        <div className="flex items-start gap-2.5 py-8">
          <ShieldAlert aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-faint" />
          <p className="max-w-[76ch] text-[13.5px] leading-relaxed text-subtle">
            No tienes el permiso <span className="font-mono text-[10.5px] text-faint">reports.read</span>,
            necesario para consultar los reportes. Pídelo al administrador del panel.
          </p>
        </div>
      </div>
    );
  }

  const available = REPORT_CATALOG.filter((entry) => entry.blockedBy === null).length;
  const blocked = REPORT_CATALOG.length - available;

  return (
    <div>
      <ModuleHeader
        summary={hasRun ? report.name : undefined}
        action={
          hasRun && (
            <div className="flex items-center gap-2">
              <Button size="sm" variant="secondary" onClick={() => setPanelOpen(true)}>
                <SlidersHorizontal className="h-[15px] w-[15px]" />
                Cambiar criterios
              </Button>
              {payload !== null && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => void exportCsv()}
                  isLoading={isExporting}
                >
                  <Download className="h-[15px] w-[15px]" />
                  {isExporting ? "Exportando…" : "Exportar CSV"}
                </Button>
              )}
            </div>
          )
        }
      />

      {/* Paso 1: la pantalla vacia. No es un hueco por falta de datos, es el
          punto de partida, y por eso dice que hacer en vez de disculparse. */}
      {!hasRun && (
        <div className="flex flex-col items-center justify-center gap-4 py-24 text-center">
          <span
            aria-hidden
            className="flex h-12 w-12 items-center justify-center rounded-card bg-fill text-faint"
          >
            <BarChart3 className="h-5 w-5" />
          </span>
          <div>
            <h2 className="font-heading text-[17px] font-bold tracking-[-0.01em] text-ink">
              Todavía no has generado ningún reporte
            </h2>
            <p className="mx-auto mt-1.5 max-w-[54ch] text-[13.5px] leading-relaxed text-subtle">
              Elige cuál quieres y con qué criterios —período, cliente, territorio, vendedor— y el
              panel lo calcula sobre los datos de hoy.
            </p>
          </div>
          <Button onClick={() => setPanelOpen(true)}>Generar reporte</Button>
          <p className="flex items-center gap-1.5 text-[12px] text-faint">
            <Lock aria-hidden className="h-3.5 w-3.5" />
            {available} disponibles · {blocked} esperando la Bandeja de tickets
          </p>
        </div>
      )}

      {hasRun && (
        <>
          {error && (
            <div className="mb-4 flex flex-wrap items-center gap-3">
              <div className="min-w-[240px] flex-1">
                <Alert variant="error">{error}</Alert>
              </div>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => generate(report, criteria, page, pageSize)}
                disabled={isGenerating}
              >
                Reintentar
              </Button>
            </div>
          )}

          {exportError && (
            <div className="mb-4">
              <Alert variant="error">{exportError}</Alert>
            </div>
          )}

          {payload === null && error === null && (
            <div aria-hidden className="h-[220px] animate-pulse rounded-card bg-fill" />
          )}

          <div className={isGenerating ? "opacity-60" : ""}>
            {payload?.kind === "quality" && (
              <QualityResult report={report} data={payload.data} criteria={criteria} />
            )}
            {payload?.kind === "clients" && <ClientsResult report={report} data={payload.data} />}
            {payload?.kind === "audit" && (
              <>
                <AuditSliceResult report={report} data={payload.data} criteria={criteria} />
                {payload.data.total > 0 && (
                  <div className="mt-3">
                    <Pagination
                      page={payload.data.page}
                      pageSize={payload.data.pageSize}
                      total={payload.data.total}
                      totalPages={payload.data.totalPages}
                      onPageChange={changePage}
                      onPageSizeChange={changePageSize}
                      noun="entradas"
                      nounSingular="entrada"
                    />
                  </div>
                )}
              </>
            )}
          </div>
        </>
      )}

      {isPanelOpen && (
        <Drawer
          eyebrow="Reportes"
          title="Generar reporte"
          description="Elige el reporte y acota lo que quieras medir."
          onClose={() => setPanelOpen(false)}
          footer={
            <>
              <Button variant="secondary" onClick={() => setCriteria(emptyCriteria())}>
                Limpiar
              </Button>
              <Button onClick={applyFromPanel} isLoading={isGenerating}>
                Generar reporte
              </Button>
            </>
          }
        >
          <ReportFilters
            report={report}
            onSelectReport={(id) => {
              // Cambiar de reporte limpia los criterios: los del anterior podian
              // no existir siquiera en el nuevo, y arrastrar un territorio a un
              // reporte de HCA no acota nada pero deja creer que si.
              setReport(findReport(id));
              setCriteria(emptyCriteria());
            }}
            criteria={criteria}
            onChange={setCriteria}
            reference={reference}
          />
        </Drawer>
      )}
    </div>
  );
}
