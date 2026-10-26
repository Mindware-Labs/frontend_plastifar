import { Globe, Pencil, Plus, Power, Trash2 } from "lucide-react";
import { settingsApi } from "../../api/settings";
import { HeaderCounts } from "../../components/app/HeaderCounts";
import { ModuleHeader } from "../../components/app/ModuleHeader";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { DataTable, HeadRow, Row, Td, Th } from "../../components/ui/DataTable";
import { ClearFiltersButton, FilterDropdown } from "../../components/ui/FilterDropdown";
import { HeaderTag } from "../../components/ui/HeaderTag";
import { ListBody } from "../../components/ui/ListBody";
import { ListPanel } from "../../components/ui/ListPanel";
import { ListPagination } from "../../components/ui/ListPagination";
import { RowAction } from "../../components/ui/RowAction";
import { SearchInput } from "../../components/ui/SearchInput";
import { StatusDot } from "../../components/ui/StatusDot";
import { useCatalogActions } from "../../hooks/useCatalogActions";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";
import { usePagedList } from "../../hooks/usePagedList";
import { usePermissions } from "../../hooks/usePermissions";
import { useUrlNumber, useUrlState } from "../../hooks/useUrlState";
import { PLANT_COUNTRIES, type Plant, type PlantCountry } from "../../types/settings";
import { LoadErrorAlert } from "./catalogSection";
import { freshCopy } from "./catalogState";
import { PlantModal } from "./PlantModal";
import { PAGE_SIZES } from "../../lib/pageSizes";

const CHIPS = ["todas", "activas", "inactivas"] as const;
type ChipKey = (typeof CHIPS)[number];

const COUNTRY_LABEL: Record<PlantCountry, string> = Object.fromEntries(
  PLANT_COUNTRIES.map(({ value, label }) => [value, label]),
) as Record<PlantCountry, string>;

const COUNTRY_FILTERS = ["todos", ...PLANT_COUNTRIES.map(({ value }) => value)] as const;
type CountryFilter = (typeof COUNTRY_FILTERS)[number];

const MANAGER_FILTERS = ["", "sin-activo"] as const;

export function PlantsSection() {
  const { can } = usePermissions();
  const canWrite = can("settings.write");

  const { modal, setModal, busyId, confirm, dialog } = useCatalogActions<Plant, "nueva">();

  const [search, setSearch] = useUrlState<string>("q", "");
  const [country, setCountry] = useUrlState<CountryFilter>("pais", "todos", COUNTRY_FILTERS);
  const [chip, setChip] = useUrlState<ChipKey>("estado", "todas", CHIPS);
  // Regla 4 del plan: localizar las plantas sin administrador, o con uno
  // desactivado, para corregirlas. Es un filtro aparte del estado.
  const [manager, setManager] = useUrlState("administrador", "", MANAGER_FILTERS);
  const onlyWithoutManager = manager === "sin-activo";
  const [pageSize, setPageSize] = useUrlNumber("tam", 10, PAGE_SIZES);

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
      manager: manager || undefined,
    },
    fallbackError: "No se pudieron cargar las plantas",
    pageKey: "pagina",
  });

  const rows = data?.items ?? [];
  const counts = data?.counts;
  const isFiltering =
    debouncedSearch !== "" || chip !== "todas" || country !== "todos" || onlyWithoutManager;

  function clearFilters() {
    setSearch("");
    setCountry("todos");
    setChip("todas");
    setManager("");
  }

  /* El servidor es quien sabe si algun equipo o producto la usa: su 409 sube al
     dialogo con el motivo, y la salida que ofrece es desactivarla. */
  function askDelete(plant: Plant) {
    confirm(plant.id, {
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
        await settingsApi.plants.remove(plant.id);
        refresh();
      },
    });
  }

  function askToggle(plant: Plant) {
    confirm(plant.id, {
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
        const current = await freshCopy(settingsApi.plants.get, plant);
        await settingsApi.plants.update(current.id, {
          name: current.name,
          country: current.country,
          managerStaffId: current.managerStaffId,
          isActive: !current.isActive,
        });
        refresh();
      },
    });
  }

  return (
    <>
      <ModuleHeader
        title="Plantas"
        summary={
          <HeaderCounts counts={counts} loadingLabel="Cargando las plantas configuradas…">
            {(counts) => (
              <>
                <HeaderTag
                  label={counts.all === 1 ? "planta" : "plantas"}
                  count={counts.all}
                  active={chip === "todas" && !onlyWithoutManager}
                  onClick={() => {
                    setChip("todas");
                    setManager("");
                    setPage(1);
                  }}
                  tone="neutral"
                  title="Mostrar todas las plantas"
                />
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
                <HeaderTag
                  label="sin administrador"
                  count={counts.withoutActiveManager}
                  active={onlyWithoutManager}
                  onClick={() => {
                    setManager(onlyWithoutManager ? "" : "sin-activo");
                    setPage(1);
                  }}
                  tone="amber"
                  dot
                  title="Filtrar por plantas sin administrador activo"
                />
              </>
            )}
          </HeaderCounts>
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
          <ListPagination
            data={data}
            page={page}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
            noun="plantas"
          />
        }
      >
        <ListBody
          data={data}
          error={error}
          isStale={isStale}
          skeletonRows={pageSize}
          skeletonColumns={4}
          empty={
            isFiltering
              ? "Ninguna planta coincide con este filtro o búsqueda."
              : "Todavía no hay ninguna planta registrada."
          }
          onClear={isFiltering ? clearFilters : undefined}
        >
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
        </ListBody>
      </ListPanel>

      {modal !== null && (
        <PlantModal
          plant={modal === "nueva" ? undefined : modal}
          onClose={() => setModal(null)}
          onSaved={refresh}
        />
      )}

      {dialog}
    </>
  );
}
