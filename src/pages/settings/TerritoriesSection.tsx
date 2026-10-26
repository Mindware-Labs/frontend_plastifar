import { Ban, CheckCircle2, Pencil, Plus } from "lucide-react";
import { territoriesApi, type TerritoryQuery } from "../../api/territories";
import { HeaderCounts } from "../../components/app/HeaderCounts";
import { ModuleHeader } from "../../components/app/ModuleHeader";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { DataTable, HeadRow, Row, Td, Th } from "../../components/ui/DataTable";
import { ClearFiltersButton } from "../../components/ui/FilterDropdown";
import { HeaderTag } from "../../components/ui/HeaderTag";
import { ListBody } from "../../components/ui/ListBody";
import { ListPanel } from "../../components/ui/ListPanel";
import { ListPagination } from "../../components/ui/ListPagination";
import { RowAction } from "../../components/ui/RowAction";
import { SearchInput } from "../../components/ui/SearchInput";
import { StatusDot } from "../../components/ui/StatusDot";
import { useReceipts } from "../../context/useReceipts";
import { useCatalogActions } from "../../hooks/useCatalogActions";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";
import { usePagedList } from "../../hooks/usePagedList";
import { usePermissions } from "../../hooks/usePermissions";
import { useUrlNumber, useUrlState } from "../../hooks/useUrlState";
import type { Territory } from "../../types/clients";
import { LoadErrorAlert } from "./catalogSection";
import { freshCopy } from "./catalogState";
import { TerritoryModal } from "./TerritoryModal";
import { PAGE_SIZES } from "../../lib/pageSizes";

const CHIPS = ["todos", "activos", "inactivos"] as const;
type ChipKey = (typeof CHIPS)[number];

/** El listado siempre manda pagina; en el catalogo de opciones es opcional. */
type PagedTerritoryQuery = TerritoryQuery & { page: number };

export function TerritoriesSection() {
  const { can } = usePermissions();
  const canWrite = can("settings.write");

  const receipts = useReceipts();
  const { modal, setModal, busyId, confirm, dialog } = useCatalogActions<Territory>();

  const [search, setSearch] = useUrlState<string>("q", "");
  const [chip, setChip] = useUrlState<ChipKey>("estado", "todos", CHIPS);
  const [pageSize, setPageSize] = useUrlNumber("tam", 10, PAGE_SIZES);

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
    pageKey: "pagina",
  });

  const rows = data?.items ?? [];
  const counts = data?.counts;
  // Sin criterio activo, una pagina vacia significa catalogo vacio; con
  // criterio, que nada coincide. Los contadores no distinguen ese caso: se
  // calculan sobre el filtro base, no sobre la tabla entera.
  const isFiltering = debouncedSearch !== "" || chip !== "todos";

  function clearFilters() {
    setSearch("");
    setChip("todos");
  }

  function askToggle(territory: Territory) {
    const willDeactivate = territory.isActive;
    confirm(territory.id, {
      tone: "warn",
      icon: willDeactivate ? Ban : CheckCircle2,
      title: willDeactivate ? "Desactivar territorio" : "Reactivar territorio",
      description: willDeactivate ? (
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
      confirmLabel: willDeactivate ? "Desactivar" : "Reactivar",
      onConfirm: async () => {
        try {
          const current = await freshCopy(territoriesApi.get, territory);
          const nextActive = !current.isActive;
          await territoriesApi.update(current.id, {
            code: current.code,
            name: current.name,
            isActive: nextActive,
          });
          receipts.done({
            action: nextActive ? "reactivar-territorio" : "desactivar-territorio",
            title: nextActive ? "Territorio reactivado" : "Territorio desactivado",
            detail: `${current.name} (${current.code})`,
          });
          refresh();
        } catch (err) {
          receipts.failed({
            action: "toggle-territorio",
            title: willDeactivate ? "No se pudo desactivar el territorio" : "No se pudo reactivar el territorio",
            detail: err instanceof Error ? err.message : undefined,
          });
        }
      },
    });
  }

  return (
    <>
      <ModuleHeader
        title="Territorios"
        summary={
          <HeaderCounts counts={counts} loadingLabel="Cargando los territorios…">
            {(counts) => (
              <>
                <HeaderTag
                  label={counts.all === 1 ? "territorio" : "territorios"}
                  count={counts.all}
                  active={chip === "todos"}
                  onClick={() => {
                    setChip("todos");
                    setPage(1);
                  }}
                  tone="neutral"
                  title="Mostrar todos los territorios"
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
                  title="Filtrar por territorios activos"
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
                  title="Filtrar por territorios inactivos"
                />
              </>
            )}
          </HeaderCounts>
        }
        action={
          canWrite && (
            <Button size="sm" onClick={() => setModal("nuevo")} disabled={busyId !== null}>
              <Plus className="h-[15px] w-[15px]" />
              Nuevo territorio
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
              placeholder="Buscar por nombre o código…"
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
            noun="territorios"
          />
        }
      >
        <ListBody
          data={data}
          error={error}
          isStale={isStale}
          skeletonRows={pageSize}
          skeletonColumns={5}
          empty={
            isFiltering
              ? "Ningún territorio coincide con este filtro o búsqueda."
              : "Todavía no hay ningún territorio registrado."
          }
          onClear={isFiltering ? clearFilters : undefined}
        >
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
                          icon={territory.isActive ? Ban : CheckCircle2}
                          onClick={() => askToggle(territory)}
                          disabled={busyId === territory.id}
                          danger={territory.isActive}
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
        <TerritoryModal
          territory={modal === "nuevo" ? undefined : modal}
          onClose={() => setModal(null)}
          onSaved={(saved) => {
            const isEdit = modal !== "nuevo";
            receipts.done({
              action: isEdit ? "editar-territorio" : "crear-territorio",
              title: isEdit ? "Territorio actualizado" : "Territorio creado exitosamente",
              detail: `${saved.name} (${saved.code})`,
            });
            refresh();
          }}
        />
      )}

      {dialog}
    </>
  );
}
