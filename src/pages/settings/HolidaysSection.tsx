import { CalendarOff, Pencil, Plus, Power } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { settingsApi } from "../../api/settings";
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
import { WEEKDAYS, type Holiday, type SlaPolicy } from "../../types/settings";
import { ChipGroup, LoadErrorAlert } from "./catalogSection";
import { freshCopy, staleClass, useSectionLoad } from "./catalogState";
import { HolidayModal } from "./HolidayModal";
import { SettingsLayout } from "./SettingsLayout";

type ChipKey = "todos" | "activos" | "inactivos";

const dayFormat = new Intl.DateTimeFormat("es-DO", { weekday: "long" });
const dateFormat = new Intl.DateTimeFormat("es-DO", {
  day: "2-digit",
  month: "long",
  year: "numeric",
});

/** Una fecha sin hora se interpreta como UTC; se ancla al mediodía local para
 *  que la zona horaria no la corra un día hacia atrás al mostrarla. */
function asLocalDate(iso: string): Date {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(year, month - 1, day, 12);
}

const listHolidays = () => settingsApi.holidays.list({ page: 1, pageSize: 100 });

export function HolidaysSection() {
  const { can } = usePermissions();
  const canWrite = can("settings.write");

  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [policies, setPolicies] = useState<SlaPolicy[]>([]);
  const [busyId, setBusyId] = useState<number | null>(null);

  const [search, setSearch] = useState("");
  const [year, setYear] = useState<string>("todos");
  const [chip, setChip] = useState<ChipKey>("todos");

  const [modal, setModal] = useState<"nuevo" | Holiday | null>(null);
  const [confirmation, setConfirmation] = useState<Omit<ConfirmDialogProps, "onClose"> | null>(null);

  const debouncedSearch = useDebouncedValue(search).trim().toLowerCase();

  const load = useCallback(async () => {
    const [holidayPage, policyPage] = await Promise.all([
      listHolidays(),
      settingsApi.slaPolicies.list({ page: 1, pageSize: 100 }),
    ]);
    setHolidays(holidayPage.items);
    setPolicies(policyPage.items);
  }, []);

  const { status, isRefetching, error, reload, retry } = useSectionLoad(
    load,
    "No se pudieron cargar los días no laborables",
  );

  const all = holidays;
  const activeCount = all.filter((holiday) => holiday.isActive).length;

  const years = useMemo(
    () => [...new Set(all.map((holiday) => holiday.date.slice(0, 4)))].sort((a, b) => b.localeCompare(a)),
    [all],
  );

  const rows = useMemo(
    () =>
      all
        .filter((holiday) => {
          const byChip =
            chip === "todos" ||
            (chip === "activos" && holiday.isActive) ||
            (chip === "inactivos" && !holiday.isActive);
          const byYear = year === "todos" || holiday.date.startsWith(year);
          const bySearch =
            debouncedSearch === "" || holiday.name.toLowerCase().includes(debouncedSearch);
          return byChip && byYear && bySearch;
        })
        .sort((a, b) => a.date.localeCompare(b.date)),
    [all, chip, year, debouncedSearch],
  );

  // RF-K2: los listados de catalogo paginan como cualquier otro. El corte
  // lo hace la vista solo mientras no exista /api/settings/...; el endpoint
  // devuelve la pagina ya cortada en SQL (anexo 12.1).
  const { page, pageSize, total, totalPages, pageRows, setPage, changePageSize } = useLocalPage(
    rows,
    JSON.stringify([debouncedSearch, year, chip]),
  );

  /**
   * Un feriado solo mueve vencimientos en las politicas con reloj de jornada que
   * ademas trabajen ese dia de la semana: uno que cae domingo no mueve nada, y
   * esa es justo la consecuencia que la fila tiene que decir.
   */
  function movedPolicies(holiday: Holiday) {
    const weekday = WEEKDAYS.find((day) => day.jsDay === asLocalDate(holiday.date).getDay())?.key;
    if (!weekday || !holiday.isActive) return [];

    return policies.filter(
      (policy) => policy.isActive && policy.businessHoursOnly && policy.workDays.includes(weekday),
    );
  }

  function askToggle(holiday: Holiday) {
    setConfirmation({
      tone: "warn",
      icon: CalendarOff,
      title: holiday.isActive ? "Desactivar día no laborable" : "Reactivar día no laborable",
      description: holiday.isActive ? (
        <>
          El <strong className="font-semibold text-ink">{holiday.name}</strong> dejará de saltarse al
          calcular vencimientos: las políticas con reloj de jornada volverán a contar ese día como
          laborable.
        </>
      ) : (
        <>
          El <strong className="font-semibold text-ink">{holiday.name}</strong> vuelve a saltarse al
          calcular vencimientos en las políticas con reloj de jornada.
        </>
      ),
      confirmLabel: holiday.isActive ? "Desactivar" : "Reactivar",
      onConfirm: async () => {
        setBusyId(holiday.id);
        try {
          const current = await freshCopy(listHolidays, holiday);
          await settingsApi.holidays.update(current.id, {
            date: current.date,
            name: current.name,
            isActive: !current.isActive,
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
          <Button size="sm" onClick={() => setModal("nuevo")} disabled={busyId !== null}>
            <Plus className="h-[15px] w-[15px]" />
            Nuevo día
          </Button>
        )
      }
    >
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Buscar por nombre…"
          className="w-[240px]"
        />

        <Select
          size="sm"
          className="w-[200px]"
          aria-label="Filtrar por año"
          value={year}
          onChange={setYear}
          options={[
            { value: "todos", label: "Todos los años" },
            ...years.map((value) => ({ value, label: value })),
          ]}
        />

        <span aria-hidden className="mx-1 h-5 w-px bg-line" />

        <ChipGroup label="Filtrar por estado" ready={status === "ready"}>
          <FilterChip
            label="Todos"
            count={all.length}
            active={chip === "todos"}
            onClick={() => setChip("todos")}
          />
          <FilterChip
            label="Activos"
            count={activeCount}
            active={chip === "activos"}
            onClick={() => setChip("activos")}
          />
          <FilterChip
            label="Inactivos"
            count={all.length - activeCount}
            active={chip === "inactivos"}
            onClick={() => setChip("inactivos")}
          />
        </ChipGroup>
      </div>

      {error && <LoadErrorAlert message={error} onRetry={retry} />}

      {status === "loading" ? (
        <div className="flex justify-center py-16">
          <Spinner />
        </div>
      ) : status === "error" ? null : rows.length === 0 ? (
        <p className="py-14 text-center text-[13.5px] text-faint">
          {all.length === 0
            ? "Todavía no hay ningún día no laborable registrado."
            : "Ningún día coincide con este filtro o búsqueda."}
        </p>
      ) : (
        <div className={staleClass(isRefetching)}>
          <DataTable>
            <thead>
              <HeadRow>
                <Th>Fecha</Th>
                <Th>Día</Th>
                <Th>Motivo del cierre</Th>
                <Th>Mueve vencimientos</Th>
                <Th>Estado</Th>
                {canWrite && <Th className="w-24 text-right">Acciones</Th>}
              </HeadRow>
            </thead>

            <tbody>
              {pageRows.map((holiday) => (
                <Row key={holiday.id} busy={busyId === holiday.id}>
                  <Td className="text-[12.5px] font-medium tabular-nums text-ink">
                    {dateFormat.format(asLocalDate(holiday.date))}
                  </Td>
                  <Td className="text-[12.5px] capitalize text-brand-gray">
                    {dayFormat.format(asLocalDate(holiday.date))}
                  </Td>
                  <Td className="text-[12.5px] text-brand-gray">{holiday.name}</Td>
                  <Td className="text-[12.5px] tabular-nums text-brand-gray">
                    {(() => {
                      const moved = movedPolicies(holiday);
                      if (!holiday.isActive) return <span className="text-faint">—</span>;
                      if (moved.length === 0) {
                        return (
                          <span className="text-faint">
                            Ninguna · cae{" "}
                            <span className="capitalize">
                              {dayFormat.format(asLocalDate(holiday.date))}
                            </span>
                          </span>
                        );
                      }
                      return (
                        <span>
                          {moved.length}{" "}
                          {moved.length === 1 ? "política de jornada" : "políticas de jornada"}
                        </span>
                      );
                    })()}
                  </Td>
                  <Td>
                    <StatusDot active={holiday.isActive} />
                  </Td>
                  {canWrite && (
                    <Td>
                      <div className="flex items-center justify-end gap-1">
                        <RowAction
                          label={`Editar ${holiday.name}`}
                          icon={Pencil}
                          onClick={() => setModal(holiday)}
                          disabled={busyId === holiday.id}
                        />
                        <RowAction
                          label={
                            holiday.isActive
                              ? `Desactivar ${holiday.name}`
                              : `Reactivar ${holiday.name}`
                          }
                          icon={Power}
                          onClick={() => askToggle(holiday)}
                          disabled={busyId === holiday.id}
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
          noun="días"
        />
      )}

      <p className="mt-4 max-w-[76ch] text-[12px] leading-relaxed text-faint">
        Estos días se saltan al calcular vencimientos, pero solo en las políticas con reloj de
        jornada: una política de reloj continuo cuenta igual un feriado que un martes.
      </p>

      {modal !== null && (
        <HolidayModal
          holiday={modal === "nuevo" ? undefined : modal}
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
