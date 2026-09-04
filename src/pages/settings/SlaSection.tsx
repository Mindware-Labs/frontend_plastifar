import { Pencil, Plus, Power, Star } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Alert } from "../../components/ui/Alert";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { ConfirmDialog, type ConfirmDialogProps } from "../../components/ui/ConfirmDialog";
import { DataTable, HeadRow, Row, Td, Th } from "../../components/ui/DataTable";
import { FilterChip } from "../../components/ui/FilterChip";
import { RowAction } from "../../components/ui/RowAction";
import { SearchInput } from "../../components/ui/SearchInput";
import { Pagination } from "../../components/ui/Pagination";
import { Spinner } from "../../components/ui/Spinner";
import { StatusDot } from "../../components/ui/StatusDot";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";
import { useLocalPage } from "../../hooks/useLocalPage";
import { upsertById } from "../../lib/catalog";
import { usePermissions } from "../../hooks/usePermissions";
import { humanizeMinutes, workdayMinutes } from "../../lib/sla";
import { settingsMock } from "../../mocks/settings";
import { PRIORITIES, type Holiday, type Priority, type SlaPolicy } from "../../types/settings";
import { SettingsLayout } from "./SettingsLayout";
import { SlaModal } from "./SlaModal";

export function SlaSection() {
  const { can } = usePermissions();
  const canWrite = can("settings.write");

  const [policies, setPolicies] = useState<SlaPolicy[] | null>(null);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [priority, setPriority] = useState<Priority | "todas">("todas");

  const [modal, setModal] = useState<"nueva" | SlaPolicy | null>(null);
  const [confirmation, setConfirmation] = useState<Omit<ConfirmDialogProps, "onClose"> | null>(null);

  const debouncedSearch = useDebouncedValue(search).trim().toLowerCase();

  useEffect(() => {
    Promise.all([settingsMock.policies(), settingsMock.holidays()])
      .then(([loadedPolicies, loadedHolidays]) => {
        setPolicies(loadedPolicies);
        setHolidays(loadedHolidays);
      })
      .catch(() => setError("No se pudieron cargar las políticas de SLA"));
  }, []);

  const all = useMemo(() => policies ?? [], [policies]);

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
    const byPriority = priority === "todas" || policy.priority === priority;
    const bySearch = debouncedSearch === "" || policy.name.toLowerCase().includes(debouncedSearch);
    return byPriority && bySearch;
  });

  // RF-K2: los listados de catalogo paginan como cualquier otro. El corte
  // lo hace la vista solo mientras no exista /api/settings/...; el endpoint
  // devuelve la pagina ya cortada en SQL (anexo 12.1).
  const { page, pageSize, total, totalPages, pageRows, setPage, changePageSize } =
    useLocalPage(rows, JSON.stringify([debouncedSearch, priority]));

  function upsert(item: SlaPolicy) {
    setPolicies((previous) => {
      const next = upsertById(previous ?? [], item);
      // Una sola predeterminada por prioridad: marcar esta desmarca las demás
      // de la misma prioridad, igual que ClearOtherDefaultsAsync en el backend.
      if (!item.isDefault) return next;
      return next.map((policy) =>
        policy.id !== item.id && policy.priority === item.priority && policy.isDefault
          ? { ...policy, isDefault: false }
          : policy,
      );
    });
  }

  function makeDefault(policy: SlaPolicy) {
    upsert({ ...policy, isDefault: true });
  }

  /**
   * RF-K5: cada prioridad necesita una política predeterminada. Desactivar la
   * última de su prioridad dejaría sin compromiso de tiempo a todo ticket que
   * nazca con ella.
   */
  function askToggle(policy: SlaPolicy) {
    const isLastForPriority =
      policy.isActive &&
      !all.some(
        (candidate) =>
          candidate.id !== policy.id && candidate.priority === policy.priority && candidate.isActive,
      );

    if (isLastForPriority) {
      setConfirmation({
        tone: "warn",
        icon: Power,
        title: "No se puede desactivar",
        description: (
          <>
            <strong className="font-semibold text-ink">{policy.name}</strong> es la única política
            activa de prioridad {policy.priority.toLowerCase()}. Sin ella, los tickets que nazcan con
            esa prioridad no tendrían compromiso de tiempo. Crea otra antes de desactivar esta.
          </>
        ),
        confirmLabel: "Entendido",
        cancelLabel: "Cerrar",
        onConfirm: () => {},
      });
      return;
    }

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
      onConfirm: () =>
        upsert({ ...policy, isActive: !policy.isActive, isDefault: policy.isActive ? false : policy.isDefault }),
    });
  }

  return (
    <SettingsLayout
      action={
        canWrite && (
          <Button size="sm" onClick={() => setModal("nueva")}>
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

        <span aria-hidden className="mx-1 h-5 w-px bg-line" />

        <FilterChip
          label="Todas"
          count={all.length}
          active={priority === "todas"}
          onClick={() => setPriority("todas")}
        />
        {PRIORITIES.map((value) => (
          <FilterChip
            key={value}
            label={value}
            count={all.filter((policy) => policy.priority === value).length}
            active={priority === value}
            onClick={() => setPriority(value)}
          />
        ))}
      </div>

      {error && (
        <div className="mb-3">
          <Alert variant="error">{error}</Alert>
        </div>
      )}

      {uncovered.length > 0 && (
        <div className="mb-3">
          <Alert variant="error">
            Sin política predeterminada activa para{" "}
            {uncovered.map((value) => value.toLowerCase()).join(", ")}. Un ticket que nazca con esa
            prioridad no tendría compromiso de tiempo.
          </Alert>
        </div>
      )}

      {policies === null ? (
        <div className="flex justify-center py-16">
          <Spinner />
        </div>
      ) : rows.length === 0 ? (
        <p className="py-14 text-center text-[13.5px] text-faint">
          Ninguna política coincide con este filtro o búsqueda.
        </p>
      ) : (
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
              <Row key={policy.id}>
                <Td className="text-[13px] font-medium text-ink">{policy.name}</Td>
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
                      <span className="text-[11px] leading-tight text-faint">
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
                      <Star aria-hidden className="h-3.5 w-3.5 fill-brand-red text-brand-red" />
                      De {policy.priority.toLowerCase()}
                    </span>
                  ) : canWrite && policy.isActive ? (
                    <button
                      type="button"
                      onClick={() => makeDefault(policy)}
                      className="rounded-edge text-[12.5px] text-muted underline-offset-4 transition-colors
                        hover:text-ink hover:underline"
                    >
                      Hacer predeterminada
                    </button>
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
                      <RowAction
                        label={`Editar ${policy.name}`}
                        icon={Pencil}
                        onClick={() => setModal(policy)}
                      />
                      <RowAction
                        label={policy.isActive ? `Desactivar ${policy.name}` : `Reactivar ${policy.name}`}
                        icon={Power}
                        onClick={() => askToggle(policy)}
                      />
                    </div>
                  </Td>
                )}
              </Row>
            ))}
          </tbody>
        </DataTable>
      )}

      {policies !== null && rows.length > 0 && (
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
          onSave={upsert}
        />
      )}

      {confirmation && <ConfirmDialog {...confirmation} onClose={() => setConfirmation(null)} />}
    </SettingsLayout>
  );
}
