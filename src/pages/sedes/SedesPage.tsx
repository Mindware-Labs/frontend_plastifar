import {
  Ban,
  Building,
  CheckCircle2,
  Plus,
  Trash2,
} from "lucide-react";
import { useState } from "react";
import { sedesApi } from "../../api/sedes";
import { HeaderCounts } from "../../components/app/HeaderCounts";
import { ModuleHeader } from "../../components/app/ModuleHeader";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { DataTable, HeadRow, Row, Td, Th } from "../../components/ui/DataTable";
import { ClearFiltersButton, FilterDropdown } from "../../components/ui/FilterDropdown";
import { HeaderTag } from "../../components/ui/HeaderTag";
import { ListPanel } from "../../components/ui/ListPanel";
import { ListPagination } from "../../components/ui/ListPagination";
import { SearchInput } from "../../components/ui/SearchInput";
import { TableSkeleton } from "../../components/ui/Skeleton";
import { StatusDot } from "../../components/ui/StatusDot";
import { useCatalogActions } from "../../hooks/useCatalogActions";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";
import { usePagedList } from "../../hooks/usePagedList";
import { usePermissions } from "../../hooks/usePermissions";
import type { Sede, SedeQuery } from "../../types/sedes";
import { LoadErrorAlert } from "../settings/catalogSection";
import { CatalogRowActions } from "../settings/CatalogRowActions";
import { SedeModal } from "./SedeModal";

type ChipKey = "todos" | "activos" | "inactivos";
type PagedSedeQuery = SedeQuery & { page: number };

