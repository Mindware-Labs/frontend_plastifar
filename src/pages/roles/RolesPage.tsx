import { Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { rolesApi, type RoleQuery } from "../../api/roles";
import { ModuleHeader } from "../../components/app/ModuleHeader";
import { Alert } from "../../components/ui/Alert";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { ConfirmDialog, type ConfirmDialogProps } from "../../components/ui/ConfirmDialog";
import { DataTable, HeadRow, Row, Td, Th } from "../../components/ui/DataTable";
import { FilterChip } from "../../components/ui/FilterChip";
import { Pagination } from "../../components/ui/Pagination";
import { RowAction } from "../../components/ui/RowAction";
import { SearchInput } from "../../components/ui/SearchInput";
import { Spinner } from "../../components/ui/Spinner";
import { StatusDot } from "../../components/ui/StatusDot";
import { usePermissions } from "../../hooks/usePermissions";
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
  const { can } = usePermissions();
  const canWrite = can("roles.write");

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
    return canWrite && !role.isSystem;
  }

  function askDelete(role: RoleResponse) {
    setConfirmation({
      tone: "danger",
      icon: Trash2,
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
    <div>
      <ModuleHeader
        action={
          canWrite && (
            <Button size="sm" onClick={() => setModal("nuevo")}>
              <Plus className="h-[15px] w-[15px]" />
              Nuevo rol
            </Button>
          )
        }
      />

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Buscar por nombre…"
          className="w-[240px]"
        />

        <span aria-hidden className="mx-1 h-5 w-px bg-line" />

        {/* Esqueleto antes de la primera respuesta: un cero es una afirmacion. */}
        {counts === undefined
          ? filters.map(({ key }) => (
              <span key={key} aria-hidden className="h-8 w-[104px] animate-pulse rounded-full bg-fill" />
            ))
          : filters.map(({ key, label, countKey }) => (
              <FilterChip
                key={key}
                label={label}
                count={counts[countKey]}
                active={filter === key}
                onClick={() => setFilter(key)}
              />
            ))}
      </div>

      {error && (
        <div className="mb-3 flex items-start gap-3">
          <Alert variant="error">{error}</Alert>
          <Button size="sm" variant="secondary" onClick={refresh}>
            Reintentar
          </Button>
        </div>
      )}

      {/* Con error no queda spinner girando debajo del aviso. */}
      {data === null ? (
        error === null && (
          <div className="flex justify-center py-16">
            <Spinner />
          </div>
        )
      ) : (
        <div className={`transition-opacity ${isStale ? "opacity-60" : ""}`}>
          {/* Sin filas se retira la tabla entera: dejar la cabecera puesta deja
              el mensaje colgando bajo un filete de columnas que no existen. */}
          {rows.length === 0 ? (
            <p className="py-14 text-center text-[13.5px] text-faint">
              {unfiltered
                ? "Todavía no hay roles registrados."
                : "Ningún rol coincide con este filtro o búsqueda."}
            </p>
          ) : (
          <DataTable>
            <thead>
              <HeadRow>
                <Th>Nombre</Th>
                <Th>Tipo</Th>
                <Th>Estado</Th>
                {canWrite && <Th className="w-24 text-right">Acciones</Th>}
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
                  {canWrite && (
                    <Td>
                      {/* Un rol del sistema conserva sus dos acciones, apagadas y
                          con el motivo en la etiqueta: una celda vacia obliga a
                          adivinar si falta el permiso o si el rol no se toca. */}
                      <div className="flex items-center justify-end gap-1">
                        <RowAction
                          label={
                            role.isSystem
                              ? "Los roles del sistema no se editan: sostienen los permisos base"
                              : `Editar el rol ${role.name}`
                          }
                          icon={Pencil}
                          onClick={() => setModal(role)}
                          disabled={!canManage(role) || busyId === role.id}
                        />
                        <RowAction
                          label={
                            role.isSystem
                              ? "Los roles del sistema no se eliminan: sostienen los permisos base"
                              : `Eliminar el rol ${role.name}`
                          }
                          icon={Trash2}
                          onClick={() => askDelete(role)}
                          disabled={!canManage(role) || busyId === role.id}
                          danger
                        />
                      </div>
                    </Td>
                  )}
                </Row>
              ))}
            </tbody>
          </DataTable>
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
