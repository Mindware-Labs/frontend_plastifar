import { Pencil, Plus, Power } from "lucide-react";
import { useState } from "react";
import { territoriesApi, type TerritoryQuery } from "../../api/territories";
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
import { usePagedList } from "../../hooks/usePagedList";
import { usePermissions } from "../../hooks/usePermissions";
import type { Territory } from "../../types/clients";
import { ChipGroup, LoadErrorAlert } from "./catalogSection";
import { freshCopy, staleClass } from "./catalogState";
import { SettingsLayout } from "./SettingsLayout";
import { TerritoryModal } from "./TerritoryModal";

type ChipKey = "todos" | "activos" | "inactivos";

/** El listado siempre manda pagina; en el catalogo de opciones es opcional. */
type PagedTerritoryQuery = TerritoryQuery & { page: number };

export function TerritoriesSection() {
  const { can } = usePermissions();
  const canWrite = can("settings.write");

  const [busyId, setBusyId] = useState<number | null>(null);

  const [search, setSearch] = useState("");
  const [chip, setChip] = useState<ChipKey>("todos");
  const [pageSize, setPageSize] = useState(10);

  const [modal, setModal] = useState<"nuevo" | Territory | null>(null);
  const [confirmation, setConfirmation] = useState<Omit<ConfirmDialogProps, "onClose"> | null>(null);

  const debouncedSearch = useDebouncedValue(search).trim();

  // Seccion 4.1: la pagina, el filtro, la busqueda y los contadores los resuelve
  // SQL. La vista solo dibuja lo que llega.
  const { data, isStale, error, page, setPage, refresh } = usePagedList<
    PagedTerritoryQuery,
    Awaited<ReturnType<typeof territoriesApi.list>>
  >({
    fetch: territoriesApi.list,
    criteria: {
      pageSize,
      search: debouncedSearch || undefined,
      status: chip === "todos" ? undefined : chip,
    },
    fallbackError: "No se pudieron cargar los territorios",
  });

  const rows = data?.items ?? [];
  const counts = data?.counts;
  const isFirstLoad = data === null && error === null;
  // Sin criterio activo, una pagina vacia significa catalogo vacio; con
  // criterio, que nada coincide. Los contadores no distinguen ese caso: se
  // calculan sobre el filtro base, no sobre la tabla entera.
  const isFiltering = debouncedSearch !== "" || chip !== "todos";

  function askToggle(territory: Territory) {
    setConfirmation({
      tone: "warn",
      icon: Power,
      title: territory.isActive ? "Desactivar territorio" : "Reactivar territorio",
      description: territory.isActive ? (
        <>
          <strong className="font-semibold text-ink">{territory.name}</strong> dejará de ofrecerse al
          registrar un cliente. {territory.clientCount}{" "}
          {territory.clientCount === 1
            ? "cliente que ya lo usa conserva"
            : "clientes que ya lo usan conservan"}{" "}
          su zona.
        </>
      ) : (
        <>
          <strong className="font-semibold text-ink">{territory.name}</strong> vuelve a estar
          disponible al registrar un cliente.
        </>
      ),
      confirmLabel: territory.isActive ? "Desactivar" : "Reactivar",
      onConfirm: async () => {
        setBusyId(territory.id);
        try {
          const current = await freshCopy(territoriesApi.get, territory);
          await territoriesApi.update(current.id, {
            code: current.code,
            name: current.name,
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
    <SettingsLayout
      title="Territorios"
      note="El territorio es obligatorio al registrar un cliente: alimenta el ranking comercial por zona y vendedor. Uno con historial no se elimina: se desactiva."
      action={
        canWrite && (
          <Button size="sm" onClick={() => setModal("nuevo")} disabled={busyId !== null}>
            <Plus className="h-[15px] w-[15px]" />
            Nuevo territorio
          </Button>
        )
      }
    >
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Buscar por nombre o código…"
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
      </div>

      {error && <LoadErrorAlert message={error} onRetry={refresh} />}

      {isFirstLoad ? (
        <div className="flex justify-center py-16">
          <Spinner />
        </div>
      ) : data === null ? null : rows.length === 0 ? (
        <p className="py-14 text-center text-[13.5px] text-faint">
          {isFiltering
            ? "Ningún territorio coincide con este filtro o búsqueda."
            : "Todavía no hay ningún territorio registrado."}
        </p>
      ) : (
        <div className={staleClass(isStale)}>
          <DataTable>
            <thead>
              <HeadRow>
                <Th>Código</Th>
                <Th>Territorio</Th>
                <Th>Clientes</Th>
                <Th>Estado</Th>
                {canWrite && <Th className="w-24 text-right">Acciones</Th>}
              </HeadRow>
            </thead>

            <tbody>
              {rows.map((territory) => (
                <Row key={territory.id} busy={busyId === territory.id}>
                  <Td>
                    <span className="font-mono text-[12px] text-brand-gray">{territory.code}</span>
                  </Td>
                  <Td className="text-[12.5px] font-medium text-ink">{territory.name}</Td>
                  <Td>
                    {territory.clientCount > 0 ? (
                      <Badge>
                        <span className="tabular-nums">{territory.clientCount}</span>
                      </Badge>
                    ) : (
                      <span className="text-[12.5px] text-faint">Ninguno</span>
                    )}
                  </Td>
                  <Td>
                    <StatusDot active={territory.isActive} />
                  </Td>
                  {canWrite && (
                    <Td>
                      <div className="flex items-center justify-end gap-1">
                        <RowAction
                          label={`Editar ${territory.name}`}
                          icon={Pencil}
                          onClick={() => setModal(territory)}
                          disabled={busyId === territory.id}
                        />
                        <RowAction
                          label={
                            territory.isActive
                              ? `Desactivar ${territory.name}`
                              : `Reactivar ${territory.name}`
                          }
                          icon={Power}
                          onClick={() => askToggle(territory)}
                          disabled={busyId === territory.id}
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

      {data !== null && data.total > 0 && (
        <Pagination
          page={page}
          pageSize={pageSize}
          total={data.total}
          totalPages={data.totalPages}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
          noun="territorios"
        />
      )}


      {modal !== null && (
        <TerritoryModal
          territory={modal === "nuevo" ? undefined : modal}
          onClose={() => setModal(null)}
          onSaved={refresh}
        />
      )}

      {confirmation && <ConfirmDialog {...confirmation} onClose={() => setConfirmation(null)} />}
    </SettingsLayout>
  );
}
