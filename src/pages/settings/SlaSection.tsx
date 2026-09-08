import { Pencil, Plus, Power, Star } from "lucide-react";
import { useState } from "react";
import { ApiError } from "../../api/client";
import { fetchAllPages } from "../../api/paging";
import { settingsApi } from "../../api/settings";
import { Alert } from "../../components/ui/Alert";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { ConfirmDialog, type ConfirmDialogProps } from "../../components/ui/ConfirmDialog";
import { DataTable, HeadRow, Row, Td, Th } from "../../components/ui/DataTable";
import { FilterChip } from "../../components/ui/FilterChip";
import { RowAction } from "../../components/ui/RowAction";
import { SearchInput } from "../../components/ui/SearchInput";
import { Select } from "../../components/ui/Select";
import { Pagination } from "../../components/ui/Pagination";
import { Spinner } from "../../components/ui/Spinner";
import { StatusDot } from "../../components/ui/StatusDot";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";
import { usePagedList } from "../../hooks/usePagedList";
import { usePermissions } from "../../hooks/usePermissions";
import { humanizeMinutes, workdayMinutes } from "../../lib/sla";
import { PRIORITIES, type Holiday, type Priority, type SlaPolicy } from "../../types/settings";
import { ChipGroup, LoadErrorAlert, WarnNotice } from "./catalogSection";
import { freshCopy, staleClass, useReferenceData } from "./catalogState";
import { SettingsLayout } from "./SettingsLayout";
import { SlaModal } from "./SlaModal";

type ChipKey = "todas" | "activas" | "inactivas";

/**
 * Prioridades sin política predeterminada activa. Se pregunta por prioridad y se
 * recorre el catálogo entero: con el tope fijo de cien, la política
 * predeterminada de una prioridad con muchas activas caía fuera de la consulta y
 * la sección avisaba de una falta que no existía.
 */
async function loadUncovered(): Promise<Priority[]> {
  const covered = await Promise.all(
    PRIORITIES.map((priority) =>
      fetchAllPages((page, pageSize) =>
        settingsApi.slaPolicies.list({ page, pageSize, priority, status: "activas" }),
      ).then((items) => items.some((policy) => policy.isDefault)),
    ),
  );

  return PRIORITIES.filter((_, index) => !covered[index]);
}

/**
 * El calendario que el diálogo usa para previsualizar vencimientos. Se pide
 * entero: un feriado que no cupiera en la primera página desaparecía del
 * cálculo sin decirlo, y el vencimiento previsto salía mal.
 */
const loadHolidays = () =>
  fetchAllPages<Holiday>((page, pageSize) =>
    settingsApi.holidays.list({ page, pageSize, status: "activos" }),
  );

/** Cuerpo del PUT: el identificador viaja en la ruta, nunca en el DTO. */
function toRequest(policy: SlaPolicy): Omit<SlaPolicy, "id"> {
  return {
    name: policy.name,
    priority: policy.priority,
    firstResponseMinutes: policy.firstResponseMinutes,
    resolutionMinutes: policy.resolutionMinutes,
    businessHoursOnly: policy.businessHoursOnly,
    workdayStart: policy.workdayStart,
    workdayEnd: policy.workdayEnd,
    workDays: policy.workDays,
    isDefault: policy.isDefault,
    isActive: policy.isActive,
  };
}

