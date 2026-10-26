import { Calendar, CalendarOff, Plus } from "lucide-react";
import { useState } from "react";
import { fetchAllPages } from "../../api/paging";
import { settingsApi } from "../../api/settings";
import { HeaderCounts } from "../../components/app/HeaderCounts";
import { ModuleHeader } from "../../components/app/ModuleHeader";
import { Button } from "../../components/ui/Button";
import { DataTable, HeadRow, Row, Td, Th } from "../../components/ui/DataTable";
import { ClearFiltersButton, FilterDropdown } from "../../components/ui/FilterDropdown";
import { HeaderTag } from "../../components/ui/HeaderTag";
import { ListBody } from "../../components/ui/ListBody";
import { ListPanel } from "../../components/ui/ListPanel";
import { ListPagination } from "../../components/ui/ListPagination";
import { SearchInput } from "../../components/ui/SearchInput";
import { StatusDot } from "../../components/ui/StatusDot";
import { useCatalogActions } from "../../hooks/useCatalogActions";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";
import { usePagedList } from "../../hooks/usePagedList";
import { usePermissions } from "../../hooks/usePermissions";
import { WEEKDAYS, type Holiday, type SlaPolicy } from "../../types/settings";
import { CatalogRowActions } from "./CatalogRowActions";
import { LoadErrorAlert } from "./catalogSection";
import { freshCopy, useReferenceData } from "./catalogState";
import { HolidayModal } from "./HolidayModal";

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

/**
 * Los años del desplegable salen del calendario, no de la página que se ve: se
 * piden el feriado más antiguo y el más reciente --una fila cada uno-- y se
 * ofrece el tramo entre ambos. Derivarlos de lo cargado ocultaba todo año que
 * no cupiera en la página.
 */
async function loadYears(): Promise<string[]> {
  const [oldest, newest] = await Promise.all([
    settingsApi.holidays.list({ page: 1, pageSize: 1, dir: "asc" }),
    settingsApi.holidays.list({ page: 1, pageSize: 1, dir: "desc" }),
  ]);

  const from = oldest.items[0]?.date.slice(0, 4);
  const to = newest.items[0]?.date.slice(0, 4);
  if (from === undefined || to === undefined) return [];

  const years: string[] = [];
  for (let year = Number(to); year >= Number(from); year -= 1) years.push(String(year));
  return years;
}

/**
 * Las políticas de jornada que un feriado mueve. Es catalogo de apoyo --una
 * consulta de referencia, no el listado que se pagina-- y por eso se recorre
 * entero: pedir solo cien dejaba fuera políticas que el feriado sí mueve, y la
 * sección afirmaba que afecta a menos de las que afecta.
 */
const loadWorkdayPolicies = () =>
  fetchAllPages<SlaPolicy>((page, pageSize) =>
    settingsApi.slaPolicies.list({ page, pageSize, status: "activas" }),
  ).then((items) => items.filter((policy) => policy.businessHoursOnly));

