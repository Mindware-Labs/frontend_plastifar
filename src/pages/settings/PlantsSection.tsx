import { Globe, Pencil, Plus, Power, Trash2 } from "lucide-react";
import { useState } from "react";
import { settingsApi } from "../../api/settings";
import { ModuleHeader } from "../../components/app/ModuleHeader";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { ConfirmDialog, type ConfirmDialogProps } from "../../components/ui/ConfirmDialog";
import { DataTable, HeadRow, Row, Td, Th } from "../../components/ui/DataTable";
import { ClearFiltersButton, FilterDropdown } from "../../components/ui/FilterDropdown";
import { HeaderTag } from "../../components/ui/HeaderTag";
import { ListPanel } from "../../components/ui/ListPanel";
import { Pagination } from "../../components/ui/Pagination";
import { RowAction } from "../../components/ui/RowAction";
import { SearchInput } from "../../components/ui/SearchInput";
import { TableSkeleton } from "../../components/ui/Skeleton";
import { StatusDot } from "../../components/ui/StatusDot";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";
import { usePagedList } from "../../hooks/usePagedList";
import { usePermissions } from "../../hooks/usePermissions";
import { PLANT_COUNTRIES, type Plant, type PlantCountry } from "../../types/settings";
import { LoadErrorAlert } from "./catalogSection";
import { freshCopy, staleClass } from "./catalogState";
import { PlantModal } from "./PlantModal";

type ChipKey = "todas" | "activas" | "inactivas";

const COUNTRY_LABEL: Record<PlantCountry, string> = Object.fromEntries(
  PLANT_COUNTRIES.map(({ value, label }) => [value, label]),
) as Record<PlantCountry, string>;