export function SlaSection() {
  const { can } = usePermissions();
  const canWrite = can("settings.write");

  const [busyId, setBusyId] = useState<number | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [priority, setPriority] = useState<Priority | "todas">("todas");
  const [chip, setChip] = useState<ChipKey>("todas");
  const [pageSize, setPageSize] = useState(10);

  const [modal, setModal] = useState<"nueva" | SlaPolicy | null>(null);
  const [confirmation, setConfirmation] = useState<Omit<ConfirmDialogProps, "onClose"> | null>(null);

  const debouncedSearch = useDebouncedValue(search).trim();

  // Seccion 4.1: la pagina, el filtro, la busqueda y los contadores los resuelve
  // SQL. La vista solo dibuja lo que llega.
  const { data, isStale, error, page, setPage, refresh } = usePagedList({
    fetch: settingsApi.slaPolicies.list,
    criteria: {
      pageSize,
      search: debouncedSearch || undefined,
      status: chip === "todas" ? undefined : chip,
      priority: priority === "todas" ? undefined : priority,
    },
    fallbackError: "No se pudieron cargar las políticas de SLA",
  });

  const uncoveredRef = useReferenceData<Priority[]>(loadUncovered, []);
  const uncovered = uncoveredRef.data;

  const holidaysRef = useReferenceData<Holiday[]>(loadHolidays, []);
  const holidays = holidaysRef.data;

  const rows = data?.items ?? [];
  const counts = data?.counts;
  const isFirstLoad = data === null && error === null;
  // Sin criterio activo, una pagina vacia significa catalogo vacio; con
  // criterio, que nada coincide. Los contadores no distinguen ese caso: se
  // calculan sobre el filtro base, no sobre la tabla entera.
  const isFiltering = debouncedSearch !== "" || chip !== "todas" || priority !== "todas";

  /** Marcar o desactivar una predeterminada cambia la cobertura: se relee. */
  function reloadAll() {
    refresh();
    uncoveredRef.reload();
  }

  async function makeDefault(policy: SlaPolicy) {
    setBusyId(policy.id);
    setActionError(null);
    try {
      const current = await freshCopy(settingsApi.slaPolicies.get, policy);
      await settingsApi.slaPolicies.update(current.id, { ...toRequest(current), isDefault: true });
      reloadAll();
    } catch (err) {
      setActionError(
        err instanceof ApiError ? err.message : "No se pudo marcar como predeterminada",
      );
    } finally {
      setBusyId(null);
    }
  }

  /**
   * RF-K5: cada prioridad necesita una política predeterminada. Desactivar la
   * última de su prioridad dejaría sin compromiso de tiempo a todo ticket que
   * nazca con ella — el servidor lo rechaza con 409 y ese mensaje es el que se
   * muestra, sin duplicar la regla aquí.
   */
  function askToggle(policy: SlaPolicy) {
    setConfirmation({
      tone: "warn",
      icon: Power,
      title: policy.isActive ? "Desactivar política" : "Reactivar política",
      description: policy.isActive ? (
        <>
          <strong className="font-semibold text-ink">{policy.name}</strong> deja de aplicarse a
          tickets nuevos. Los ya abiertos conservan las fechas que se les calcularon al crearlos.
        </>
      ) : (
        <>
          <strong className="font-semibold text-ink">{policy.name}</strong> vuelve a estar disponible
          para asignarse a motivos y a tickets nuevos.
        </>
      ),
      confirmLabel: policy.isActive ? "Desactivar" : "Reactivar",
      onConfirm: async () => {
        setBusyId(policy.id);
        try {
          const current = await freshCopy(settingsApi.slaPolicies.get, policy);
          await settingsApi.slaPolicies.update(current.id, {
            ...toRequest(current),
            isActive: !current.isActive,
            isDefault: current.isActive ? false : current.isDefault,
          });
          reloadAll();
        } finally {
          setBusyId(null);
        }
      },
    });
  }

  return (
    <SettingsLayout
      title="Políticas de SLA"
      note="La política se copia al ticket como dos fechas de vencimiento calculadas al crearlo, así que cambiarla no altera los tickets ya abiertos. El reloj se detiene mientras el ticket está en espera del cliente y se reanuda al volver a abierto."
      action={
        canWrite && (
          <Button size="sm" onClick={() => setModal("nueva")} disabled={busyId !== null}>
            <Plus className="h-[15px] w-[15px]" />
            Nueva política
          </Button>
        )
      }
    >
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Buscar política…"
          className="w-[240px]"
        />

        <Select
          size="sm"
          className="w-[200px]"
          aria-label="Filtrar por prioridad"
          value={priority}
          onChange={(value) => setPriority(value as Priority | "todas")}
          options={[
            { value: "todas", label: "Todas las prioridades" },
            ...PRIORITIES.map((value) => ({ value, label: value })),
          ]}
        />

        <span aria-hidden className="mx-1 h-5 w-px bg-line" />

        <ChipGroup label="Filtrar por estado" ready={counts !== undefined}>
          <FilterChip
            label="Todas"
            count={counts?.all ?? 0}
            active={chip === "todas"}
            onClick={() => setChip("todas")}
          />
          <FilterChip
            label="Activas"
            count={counts?.active ?? 0}
            active={chip === "activas"}
            onClick={() => setChip("activas")}
          />
          <FilterChip
            label="Inactivas"
            count={counts?.inactive ?? 0}
            active={chip === "inactivas"}
            onClick={() => setChip("inactivas")}
          />
        </ChipGroup>
      </div>

      {error && <LoadErrorAlert message={error} onRetry={refresh} />}

      {actionError && (
        <div className="mb-3">
          <Alert variant="error">{actionError}</Alert>
        </div>
      )}

      {uncovered.length > 0 && (
        <div className="mb-3">
          <WarnNotice>
            Sin política predeterminada activa para{" "}
            {uncovered.map((value) => value.toLowerCase()).join(", ")}. Un ticket que nazca con esa
            prioridad no tendría compromiso de tiempo.
          </WarnNotice>
        </div>
      )}

      {isFirstLoad ? (
        <div className="flex justify-center py-16">
          <Spinner />
        </div>
      ) : data === null ? null : rows.length === 0 ? (
        <p className="py-14 text-center text-[13.5px] text-faint">
          {isFiltering
            ? "Ninguna política coincide con este filtro o búsqueda."
            : "Todavía no hay ninguna política de SLA configurada."}
        </p>
      ) : (
        <div className={staleClass(isStale)}>
          <DataTable>
            <thead>
              <HeadRow>
                <Th>Política</Th>
                <Th>Prioridad</Th>
                <Th>1ª respuesta</Th>
                <Th>Resolución</Th>
                <Th>Reloj</Th>
                <Th>Predeterminada</Th>
                <Th>Estado</Th>
                {canWrite && <Th className="w-24 text-right">Acciones</Th>}
              </HeadRow>
            </thead>

            <tbody>
              {rows.map((policy) => (
                <Row key={policy.id} busy={busyId === policy.id}>
                  <Td className="text-[12.5px] font-medium text-ink">{policy.name}</Td>
                  <Td>
                    <Badge tone={policy.priority === "Emergencia" ? "red" : "neutral"}>
                      {policy.priority}
                    </Badge>
                  </Td>
                  <Td className="text-[12.5px] tabular-nums text-brand-gray">
                    {humanizeMinutes(policy.firstResponseMinutes, workdayMinutes(policy))}
                  </Td>
                  <Td className="text-[12.5px] tabular-nums text-brand-gray">
                    {humanizeMinutes(policy.resolutionMinutes, workdayMinutes(policy))}
                  </Td>
                  <Td className="text-[12.5px] text-brand-gray">
                    {policy.businessHoursOnly ? (
                      <span className="flex flex-col gap-0.5">
                        <span className="leading-tight">Solo jornada</span>
                        <span className="text-[11px] leading-tight tabular-nums text-faint">
                          {policy.workdayStart}–{policy.workdayEnd} · {policy.workDays.join("")}
                        </span>
                      </span>
                    ) : (
                      "Continuo"
                    )}
                  </Td>
                  <Td>
                    {policy.isDefault ? (
                      <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-[12.5px] font-medium text-ink">
                        {/* Marcador de estado, no accion: el rojo 185 C esta
                            reservado a la primaria y al estado activo. */}
                        <Star aria-hidden className="h-3.5 w-3.5 fill-subtle text-subtle" />
                        De {policy.priority.toLowerCase()}
                      </span>
                    ) : (
                      <span className="text-[12.5px] text-faint">—</span>
                    )}
                  </Td>
                  <Td>
                    <StatusDot active={policy.isActive} />
                  </Td>
                  {canWrite && (
                    <Td>
                      <div className="flex items-center justify-end gap-1">
                        {!policy.isDefault && policy.isActive && (
                          <RowAction
                            label={`Hacer predeterminada de ${policy.priority.toLowerCase()}: ${policy.name}`}
                            icon={Star}
                            onClick={() => makeDefault(policy)}
                            disabled={busyId === policy.id}
                          />
                        )}
                        <RowAction
                          label={`Editar ${policy.name}`}
                          icon={Pencil}
                          onClick={() => setModal(policy)}
                          disabled={busyId === policy.id}
                        />
                        <RowAction
                          label={
                            policy.isActive
                              ? `Desactivar ${policy.name}`
                              : `Reactivar ${policy.name}`
                          }
                          icon={Power}
                          onClick={() => askToggle(policy)}
                          disabled={busyId === policy.id}
                        />
                      </div>
                    </Td>
                  )}
                </Row>
              ))}
            </tbody>
          </DataTable>
        </div>
      )}

      {data !== null && data.total > 0 && (
        <Pagination
          page={page}
          pageSize={pageSize}
          total={data.total}
          totalPages={data.totalPages}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
          noun="políticas"
        />
      )}


      {modal !== null && (
        <SlaModal
          policy={modal === "nueva" ? undefined : modal}
          holidays={holidays}
          onClose={() => setModal(null)}
          onSaved={reloadAll}
        />
      )}

      {confirmation && <ConfirmDialog {...confirmation} onClose={() => setConfirmation(null)} />}
    </SettingsLayout>
  );
}