export function SedesPage() {
  const { can } = usePermissions();
  const canWrite = can("settings.write");

  const { modal, setModal, busyId, confirm, dialog } = useCatalogActions<Sede>();
  const [search, setSearch] = useState("");
  const [chip, setChip] = useState<ChipKey>("todos");
  const [pageSize, setPageSize] = useState(15);

  const debouncedSearch = useDebouncedValue(search).trim();

  const { data, isStale, error, page, setPage, refresh } = usePagedList<
    PagedSedeQuery,
    Awaited<ReturnType<typeof sedesApi.list>>
  >({
    fetch: sedesApi.list,
    criteria: {
      pageSize,
      search: debouncedSearch || undefined,
      status: chip === "todos" ? undefined : chip,
      includeInactive: true,
    },
    fallbackError: "No se pudieron cargar las sedes",
  });

  const rows = data?.items ?? [];
  const counts = data?.counts;
  const isFiltering = debouncedSearch !== "" || chip !== "todos";

  function askToggle(sede: Sede) {
    const willDeactivate = sede.isActive;
    confirm(sede.id, {
      tone: "warn",
      icon: willDeactivate ? Ban : CheckCircle2,
      title: willDeactivate ? "Desactivar sede" : "Reactivar sede",
      description: willDeactivate ? (
        <>
          <strong className="font-semibold text-ink">{sede.name}</strong> dejará de ofrecerse al
          asignar sede a un departamento.{" "}
          {sede.departmentCount > 0 ? (
            <>
              {sede.departmentCount}{" "}
              {sede.departmentCount === 1
                ? "departamento la conserva asignada."
                : "departamentos la conservan asignada."}
            </>
          ) : (
            <>No hay ningún departamento asignado a ella.</>
          )}
        </>
      ) : (
        <>
          <strong className="font-semibold text-ink">{sede.name}</strong> vuelve a estar disponible
          para asociarle departamentos.
        </>
      ),
      confirmLabel: willDeactivate ? "Desactivar" : "Reactivar",
      onConfirm: async () => {
        const current = await sedesApi.get(sede.id);
        await sedesApi.update(current.id, {
          name: current.name,
          address: current.address,
          isActive: !current.isActive,
        });
        refresh();
      },
    });
  }

  function askDelete(sede: Sede) {
    confirm(sede.id, {
      tone: "danger",
      icon: Trash2,
      title: "Eliminar sede",
      description: (
        <>
          <strong className="font-semibold text-ink">{sede.name}</strong> se eliminará de forma
          permanente.
        </>
      ),
      confirmLabel: "Eliminar",
      onConfirm: async () => {
        await sedesApi.remove(sede.id);
        refresh();
      },
    });
  }

  return (
    <div className="flex h-full flex-col">
      <ModuleHeader
        title="Sedes"
        summary={
          <HeaderCounts counts={counts} loadingLabel="Cargando catálogo de sedes…">
            {(counts) => (
              <>
                <HeaderTag
                  label={counts.all === 1 ? "sede" : "sedes"}
                  count={counts.all}
                  active={chip === "todos"}
                  onClick={() => setChip("todos")}
                  tone="neutral"
                  title="Mostrar todas las sedes"
                />
                <HeaderTag
                  label={counts.active === 1 ? "activa" : "activas"}
                  count={counts.active}
                  active={chip === "activos"}
                  onClick={() => setChip("activos")}
                  tone="emerald"
                  dot
                  title="Filtrar por sedes activas"
                />
                <HeaderTag
                  label={counts.inactive === 1 ? "inactiva" : "inactivas"}
                  count={counts.inactive}
                  active={chip === "inactivos"}
                  onClick={() => setChip("inactivos")}
                  tone="red"
                  dot
                  title="Filtrar por sedes inactivas"
                />
              </>
            )}
          </HeaderCounts>
        }
        action={
          canWrite && (
            <Button size="sm" onClick={() => setModal("nuevo")} disabled={busyId !== null}>
              <Plus className="h-[15px] w-[15px]" />
              Nueva sede
            </Button>
          )
        }
      />

      {error && <LoadErrorAlert message={error} onRetry={refresh} />}

      <div className="min-h-0 flex-1 overflow-y-auto pb-8">
        <ListPanel
          toolbar={
            <div className="flex flex-wrap items-center justify-between gap-3 w-full">
              <div className="flex flex-wrap items-center gap-2">
                <SearchInput
                  value={search}
                  onChange={setSearch}
                  placeholder="Buscar sede por nombre o dirección…"
                  className="w-[260px] sm:w-[300px]"
                />
                <FilterDropdown
                  title="Estado"
                  aria-label="Filtrar por estado de la sede"
                  value={chip}
                  onChange={(next) => setChip(next as ChipKey)}
                  options={[
                    { value: "todos", label: "Todas las sedes" },
                    { value: "activos", label: "Activas" },
                    { value: "inactivos", label: "Inactivas" },
                  ]}
                />
                {isFiltering && (
                  <ClearFiltersButton
                    onClick={() => {
                      setSearch("");
                      setChip("todos");
                    }}
                  />
                )}
              </div>
            </div>
          }
          footer={
            <ListPagination
              data={data}
              page={page}
              pageSize={pageSize}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
              noun="sedes"
            />
          }
        >
          {data === undefined ? (
            !error && <TableSkeleton rows={6} columns={5} />
          ) : rows.length === 0 ? (
            <p className="py-14 text-center text-[13.5px] text-faint">
              {isFiltering
                ? "Ninguna sede coincide con este filtro o búsqueda."
                : "Todavía no hay ninguna sede registrada."}
            </p>
          ) : (
            <DataTable>
              <thead>
                <HeadRow>
                  <Th>Nombre de la sede</Th>
                  <Th>Dirección / Ubicación</Th>
                  <Th className="w-36 text-center">Departamentos</Th>
                  <Th className="w-24">Estado</Th>
                  {canWrite && <Th className="w-24 text-right">Acciones</Th>}
                </HeadRow>
              </thead>
              <tbody className={isStale ? "opacity-60 transition-opacity" : ""}>
                {rows.map((sede) => (
                  <Row key={sede.id} busy={busyId === sede.id}>
                    {/* 1. NOMBRE */}
                    <Td>
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-zinc-200 bg-zinc-50 text-zinc-600">
                          <Building className="h-3.5 w-3.5" />
                        </div>
                        <span className="font-medium text-[13px] text-ink">{sede.name}</span>
                      </div>
                    </Td>

                    {/* 2. DIRECCIÓN */}
                    <Td>
                      {sede.address ? (
                        <span className="text-[12.5px] text-zinc-700">{sede.address}</span>
                      ) : (
                        <span className="text-[12px] text-zinc-400 italic">Sin dirección registrada</span>
                      )}
                    </Td>

                    {/* 3. DEPARTAMENTOS ASOCIADOS */}
                    <Td className="text-center">
                      <Badge tone={sede.departmentCount > 0 ? "slate" : "neutral"}>
                        {sede.departmentCount}{" "}
                        {sede.departmentCount === 1 ? "departamento" : "departamentos"}
                      </Badge>
                    </Td>

                    {/* 4. ESTADO */}
                    <Td>
                      <StatusDot active={sede.isActive} />
                    </Td>

                    {/* 5. ACCIONES */}
                    {canWrite && (
                      <Td>
                        <CatalogRowActions
                          name={sede.name}
                          isActive={sede.isActive}
                          busy={busyId === sede.id}
                          onEdit={() => setModal(sede)}
                          onToggle={() => askToggle(sede)}
                          onDelete={sede.departmentCount === 0 ? () => askDelete(sede) : undefined}
                        />
                      </Td>
                    )}
                  </Row>
                ))}
              </tbody>
            </DataTable>
          )}
        </ListPanel>
      </div>

      {modal !== null && (
        <SedeModal
          sede={modal === "nuevo" ? undefined : modal}
          onClose={() => setModal(null)}
          onSaved={() => refresh()}
        />
      )}

      {dialog}
    </div>
  );
}
