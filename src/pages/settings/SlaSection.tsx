import { Pencil, Plus, Power, Star } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { ApiError } from "../../api/client";
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
import { useLocalPage } from "../../hooks/useLocalPage";
import { usePermissions } from "../../hooks/usePermissions";
import { humanizeMinutes, workdayMinutes } from "../../lib/sla";
import { PRIORITIES, type Holiday, type Priority, type SlaPolicy } from "../../types/settings";
import { ChipGroup, LoadErrorAlert, WarnNotice } from "./catalogSection";
import { freshCopy, staleClass, useSectionLoad } from "./catalogState";
import { SettingsLayout } from "./SettingsLayout";
import { SlaModal } from "./SlaModal";

type ChipKey = "todas" | "activas" | "inactivas";

const listPolicies = () => settingsApi.slaPolicies.list({ page: 1, pageSize: 100 });

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

  const [policies, setPolicies] = useState<SlaPolicy[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [priority, setPriority] = useState<Priority | "todas">("todas");
  const [chip, setChip] = useState<ChipKey>("todas");

  const [modal, setModal] = useState<"nueva" | SlaPolicy | null>(null);
  const [confirmation, setConfirmation] = useState<Omit<ConfirmDialogProps, "onClose"> | null>(null);

  const debouncedSearch = useDebouncedValue(search).trim().toLowerCase();

  const load = useCallback(async () => {
    const [policyPage, holidayPage] = await Promise.all([
      listPolicies(),
      settingsApi.holidays.list({ page: 1, pageSize: 100 }),
    ]);
    setPolicies(policyPage.items);
    setHolidays(holidayPage.items);
  }, []);

  const { status, isRefetching, error, reload, retry } = useSectionLoad(
    load,
    "No se pudieron cargar las políticas de SLA",
  );

  const all = policies;
  const activeCount = all.filter((policy) => policy.isActive).length;

  /** Prioridades que hoy no tienen ninguna política predeterminada activa. */
  const uncovered = useMemo(
    () =>
      PRIORITIES.filter(
        (value) =>
          !all.some((policy) => policy.priority === value && policy.isDefault && policy.isActive),
      ),
    [all],
  );

  const rows = all.filter((policy) => {
    const byChip =
      chip === "todas" ||
      (chip === "activas" && policy.isActive) ||
      (chip === "inactivas" && !policy.isActive);
    const byPriority = priority === "todas" || policy.priority === priority;
    const bySearch = debouncedSearch === "" || policy.name.toLowerCase().includes(debouncedSearch);
    return byChip && byPriority && bySearch;
  });

  const { page, pageSize, total, totalPages, pageRows, setPage, changePageSize } = useLocalPage(
    rows,
    JSON.stringify([debouncedSearch, priority, chip]),
  );

  async function makeDefault(policy: SlaPolicy) {
    setBusyId(policy.id);
    setActionError(null);
    try {
      const current = await freshCopy(listPolicies, policy);
      await settingsApi.slaPolicies.update(current.id, { ...toRequest(current), isDefault: true });
      await reload();
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
          const current = await freshCopy(listPolicies, policy);
          await settingsApi.slaPolicies.update(current.id, {
            ...toRequest(current),
            isActive: !current.isActive,
            isDefault: current.isActive ? false : current.isDefault,
          });
          await reload();
        } finally {
          setBusyId(null);
        }
      },
    });
  }

  return (
    <SettingsLayout
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

        <ChipGroup label="Filtrar por estado" ready={status === "ready"}>
          <FilterChip
            label="Todas"
            count={all.length}
            active={chip === "todas"}
            onClick={() => setChip("todas")}
          />
          <FilterChip
            label="Activas"
            count={activeCount}
            active={chip === "activas"}
            onClick={() => setChip("activas")}
          />
          <FilterChip
            label="Inactivas"
            count={all.length - activeCount}
            active={chip === "inactivas"}
            onClick={() => setChip("inactivas")}
          />
        </ChipGroup>
      </div>

      {error && <LoadErrorAlert message={error} onRetry={retry} />}

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

      {status === "loading" ? (
        <div className="flex justify-center py-16">
          <Spinner />
        </div>
      ) : status === "error" ? null : rows.length === 0 ? (
        <p className="py-14 text-center text-[13.5px] text-faint">
          {all.length === 0
            ? "Todavía no hay ninguna política de SLA configurada."
            : "Ninguna política coincide con este filtro o búsqueda."}
        </p>
      ) : (
        <div className={staleClass(isRefetching)}>
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
              {pageRows.map((policy) => (
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
                        <Star aria-hidden className="h-3.5 w-3.5 fill-muted text-muted" />
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

      {status === "ready" && rows.length > 0 && (
        <Pagination
          page={page}
          pageSize={pageSize}
          total={total}
          totalPages={totalPages}
          onPageChange={setPage}
          onPageSizeChange={changePageSize}
          noun="políticas"
        />
      )}

      <p className="mt-4 max-w-[76ch] text-[12px] leading-relaxed text-faint">
        La política se copia al ticket como dos fechas de vencimiento calculadas al crearlo, así que
        cambiarla no altera los tickets ya abiertos. El reloj se detiene mientras el ticket está en
        espera del cliente y se reanuda al volver a abierto.
      </p>

      {modal !== null && (
        <SlaModal
          policy={modal === "nueva" ? undefined : modal}
          holidays={holidays}
          onClose={() => setModal(null)}
          onSaved={() => {
            void reload();
          }}
        />
      )}

      {confirmation && <ConfirmDialog {...confirmation} onClose={() => setConfirmation(null)} />}
    </SettingsLayout>
  );
}
