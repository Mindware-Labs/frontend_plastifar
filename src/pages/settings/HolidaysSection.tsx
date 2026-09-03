import { CalendarOff, Pencil, Plus, Power } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Alert } from "../../components/ui/Alert";
import { Button } from "../../components/ui/Button";
import { ConfirmDialog, type ConfirmDialogProps } from "../../components/ui/ConfirmDialog";
import { DataTable, HeadRow, Row, Td, Th } from "../../components/ui/DataTable";
import { FilterChip } from "../../components/ui/FilterChip";
import { RowAction } from "../../components/ui/RowAction";
import { SearchInput } from "../../components/ui/SearchInput";
import { Spinner } from "../../components/ui/Spinner";
import { StatusDot } from "../../components/ui/StatusDot";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";
import { upsertById } from "../../lib/catalog";
import { usePermissions } from "../../hooks/usePermissions";
import { settingsMock } from "../../mocks/settings";
import { WEEKDAYS, type Holiday, type SlaPolicy } from "../../types/settings";
import { HolidayModal } from "./HolidayModal";
import { SettingsLayout } from "./SettingsLayout";

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

export function HolidaysSection() {
  const { can } = usePermissions();
  const canWrite = can("settings.write");

  const [holidays, setHolidays] = useState<Holiday[] | null>(null);
  const [policies, setPolicies] = useState<SlaPolicy[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [year, setYear] = useState<number | "todos">("todos");

  const [modal, setModal] = useState<"nuevo" | Holiday | null>(null);
  const [confirmation, setConfirmation] = useState<Omit<ConfirmDialogProps, "onClose"> | null>(null);

  const debouncedSearch = useDebouncedValue(search).trim().toLowerCase();

  useEffect(() => {
    Promise.all([settingsMock.holidays(), settingsMock.policies()])
      .then(([loadedHolidays, loadedPolicies]) => {
        setHolidays(loadedHolidays);
        setPolicies(loadedPolicies);
      })
      .catch(() => setError("No se pudieron cargar los días no laborables"));
  }, []);

  const all = useMemo(() => holidays ?? [], [holidays]);

  const years = useMemo(
    () => [...new Set(all.map((holiday) => Number(holiday.date.slice(0, 4))))].sort((a, b) => b - a),
    [all],
  );

  const rows = useMemo(
    () =>
      all
        .filter((holiday) => {
          const byYear = year === "todos" || holiday.date.startsWith(String(year));
          const bySearch =
            debouncedSearch === "" || holiday.name.toLowerCase().includes(debouncedSearch);
          return byYear && bySearch;
        })
        .sort((a, b) => a.date.localeCompare(b.date)),
    [all, year, debouncedSearch],
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

  function upsert(item: Holiday) {
    setHolidays((previous) => upsertById(previous ?? [], item));
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
      onConfirm: () => upsert({ ...holiday, isActive: !holiday.isActive }),
    });
  }

  const activeCount = all.filter((holiday) => holiday.isActive).length;

  return (
    <SettingsLayout
      summary={
        holidays === null
          ? "Cargando el calendario…"
          : `${all.length} días registrados · ${activeCount} activos`
      }
      action={
        canWrite && (
          <Button size="sm" onClick={() => setModal("nuevo")}>
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

        <span aria-hidden className="mx-1 h-5 w-px bg-line" />

        <FilterChip
          label="Todos"
          count={all.length}
          active={year === "todos"}
          onClick={() => setYear("todos")}
        />
        {years.map((value) => (
          <FilterChip
            key={value}
            label={String(value)}
            count={all.filter((holiday) => holiday.date.startsWith(String(value))).length}
            active={year === value}
            onClick={() => setYear(value)}
          />
        ))}
      </div>

      {error && (
        <div className="mb-3">
          <Alert variant="error">{error}</Alert>
        </div>
      )}

      {holidays === null ? (
        <div className="flex justify-center py-16">
          <Spinner />
        </div>
      ) : rows.length === 0 ? (
        <p className="py-14 text-center text-[13.5px] text-faint">
          Ningún día coincide con este filtro o búsqueda.
        </p>
      ) : (
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
            {rows.map((holiday) => (
              <Row key={holiday.id}>
                <Td className="text-[13px] font-medium tabular-nums text-ink">
                  {dateFormat.format(asLocalDate(holiday.date))}
                </Td>
                <Td className="text-[12.5px] capitalize text-brand-gray">
                  {dayFormat.format(asLocalDate(holiday.date))}
                </Td>
                <Td className="text-[12.5px] text-brand-gray">{holiday.name}</Td>
                <Td className="text-[12.5px] text-brand-gray">
                  {(() => {
                    const moved = movedPolicies(holiday);
                    if (!holiday.isActive) return <span className="text-faint">—</span>;
                    if (moved.length === 0) {
                      return (
                        <span className="text-faint">
                          Ninguna · cae {dayFormat.format(asLocalDate(holiday.date))}
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
                      />
                      <RowAction
                        label={
                          holiday.isActive ? `Desactivar ${holiday.name}` : `Reactivar ${holiday.name}`
                        }
                        icon={Power}
                        onClick={() => askToggle(holiday)}
                      />
                    </div>
                  </Td>
                )}
              </Row>
            ))}
          </tbody>
        </DataTable>
      )}

      <p className="mt-4 max-w-[76ch] text-[12px] leading-relaxed text-faint">
        Estos días se saltan al calcular vencimientos, pero solo en las políticas con reloj de
        jornada: una política de reloj continuo cuenta igual un feriado que un martes.
      </p>

      {modal !== null && (
        <HolidayModal
          holiday={modal === "nuevo" ? undefined : modal}
          existing={all}
          onClose={() => setModal(null)}
          onSave={upsert}
        />
      )}

      {confirmation && <ConfirmDialog {...confirmation} onClose={() => setConfirmation(null)} />}
    </SettingsLayout>
  );
}