export function HolidaysSection() {
  const { can } = usePermissions();
  const canWrite = can("settings.write");

  const { modal, setModal, busyId, confirm, dialog } = useCatalogActions<Holiday>();

  const [search, setSearch] = useState("");
  const [year, setYear] = useState<string>("todos");
  const [chip, setChip] = useState<ChipKey>("todos");
  const [pageSize, setPageSize] = useState(10);

  const debouncedSearch = useDebouncedValue(search).trim();

  // Seccion 4.1: la pagina, el filtro, la busqueda y los contadores los resuelve
  // SQL. La vista solo dibuja lo que llega.
  const { data, isStale, error, page, setPage, refresh } = usePagedList({
    fetch: settingsApi.holidays.list,
    criteria: {
      pageSize,
      search: debouncedSearch || undefined,
      status: chip === "todos" ? undefined : chip,
      year: year === "todos" ? undefined : Number(year),
    },
    fallbackError: "No se pudieron cargar los días no laborables",
  });

  const yearsRef = useReferenceData<string[]>(loadYears, []);
  const years = yearsRef.data;

  const policiesRef = useReferenceData<SlaPolicy[]>(loadWorkdayPolicies, []);
  const policies = policiesRef.data;

  const rows = data?.items ?? [];
  const counts = data?.counts;
  // Sin criterio activo, una pagina vacia significa calendario vacio; con
  // criterio, que nada coincide. Los contadores no distinguen ese caso: se
  // calculan sobre el filtro base, no sobre la tabla entera.
  const isFiltering = debouncedSearch !== "" || chip !== "todos" || year !== "todos";

  /** Tras escribir, el calendario puede estrenar año: los años se releen tambien. */
  function reloadAll() {
    refresh();
    yearsRef.reload();
  }

  /**
   * Un feriado solo mueve vencimientos en las politicas con reloj de jornada que
   * ademas trabajen ese dia de la semana: uno que cae domingo no mueve nada, y
   * esa es justo la consecuencia que la fila tiene que decir.
   */
  function movedPolicies(holiday: Holiday) {
    const weekday = WEEKDAYS.find((day) => day.jsDay === asLocalDate(holiday.date).getDay())?.key;
    if (!weekday || !holiday.isActive) return [];

    return policies.filter((policy) => policy.workDays.includes(weekday));
  }

  function askToggle(holiday: Holiday) {
    confirm(holiday.id, {
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
        const current = await freshCopy(settingsApi.holidays.get, holiday);
        await settingsApi.holidays.update(current.id, {
          date: current.date,
          name: current.name,
          isActive: !current.isActive,
        });
        reloadAll();
      },
    });
  }

  return (
    <>
      <ModuleHeader
        title="Días no laborables"
        summary={
          <HeaderCounts counts={counts} loadingLabel="Cargando el calendario de días no laborables…">
            {(counts) => (
              <>
                <HeaderTag
                  label={counts.all === 1 ? "día registrado" : "días registrados"}
                  count={counts.all}
                  active={chip === "todos"}
                  onClick={() => {
                    setChip("todos");
                    setPage(1);
                  }}
                  tone="neutral"
                  title="Mostrar todos los días registrados"
                />
                <HeaderTag
                  label={counts.active === 1 ? "activo" : "activos"}
                  count={counts.active}
                  active={chip === "activos"}
                  onClick={() => {
                    setChip("activos");
                    setPage(1);
                  }}
                  tone="emerald"
                  dot
                  title="Filtrar por días activos"
                />
                <HeaderTag
                  label={counts.inactive === 1 ? "inactivo" : "inactivos"}
                  count={counts.inactive}
                  active={chip === "inactivos"}
                  onClick={() => {
                    setChip("inactivos");
                    setPage(1);
                  }}
                  tone="red"
                  dot
                  title="Filtrar por días inactivos"
                />
              </>
            )}
          </HeaderCounts>
        }
        action={
          canWrite && (
            <Button size="sm" onClick={() => setModal("nuevo")} disabled={busyId !== null}>
              <Plus className="h-[15px] w-[15px]" />
              Nuevo día
            </Button>
          )
        }
      />

      {error && <LoadErrorAlert message={error} onRetry={refresh} />}

      {policiesRef.failed && (
        <LoadErrorAlert
          message="No se pudieron cargar las políticas: la columna «mueve vencimientos» queda sin calcular."
          onRetry={policiesRef.reload}
        />
      )}

      <ListPanel
        toolbar={
          <>
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder="Buscar por nombre…"
              className="w-[240px]"
            />

            <FilterDropdown
              title="Seleccionar año"
              aria-label="Filtrar por año"
              value={year}
              onChange={setYear}
              defaultIcon={<Calendar className="h-3.5 w-3.5 text-zinc-500" />}
              options={[
                { value: "todos", label: "Todos los años" },
                ...years.map((value) => ({ value, label: value })),
              ]}
            />

            {(search || year !== "todos") && (
              <ClearFiltersButton
                onClick={() => {
                  setSearch("");
                  setYear("todos");
                }}
              />
            )}
          </>
        }
        footer={
          <ListPagination
            data={data}
            page={page}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
            noun="días"
          />
        }
      >
        <ListBody
          data={data}
          error={error}
          isStale={isStale}
          skeletonRows={pageSize}
          skeletonColumns={6}
          empty={
            isFiltering
              ? "Ningún día coincide con este filtro o búsqueda."
              : "Todavía no hay ningún día no laborable registrado."
          }
        >
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
                      <CatalogRowActions
                        name={holiday.name}
                        isActive={holiday.isActive}
                        busy={busyId === holiday.id}
                        onEdit={() => setModal(holiday)}
                        onToggle={() => askToggle(holiday)}
                      />
                    </Td>
                  )}
                </Row>
              ))}
            </tbody>
          </DataTable>
        </ListBody>
      </ListPanel>

      {modal !== null && (
        <HolidayModal
          holiday={modal === "nuevo" ? undefined : modal}
          onClose={() => setModal(null)}
          onSaved={reloadAll}
        />
      )}

      {dialog}
    </>
  );
}
