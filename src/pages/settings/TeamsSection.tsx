import { Pencil, Plus, Power, Trash2 } from "lucide-react";
import { useState } from "react";
import { settingsApi } from "../../api/settings";
import { ModuleHeader } from "../../components/app/ModuleHeader";
import { Button } from "../../components/ui/Button";
import { ConfirmDialog, type ConfirmDialogProps } from "../../components/ui/ConfirmDialog";
import { DataTable, HeadRow, Row, Td, Th } from "../../components/ui/DataTable";
import { FilterChip } from "../../components/ui/FilterChip";
import { ListPanel } from "../../components/ui/ListPanel";
import { Pagination } from "../../components/ui/Pagination";
import { RowAction } from "../../components/ui/RowAction";
import { SearchInput } from "../../components/ui/SearchInput";
import { TableSkeleton } from "../../components/ui/Skeleton";
import { StatusDot } from "../../components/ui/StatusDot";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";
import { usePagedList } from "../../hooks/usePagedList";
import { usePermissions } from "../../hooks/usePermissions";
import type { Team } from "../../types/settings";
import { ChipGroup, LoadErrorAlert } from "./catalogSection";
import { freshCopy, staleClass } from "./catalogState";
import { TeamModal } from "./TeamModal";

type ChipKey = "todos" | "activos" | "inactivos";

export function TeamsSection() {
  const { can } = usePermissions();
  const canWrite = can("settings.write");

  const [busyId, setBusyId] = useState<number | null>(null);

  const [search, setSearch] = useState("");
  const [chip, setChip] = useState<ChipKey>("todos");
  // Regla 4 del plan: localizar los equipos sin ningun integrante activo
  // (vacios, o con todos desactivados). Es un filtro aparte del estado.
  const [onlyWithoutMembers, setOnlyWithoutMembers] = useState(false);
  const [pageSize, setPageSize] = useState(10);

  const [modal, setModal] = useState<"nuevo" | Team | null>(null);
  const [confirmation, setConfirmation] = useState<Omit<ConfirmDialogProps, "onClose"> | null>(null);

  const debouncedSearch = useDebouncedValue(search).trim();

  // Seccion 4.1: la pagina, los filtros, la busqueda, los contadores y el
  // numero de integrantes los resuelve SQL. La vista solo dibuja lo que llega.
  const { data, isStale, error, page, setPage, refresh } = usePagedList({
    fetch: settingsApi.teams.list,
    criteria: {
      pageSize,
      search: debouncedSearch || undefined,
      status: chip === "todos" ? undefined : chip,
      members: onlyWithoutMembers ? ("sin-activos" as const) : undefined,
    },
    fallbackError: "No se pudieron cargar los equipos",
  });

  const rows = data?.items ?? [];
  const counts = data?.counts;
  const isFiltering = debouncedSearch !== "" || chip !== "todos" || onlyWithoutMembers;

  /* El servidor es quien sabe si el equipo conserva integrantes: su 409 sube al
     dialogo con el motivo, y las salidas que ofrece son quitarlos o desactivarlo. */
  function askDelete(team: Team) {
    setConfirmation({
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
        setBusyId(team.id);
        try {
          await settingsApi.teams.remove(team.id);
          refresh();
        } finally {
          setBusyId(null);
        }
      },
    });
  }

  function askToggle(team: Team) {
    setConfirmation({
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
        setBusyId(team.id);
        try {
          const current = await freshCopy(settingsApi.teams.get, team);
          await settingsApi.teams.update(current.id, {
            name: current.name,
            plantId: current.plantId,
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
        title="Equipos"
        summary={
          counts
            ? `${counts.all} ${counts.all === 1 ? "equipo" : "equipos"} · ${counts.active} ${counts.active === 1 ? "activo" : "activos"}`
            : "Cargando los equipos de trabajo…"
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
              className="w-[240px]"
            />

            <span aria-hidden className="mx-1 h-5 w-px bg-line" />

            <ChipGroup label="Filtrar por estado" ready={counts !== undefined}>
              <FilterChip
                label="Todos"
                count={counts?.all ?? 0}
                active={chip === "todos"}
                onClick={() => setChip("todos")}
              />
              <FilterChip
                label="Activos"
                count={counts?.active ?? 0}
                active={chip === "activos"}
                onClick={() => setChip("activos")}
              />
              <FilterChip
                label="Inactivos"
                count={counts?.inactive ?? 0}
                active={chip === "inactivos"}
                onClick={() => setChip("inactivos")}
              />
            </ChipGroup>

            <span aria-hidden className="mx-1 h-5 w-px bg-line" />

            <ChipGroup label="Filtrar por integrantes" ready={counts !== undefined} skeletonCount={1}>
              <FilterChip
                label="Sin integrantes activos"
                count={counts?.withoutActiveMembers ?? 0}
                active={onlyWithoutMembers}
                onClick={() => setOnlyWithoutMembers((current) => !current)}
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
              noun="equipos"
            />
          )
        }
      >
        {data === null ? (
          error === null && <TableSkeleton rows={pageSize} columns={4} />
        ) : rows.length === 0 ? (
          <p className="py-14 text-center text-[13.5px] text-faint">
            {isFiltering
              ? "Ningún equipo coincide con este filtro o búsqueda."
              : "Todavía no hay ningún equipo registrado."}
          </p>
        ) : (
          <div className={staleClass(isStale)}>
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
                        <div className="flex items-center justify-end gap-1">
                          <RowAction
                            label={`Editar ${team.name}`}
                            icon={Pencil}
                            onClick={() => setModal(team)}
                            disabled={busyId === team.id}
                          />
                          <RowAction
                            label={team.isActive ? `Desactivar ${team.name}` : `Reactivar ${team.name}`}
                            icon={Power}
                            onClick={() => askToggle(team)}
                            disabled={busyId === team.id}
                          />
                          <RowAction
                            label={`Eliminar ${team.name}`}
                            icon={Trash2}
                            danger
                            onClick={() => askDelete(team)}
                            disabled={busyId === team.id}
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
        <TeamModal
          team={modal === "nuevo" ? undefined : modal}
          onClose={() => setModal(null)}
          onSaved={refresh}
          onMembersChanged={refresh}
        />
      )}

      {confirmation && <ConfirmDialog {...confirmation} onClose={() => setConfirmation(null)} />}
    </>
  );
}
