import { Pencil, Plus, Power } from "lucide-react";
import { useCallback, useState } from "react";
import { territoriesApi } from "../../api/territories";
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
import { useLocalPage } from "../../hooks/useLocalPage";
import { usePermissions } from "../../hooks/usePermissions";
import type { Territory } from "../../types/clients";
import { ChipGroup, LoadErrorAlert } from "./catalogSection";
import { freshCopy, staleClass, useSectionLoad } from "./catalogState";
import { SettingsLayout } from "./SettingsLayout";
import { TerritoryModal } from "./TerritoryModal";

type ChipKey = "todos" | "activos" | "inactivos";

const listTerritories = () => territoriesApi.list({ page: 1, pageSize: 100 });

export function TerritoriesSection() {
  const { can } = usePermissions();
  const canWrite = can("settings.write");

  const [territories, setTerritories] = useState<Territory[]>([]);
  const [busyId, setBusyId] = useState<number | null>(null);

  const [search, setSearch] = useState("");
  const [chip, setChip] = useState<ChipKey>("todos");

  const [modal, setModal] = useState<"nuevo" | Territory | null>(null);
  const [confirmation, setConfirmation] = useState<Omit<ConfirmDialogProps, "onClose"> | null>(null);

  const debouncedSearch = useDebouncedValue(search).trim().toLowerCase();

  const load = useCallback(async () => {
    const { items } = await listTerritories();
    setTerritories(items);
  }, []);

  const { status, isRefetching, error, reload, retry } = useSectionLoad(
    load,
    "No se pudieron cargar los territorios",
  );

  const all = territories;
  const activeCount = all.filter((territory) => territory.isActive).length;

  const rows = all.filter((territory) => {
    const byChip =
      chip === "todos" ||
      (chip === "activos" && territory.isActive) ||
      (chip === "inactivos" && !territory.isActive);

    const bySearch =
      debouncedSearch === "" ||
      territory.name.toLowerCase().includes(debouncedSearch) ||
      territory.code.toLowerCase().includes(debouncedSearch);

    return byChip && bySearch;
  });

  // RF-K2: los listados de catalogo paginan como cualquier otro. El corte
  // lo hace la vista solo mientras no exista /api/settings/...; el endpoint
  // devuelve la pagina ya cortada en SQL (anexo 12.1).
  const { page, pageSize, total, totalPages, pageRows, setPage, changePageSize } = useLocalPage(
    rows,
    JSON.stringify([debouncedSearch, chip]),
  );

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
          const current = await freshCopy(listTerritories, territory);
          await territoriesApi.update(current.id, {
            code: current.code,
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
            ? "Todavía no hay ningún territorio registrado."
            : "Ningún territorio coincide con este filtro o búsqueda."}
        </p>
      ) : (
        <div className={staleClass(isRefetching)}>
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
              {pageRows.map((territory) => (
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

      {status === "ready" && rows.length > 0 && (
        <Pagination
          page={page}
          pageSize={pageSize}
          total={total}
          totalPages={totalPages}
          onPageChange={setPage}
          onPageSizeChange={changePageSize}
          noun="territorios"
        />
      )}

      <p className="mt-4 max-w-[76ch] text-[12px] leading-relaxed text-faint">
        El territorio es obligatorio al registrar un cliente: alimenta el ranking comercial por zona
        y vendedor. Uno con historial no se elimina: se desactiva.
      </p>

      {modal !== null && (
        <TerritoryModal
          territory={modal === "nuevo" ? undefined : modal}
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