export function PlantsSection() {
  const { can } = usePermissions();
  const canWrite = can("settings.write");

  const [busyId, setBusyId] = useState<number | null>(null);

  const [search, setSearch] = useState("");
  const [country, setCountry] = useState<PlantCountry | "todos">("todos");
  const [chip, setChip] = useState<ChipKey>("todas");
  // Regla 4 del plan: localizar las plantas sin administrador, o con uno
  // desactivado, para corregirlas. Es un filtro aparte del estado.
  const [onlyWithoutManager, setOnlyWithoutManager] = useState(false);
  const [pageSize, setPageSize] = useState(10);

  const [modal, setModal] = useState<"nueva" | Plant | null>(null);
  const [confirmation, setConfirmation] = useState<Omit<ConfirmDialogProps, "onClose"> | null>(null);

  const debouncedSearch = useDebouncedValue(search).trim();

  // Seccion 4.1: la pagina, los filtros, la busqueda y los contadores los
  // resuelve SQL. La vista solo dibuja lo que llega.
  const { data, isStale, error, page, setPage, refresh } = usePagedList({
    fetch: settingsApi.plants.list,
    criteria: {
      pageSize,
      search: debouncedSearch || undefined,
      country: country === "todos" ? undefined : country,
      status: chip === "todas" ? undefined : chip,
      manager: onlyWithoutManager ? ("sin-activo" as const) : undefined,
    },
    fallbackError: "No se pudieron cargar las plantas",
  });

  const rows = data?.items ?? [];
  const counts = data?.counts;
  const isFiltering =
    debouncedSearch !== "" || chip !== "todas" || country !== "todos" || onlyWithoutManager;

  /* El servidor es quien sabe si algun equipo o producto la usa: su 409 sube al
     dialogo con el motivo, y la salida que ofrece es desactivarla. */
  function askDelete(plant: Plant) {
    setConfirmation({
      tone: "danger",
      icon: Trash2,
      title: "Eliminar planta",
      description: (
        <>
          <strong className="font-semibold text-ink">{plant.name}</strong> se borrará del catálogo.
          Solo es posible si ningún equipo ni producto la usa; si alguno lo hace, desactívala en su
          lugar.
        </>
      ),
      confirmLabel: "Eliminar",
      onConfirm: async () => {
        setBusyId(plant.id);
        try {
          await settingsApi.plants.remove(plant.id);
          refresh();
        } finally {
          setBusyId(null);
        }
      },
    });
  }

  function askToggle(plant: Plant) {
    setConfirmation({
      tone: "warn",
      icon: Power,
      title: plant.isActive ? "Desactivar planta" : "Reactivar planta",
      description: plant.isActive ? (
        <>
          <strong className="font-semibold text-ink">{plant.name}</strong> dejará de ofrecerse donde
          se elija una planta. Lo que ya la referencia la conserva.
        </>
      ) : (
        <>
          <strong className="font-semibold text-ink">{plant.name}</strong> vuelve a estar disponible.
        </>
      ),
      confirmLabel: plant.isActive ? "Desactivar" : "Reactivar",
      onConfirm: async () => {
        setBusyId(plant.id);
        try {
          const current = await freshCopy(settingsApi.plants.get, plant);
          await settingsApi.plants.update(current.id, {
            name: current.name,
            country: current.country,
            managerStaffId: current.managerStaffId,
            isActive: !current.isActive,
          });
          refresh();
        } finally {
          setBusyId(null);
        }
      },
    });
  }

  return (
    <>
      <ModuleHeader
        title="Plantas"
        summary={
          counts ? (
            <div className="flex flex-wrap items-center gap-1.5 tabular-nums">
              <HeaderTag
                label={counts.all === 1 ? "planta" : "plantas"}
                count={counts.all}
                active={chip === "todas" && !onlyWithoutManager}
                onClick={() => {
                  setChip("todas");
                  setOnlyWithoutManager(false);
                  setPage(1);
                }}
                tone="neutral"
                title="Mostrar todas las plantas"
              />
              <span aria-hidden className="text-zinc-300">·</span>
              <HeaderTag
                label={counts.active === 1 ? "activa" : "activas"}
                count={counts.active}
                active={chip === "activas"}
                onClick={() => {
                  setChip("activas");
                  setPage(1);
                }}
                tone="emerald"
                dot
                title="Filtrar por plantas activas"
              />
              <span aria-hidden className="text-zinc-300">·</span>
              <HeaderTag
                label={counts.inactive === 1 ? "inactiva" : "inactivas"}
                count={counts.inactive}
                active={chip === "inactivas"}
                onClick={() => {
                  setChip("inactivas");
                  setPage(1);
                }}
                tone="red"
                dot
                title="Filtrar por plantas inactivas"
              />
              <span aria-hidden className="text-zinc-300">·</span>
              <HeaderTag
                label="sin administrador"
                count={counts.withoutActiveManager}
                active={onlyWithoutManager}
                onClick={() => {
                  setOnlyWithoutManager((current) => !current);
                  setPage(1);
                }}
                tone="amber"
                dot
                title="Filtrar por plantas sin administrador activo"
              />
            </div>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-[12px] text-zinc-400">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-zinc-300" />
              Cargando las plantas configuradas…
            </span>
          )
        }
        action={
          canWrite && (
            <Button size="sm" onClick={() => setModal("nueva")} disabled={busyId !== null}>
              <Plus className="h-[15px] w-[15px]" />
              Nueva planta
            </Button>
          )
        }
      />

      {error && <LoadErrorAlert message={error} onRetry={refresh} />}

      <ListPanel
        toolbar={
          <>
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder="Buscar planta…"
              className="w-[240px]"
            />

            <FilterDropdown
              title="Seleccionar país"
              aria-label="Filtrar por país"
              value={country}
              onChange={(value) => setCountry(value as PlantCountry | "todos")}
              defaultIcon={<Globe className="h-3.5 w-3.5 text-zinc-500" />}
              options={[{ value: "todos", label: "Todos los países" }, ...PLANT_COUNTRIES]}
            />

            {(search || country !== "todos") && (
              <ClearFiltersButton
                onClick={() => {
                  setSearch("");
                  setCountry("todos");
                }}
              />
            )}
          </>
        }
        footer={
          data !== null &&
          data.total > 0 && (
            <Pagination
              page={page}
              pageSize={pageSize}
              total={data.total}
              totalPages={data.totalPages}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
              noun="plantas"
            />
          )
        }
      >
        {data === null ? (
          error === null && <TableSkeleton rows={pageSize} columns={4} />
        ) : rows.length === 0 ? (
          <p className="py-14 text-center text-[13.5px] text-faint">
            {isFiltering
              ? "Ninguna planta coincide con este filtro o búsqueda."
              : "Todavía no hay ninguna planta registrada."}
          </p>
        ) : (
          <div className={staleClass(isStale)}>
            <DataTable>
              <thead>
                <HeadRow>
                  <Th>Planta</Th>
                  <Th>País</Th>
                  <Th>Administrador</Th>
                  <Th>Estado</Th>
                  {canWrite && <Th className="w-32 text-right">Acciones</Th>}
                </HeadRow>
              </thead>

              <tbody>
                {rows.map((plant) => (
                  <Row key={plant.id} busy={busyId === plant.id}>
                    <Td className="text-[12.5px] font-medium text-ink">{plant.name}</Td>
                    <Td className="text-[12.5px] text-subtle">
                      {COUNTRY_LABEL[plant.country] ?? plant.country}
                    </Td>
                    <Td className="text-[12.5px] text-subtle">
                      {plant.managerName === null ? (
                        <span className="text-faint">Sin administrador</span>
                      ) : (
                        <span className="inline-flex items-center gap-2">
                          {plant.managerName}
                          {plant.managerIsActive === false && <Badge tone="neutral">Inactivo</Badge>}
                        </span>
                      )}
                    </Td>
                    <Td>
                      <StatusDot active={plant.isActive} />
                    </Td>
                    {canWrite && (
                      <Td>
                        <div className="flex items-center justify-end gap-1">
                          <RowAction
                            label={`Editar ${plant.name}`}
                            icon={Pencil}
                            onClick={() => setModal(plant)}
                            disabled={busyId === plant.id}
                          />
                          <RowAction
                            label={plant.isActive ? `Desactivar ${plant.name}` : `Reactivar ${plant.name}`}
                            icon={Power}
                            onClick={() => askToggle(plant)}
                            disabled={busyId === plant.id}
                          />
                          <RowAction
                            label={`Eliminar ${plant.name}`}
                            icon={Trash2}
                            danger
                            onClick={() => askDelete(plant)}
                            disabled={busyId === plant.id}
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
      </ListPanel>

      {modal !== null && (
        <PlantModal
          plant={modal === "nueva" ? undefined : modal}
          onClose={() => setModal(null)}
          onSaved={refresh}
        />
      )}

      {confirmation && <ConfirmDialog {...confirmation} onClose={() => setConfirmation(null)} />}
    </>
  );
}
