import { Plus, Power, Trash2 } from "lucide-react";
import { settingsApi } from "../../api/settings";
import { HeaderCounts } from "../../components/app/HeaderCounts";
import { ModuleHeader } from "../../components/app/ModuleHeader";
import { Button } from "../../components/ui/Button";
import { DataTable, HeadRow, Row, Td, Th } from "../../components/ui/DataTable";
import { ClearFiltersButton } from "../../components/ui/FilterDropdown";
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
import { useUrlNumber, useUrlState } from "../../hooks/useUrlState";
import type { Team } from "../../types/settings";
import { CatalogRowActions } from "./CatalogRowActions";
import { LoadErrorAlert } from "./catalogSection";
import { freshCopy } from "./catalogState";
import { TeamModal } from "./TeamModal";
import { PAGE_SIZES } from "../../lib/pageSizes";

const CHIPS = ["todos", "activos", "inactivos"] as const;
type ChipKey = (typeof CHIPS)[number];

export function TeamsSection() {
  const { can } = usePermissions();
  const canWrite = can("settings.write");

  const { modal, setModal, busyId, confirm, dialog } = useCatalogActions<Team>();

  const [search, setSearch] = useUrlState<string>("q", "");
  const [chip, setChip] = useUrlState<ChipKey>("estado", "todos", CHIPS);
  // Regla 4 del plan: localizar los equipos sin ningun integrante activo
  // (vacios, o con todos desactivados). Es un filtro aparte del estado.
  const [members, setMembers] = useUrlState<"" | "sin-activos">("integrantes", "", [
    "",
    "sin-activos",
  ]);
  const onlyWithoutMembers = members === "sin-activos";
  const [pageSize, setPageSize] = useUrlNumber("tam", 10, PAGE_SIZES);

  const debouncedSearch = useDebouncedValue(search).trim();

  // Seccion 4.1: la pagina, los filtros, la busqueda, los contadores y el
  // numero de integrantes los resuelve SQL. La vista solo dibuja lo que llega.
  const { data, isStale, error, page, setPage, refresh } = usePagedList({
    fetch: settingsApi.teams.list,
    criteria: {
      pageSize,
      search: debouncedSearch || undefined,
      status: chip === "todos" ? undefined : chip,
      members: members || undefined,
    },
    fallbackError: "No se pudieron cargar los equipos",
    pageKey: "pagina",
  });

  const rows = data?.items ?? [];
  const counts = data?.counts;
  const isFiltering = debouncedSearch !== "" || chip !== "todos" || onlyWithoutMembers;

  function clearFilters() {
    setSearch("");
    setChip("todos");
    setMembers("");
  }

  /* El servidor es quien sabe si el equipo conserva integrantes: su 409 sube al
     dialogo con el motivo, y las salidas que ofrece son quitarlos o desactivarlo. */
  function askDelete(team: Team) {
    confirm(team.id, {
      tone: "danger",
      icon: Trash2,
      title: "Eliminar equipo",
      description: (
        <>
          <strong className="font-semibold text-ink">{team.name}</strong> se borrará del catálogo.
          Solo es posible si no tiene integrantes; si los tiene, quítalos antes o desactívalo en su
          lugar.
        </>
      ),
      confirmLabel: "Eliminar",
      onConfirm: async () => {
        await settingsApi.teams.remove(team.id);
        refresh();
      },
    });
  }

  function askToggle(team: Team) {
    confirm(team.id, {
      tone: "warn",
      icon: Power,
      title: team.isActive ? "Desactivar equipo" : "Reactivar equipo",
      description: team.isActive ? (
        <>
          <strong className="font-semibold text-ink">{team.name}</strong> dejará de ofrecerse donde
          se elija un equipo. Conserva a sus integrantes.
        </>
      ) : (
        <>
          <strong className="font-semibold text-ink">{team.name}</strong> vuelve a estar disponible.
        </>
      ),
      confirmLabel: team.isActive ? "Desactivar" : "Reactivar",
      onConfirm: async () => {
        const current = await freshCopy(settingsApi.teams.get, team);
        await settingsApi.teams.update(current.id, {
          name: current.name,
          plantId: current.plantId,
          isActive: !current.isActive,
        });
        refresh();
      },
    });
  }

  return (
    <>
      <ModuleHeader
        title="Equipos"
        summary={
          <HeaderCounts counts={counts} loadingLabel="Cargando los equipos de trabajo…">
            {(counts) => (
              <>
                <HeaderTag
                  label={counts.all === 1 ? "equipo" : "equipos"}
                  count={counts.all}
                  active={chip === "todos" && !onlyWithoutMembers}
                  onClick={() => {
                    setChip("todos");
                    setMembers("");
                    setPage(1);
                  }}
                  tone="neutral"
                  title="Mostrar todos los equipos"
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
                  title="Filtrar por equipos activos"
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
                  title="Filtrar por equipos inactivos"
                />
                <HeaderTag
                  label="sin integrantes"
                  count={counts.withoutActiveMembers}
                  active={onlyWithoutMembers}
                  onClick={() => {
                    setMembers(onlyWithoutMembers ? "" : "sin-activos");
                    setPage(1);
                  }}
                  tone="amber"
                  dot
                  title="Filtrar por equipos sin integrantes activos"
                />
              </>
            )}
          </HeaderCounts>
        }
        action={
          canWrite && (
            <Button size="sm" onClick={() => setModal("nuevo")} disabled={busyId !== null}>
              <Plus className="h-[15px] w-[15px]" />
              Nuevo equipo
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
              placeholder="Buscar equipo…"
              className="w-[260px]"
            />
            {search && <ClearFiltersButton onClick={() => setSearch("")} title="Limpiar búsqueda" />}
          </>
        }
        footer={
          <ListPagination
            data={data}
            page={page}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
            noun="equipos"
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
              ? "Ningún equipo coincide con este filtro o búsqueda."
              : "Todavía no hay ningún equipo registrado."
          }
          onClear={isFiltering ? clearFilters : undefined}
        >
          <DataTable>
            <thead>
              <HeadRow>
                <Th>Equipo</Th>
                <Th>Planta</Th>
                <Th>Integrantes</Th>
                <Th>Estado</Th>
                {canWrite && <Th className="w-32 text-right">Acciones</Th>}
              </HeadRow>
            </thead>

            <tbody>
              {rows.map((team) => (
                <Row key={team.id} busy={busyId === team.id}>
                  <Td className="text-[12.5px] font-medium text-ink">{team.name}</Td>
                  <Td className="text-[12.5px] text-subtle">
                    {team.plantName ?? <span className="text-faint">Sin planta</span>}
                  </Td>
                  <Td className="text-[12.5px] text-subtle">
                    {team.memberCount === 0 ? (
                      <span className="text-faint">Sin integrantes</span>
                    ) : (
                      team.memberCount
                    )}
                  </Td>
                  <Td>
                    <StatusDot active={team.isActive} />
                  </Td>
                  {canWrite && (
                    <Td>
                      <CatalogRowActions
                        name={team.name}
                        isActive={team.isActive}
                        busy={busyId === team.id}
                        onEdit={() => setModal(team)}
                        onToggle={() => askToggle(team)}
                        onDelete={() => askDelete(team)}
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
        <TeamModal
          team={modal === "nuevo" ? undefined : modal}
          onClose={() => setModal(null)}
          onSaved={refresh}
          onMembersChanged={refresh}
        />
      )}

      {dialog}
    </>
  );
}
