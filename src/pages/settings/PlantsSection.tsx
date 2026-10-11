import { Pencil, Plus, Power } from "lucide-react";
import { useState } from "react";
import { settingsApi } from "../../api/settings";
import { Button } from "../../components/ui/Button";
import { ConfirmDialog, type ConfirmDialogProps } from "../../components/ui/ConfirmDialog";
import { DataTable, HeadRow, Row, Td, Th } from "../../components/ui/DataTable";
import { FilterChip } from "../../components/ui/FilterChip";
import { ListPanel } from "../../components/ui/ListPanel";
import { Pagination } from "../../components/ui/Pagination";
import { RowAction } from "../../components/ui/RowAction";
import { SearchInput } from "../../components/ui/SearchInput";
import { Select } from "../../components/ui/Select";
import { TableSkeleton } from "../../components/ui/Skeleton";
import { StatusDot } from "../../components/ui/StatusDot";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";
import { usePagedList } from "../../hooks/usePagedList";
import { usePermissions } from "../../hooks/usePermissions";
import { PLANT_COUNTRIES, type Plant, type PlantCountry } from "../../types/settings";
import { ChipGroup, LoadErrorAlert } from "./catalogSection";
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
    },
    fallbackError: "No se pudieron cargar las plantas",
  });

  const rows = data?.items ?? [];
  const counts = data?.counts;
  const isFiltering = debouncedSearch !== "" || chip !== "todas" || country !== "todos";

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
      {error && <LoadErrorAlert message={error} onRetry={refresh} />}

      <ListPanel
        action={canWrite && (
          <Button size="sm" onClick={() => setModal("nueva")} disabled={busyId !== null}>
            <Plus className="h-[15px] w-[15px]" />
            Nueva planta
          </Button>
        )}
        toolbar={
          <>
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder="Buscar planta…"
              className="w-[240px]"
            />

            <Select
              size="sm"
              className="w-[200px]"
              aria-label="Filtrar por país"
              value={country}
              onChange={(value) => setCountry(value as PlantCountry | "todos")}
              options={[{ value: "todos", label: "Todos los países" }, ...PLANT_COUNTRIES]}
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
                  {canWrite && <Th className="w-24 text-right">Acciones</Th>}
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
                      {plant.managerName ?? <span className="text-faint">Sin administrador</span>}
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
