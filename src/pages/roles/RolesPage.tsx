import { Pencil, Plus, Trash2, X } from "lucide-react";
import { useState } from "react";
import { rolesApi, type RoleQuery } from "../../api/roles";
import { ModuleHeader } from "../../components/app/ModuleHeader";
import { Alert } from "../../components/ui/Alert";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { ConfirmDialog, type ConfirmDialogProps } from "../../components/ui/ConfirmDialog";
import { DataTable, HeadRow, Row, Td, Th } from "../../components/ui/DataTable";
import { Pagination } from "../../components/ui/Pagination";
import { RowAction } from "../../components/ui/RowAction";
import { SearchInput } from "../../components/ui/SearchInput";
import { SegmentedFilter } from "../../components/ui/SegmentedFilter";
import { Spinner } from "../../components/ui/Spinner";
import { StatusDot } from "../../components/ui/StatusDot";
import { useAuth } from "../../context/useAuth";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";
import { usePagedList } from "../../hooks/usePagedList";
import type { RoleListResponse, RoleResponse } from "../../types/api";
import { RoleModal } from "./RoleModal";

type FilterKey = "todos" | "activos" | "sistema" | "personalizados";

const filters: { key: FilterKey; label: string; countKey: keyof RoleListResponse["counts"] }[] = [
  { key: "todos", label: "Todos", countKey: "all" },
  { key: "activos", label: "Activos", countKey: "active" },
  { key: "sistema", label: "Del sistema", countKey: "system" },
  { key: "personalizados", label: "Personalizados", countKey: "custom" },
];

export function RolesPage() {
  const { user } = useAuth();
  const isAdmin = Boolean(user?.isAdmin);

  const [busyId, setBusyId] = useState<number | null>(null);
  const [confirmation, setConfirmation] = useState<Omit<ConfirmDialogProps, "onClose"> | null>(
    null,
  );
  // null = cerrado, "nuevo" = alta, un RoleResponse = edicion de esa fila.
  const [modal, setModal] = useState<"nuevo" | RoleResponse | null>(null);

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterKey>("todos");
  const [pageSize, setPageSize] = useState(10);
  const debouncedSearch = useDebouncedValue(search).trim();

  const { data, isStale, error, setPage, refresh } = usePagedList<RoleQuery, RoleListResponse>({
    fetch: rolesApi.list,
    criteria: { pageSize, search: debouncedSearch || undefined, status: filter },
    fallbackError: "No se pudieron cargar los roles",
  });

  const rows = data?.items ?? [];
  const counts = data?.counts;
  const unfiltered = filter === "todos" && !debouncedSearch;

  /** Los roles del sistema no se tocan: sostienen los permisos base. */
  function canManage(role: RoleResponse) {
    return isAdmin && !role.isSystem;
  }

  function askDelete(role: RoleResponse) {
    setConfirmation({
      tone: "danger",
      icon: Trash2,
      eyebrow: "Personal · Roles",
      title: "Eliminar rol",
      description: (
        <>
          Se eliminará el rol <strong className="font-semibold text-ink">{role.name}</strong>. Esta
          acción no se puede deshacer. Si ya está asignado a alguien, desactívalo en su lugar.
        </>
      ),
      confirmLabel: "Eliminar",
      // El error sube al diálogo, que lo muestra sin cerrarse.
      onConfirm: async () => {
        setBusyId(role.id);
        try {
          await rolesApi.remove(role.id);
          refresh();
        } finally {
          setBusyId(null);
        }
      },
    });
  }

  return (
    <div className="flex h-full flex-col">
      <ModuleHeader
        title="Personal"
        summary={
          counts
            ? `${counts.all} roles definidos · ${counts.custom} personalizados · los permisos llegan en una fase posterior`
            : "Cargando los roles del sistema…"
        }
        action={
          isAdmin && (
            <Button size="sm" onClick={() => setModal("nuevo")}>
              <Plus className="h-[15px] w-[15px]" />
              Nuevo rol
            </Button>
          )
        }
      />

      <div className="min-h-0 flex-1 overflow-y-auto pb-8">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder="Buscar por nombre de rol…"
              className="w-[240px] sm:w-[260px]"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                title="Limpiar búsqueda"
                className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-2.5 text-[12.5px] font-medium text-zinc-600 shadow-2xs hover:bg-zinc-50 hover:border-zinc-300 transition-all cursor-pointer active:scale-[0.98]"
              >
                <X className="h-3.5 w-3.5 text-zinc-400" />
                <span>Limpiar</span>
              </button>
            )}
          </div>

          <SegmentedFilter
            aria-label="Filtro de roles"
            value={filter}
            onChange={setFilter}
            items={filters.map(({ key, label, countKey }) => ({
              key,
              label,
              count: counts?.[countKey] ?? 0,
            }))}
          />
        </div>

        {error && (
          <div className="mb-3">
            <Alert variant="error">{error}</Alert>
          </div>
        )}

        {data === null ? (
          <div className="flex justify-center py-16">
            <Spinner />
          </div>
        ) : (
          <div className={`transition-opacity ${isStale ? "opacity-60" : ""}`}>
            <DataTable>
              <thead>
                <HeadRow>
                  <Th>Nombre</Th>
                  <Th>Tipo</Th>
                  <Th>Estado</Th>
                  {isAdmin && <Th className="w-24 text-right">Acciones</Th>}
                </HeadRow>
              </thead>
              <tbody>
                {rows.map((role) => (
                  <Row key={role.id} busy={busyId === role.id}>
                    <Td className="text-[13px] font-medium text-ink">{role.name}</Td>
                    <Td>
                      {role.isSystem ? (
                        <Badge>Sistema</Badge>
                      ) : (
                        <Badge tone="green">Personalizado</Badge>
                      )}
                    </Td>
                    <Td>
                      <StatusDot active={role.isActive} />
                    </Td>
                    {isAdmin && (
                      <Td>
                        {canManage(role) && (
                          <div className="flex items-center justify-end gap-1">
                            <RowAction
                              label={`Editar el rol ${role.name}`}
                              icon={Pencil}
                              onClick={() => setModal(role)}
                              disabled={busyId === role.id}
                            />
                            <RowAction
                              label={`Eliminar el rol ${role.name}`}
                              icon={Trash2}
                              onClick={() => askDelete(role)}
                              disabled={busyId === role.id}
                              danger
                            />
                          </div>
                        )}
                      </Td>
                    )}
                  </Row>
                ))}
              </tbody>
            </DataTable>

            {rows.length === 0 && (
              <p className="py-14 text-center text-[13.5px] text-faint">
                {unfiltered
                  ? "Todavía no hay roles creados."
                  : "Ningún rol coincide con este filtro o búsqueda."}
              </p>
            )}

            <Pagination
              page={data.page}
              pageSize={data.pageSize}
              total={data.total}
              totalPages={data.totalPages}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
              noun="roles"
            />
          </div>
        )}
      </div>

      {confirmation && (
        <ConfirmDialog {...confirmation} onClose={() => setConfirmation(null)} />
      )}

      {modal !== null && (
        <RoleModal
          role={modal === "nuevo" ? undefined : modal}
          onClose={() => setModal(null)}
          onSaved={refresh}
        />
      )}
    </div>
  );
}
