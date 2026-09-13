import { LogOut, Pencil, Plus, Trash2, UserCheck, UserX } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { departmentsApi } from "../../api/departments";
import { staffApi, type StaffQuery } from "../../api/staff";
import { Alert } from "../../components/ui/Alert";
import { Avatar } from "../../components/ui/Avatar";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { ConfirmDialog, type ConfirmDialogProps } from "../../components/ui/ConfirmDialog";
import { DataTable, HeadRow, Row, Td, Th, type SortDir } from "../../components/ui/DataTable";
import { FilterChip } from "../../components/ui/FilterChip";
import { EmptyResult } from "../../components/ui/EmptyResult";
import { ListPanel } from "../../components/ui/ListPanel";
import { Pagination } from "../../components/ui/Pagination";
import { RowAction } from "../../components/ui/RowAction";
import { SearchInput } from "../../components/ui/SearchInput";
import { Select } from "../../components/ui/Select";
import { TableSkeleton } from "../../components/ui/Skeleton";
import { StatusDot } from "../../components/ui/StatusDot";
import { useAuth } from "../../context/useAuth";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";
import { usePagedList } from "../../hooks/usePagedList";
import type { DepartmentResponse, StaffListResponse, StaffResponse } from "../../types/api";
import { StaffModal } from "./StaffModal";
import { departmentOptions } from "../../lib/departments";

type FilterKey = "todos" | "activos" | "inactivos" | "administradores";
type SortKey = "nombre" | "correo" | "departamento" | "rol" | "estado";

const filters: { key: FilterKey; label: string; countKey: keyof StaffListResponse["counts"] }[] = [
  { key: "todos", label: "Todos", countKey: "all" },
  { key: "activos", label: "Activos", countKey: "active" },
  { key: "inactivos", label: "Inactivos", countKey: "inactive" },
  { key: "administradores", label: "Administradores", countKey: "admins" },
];

/**
 * Orden de columnas: quién, dónde, cómo se le escribe, qué puede hacer, si opera.
 *
 * El correo estaba entre el nombre y el departamento, y eso separaba los dos
 * datos que identifican a una persona dentro de la operación —cómo se llama y
 * en qué departamento está— con una dirección de correo en medio. El correo es
 * un dato de contacto: va después de la identificación, no dentro de ella.
 *
 * `id` NO está acá porque el servidor no lo ordena: las claves que acepta son
 * exactamente estas cinco. Una cabecera ordenable que el backend ignora es una
 * promesa que la pantalla no puede cumplir.
 */
const columns: { key: SortKey; label: string }[] = [
  { key: "nombre", label: "Nombre" },
  { key: "departamento", label: "Departamento" },
  { key: "correo", label: "Correo" },
  { key: "rol", label: "Rol" },
  { key: "estado", label: "Estado" },
];

export function StaffPage() {
  const { user } = useAuth();
  const isAdmin = Boolean(user?.isAdmin);

  const [departments, setDepartments] = useState<DepartmentResponse[]>([]);
  const [busyId, setBusyId] = useState<number | null>(null);
  // Confirmacion propia del panel; null = ninguna pendiente.
  const [confirmation, setConfirmation] = useState<Omit<ConfirmDialogProps, "onClose"> | null>(
    null,
  );
  // null = cerrado, "nuevo" = alta, un StaffResponse = edicion de esa fila.
  const [modal, setModal] = useState<"nuevo" | StaffResponse | null>(null);

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterKey>("todos");
  const [departmentId, setDepartmentId] = useState<number | "todos">("todos");
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({ key: "nombre", dir: "asc" });
  const [pageSize, setPageSize] = useState(10);
  const debouncedSearch = useDebouncedValue(search).trim();

  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  /** Lo que falló en una acción en lote, dicho por nombre y no por conteo. */
  const [bulkError, setBulkError] = useState<string | null>(null);

  useEffect(() => {
    departmentsApi
      .list()
      .then(setDepartments)
      .catch(() => setDepartments([]));
  }, []);

  const { data, isStale, error, setPage, refresh } = usePagedList<StaffQuery, StaffListResponse>({
    fetch: staffApi.list,
    criteria: {
      pageSize,
      search: debouncedSearch || undefined,
      departmentId: departmentId === "todos" ? undefined : departmentId,
      status: filter,
      sort: sort.key,
      dir: sort.dir,
    },
    fallbackError: "No se pudo cargar el personal",
  });

  const rows = data?.items ?? [];
  const counts = data?.counts;
  const unfiltered = filter === "todos" && departmentId === "todos" && !debouncedSearch;

  /** Quita los tres recortes de una vez: es la salida del estado vacio. */
  function clearFilters() {
    setSearch("");
    setDepartmentId("todos");
    setFilter("todos");
    setPage(1);
  }

  /**
   * La selección se descarta en cuanto cambian las filas que están a la vista
   * —otra página, otro filtro, un refresco que reordenó la lista—. Anclarla a
   * las filas y no a los criterios es lo que garantiza que una desactivación en
   * lote no alcance a un colaborador que la persona ya no tiene delante. Mismo
   * mecanismo que el listado de Clientes.
   */
  const visibleIdsKey = rows.map((member) => member.id).join(",");
  const [lastVisibleIdsKey, setLastVisibleIdsKey] = useState(visibleIdsKey);
  if (visibleIdsKey !== lastVisibleIdsKey) {
    setLastVisibleIdsKey(visibleIdsKey);
    setSelectedIds([]);
    setBulkError(null);
  }

  function departmentName(id: number) {
    return departments.find((d) => d.id === id)?.name ?? "—";
  }

  function fullName(member: StaffResponse) {
    return `${member.firstName} ${member.lastName}`;
  }

  function toggleSort(key: SortKey) {
    setSort((prev) =>
      prev.key === key ? { key, dir: prev.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" },
    );
  }

  /** Desactivar y eliminar nunca aplican sobre uno mismo; editar si. */
  function canManage(member: StaffResponse) {
    return isAdmin && member.id !== user?.staffId;
  }

  /* ------------------------------------------------------------------ */
  /*  Selección en lote                                                  */
  /*                                                                     */
  /*  Sólo se puede marcar lo que se puede gestionar. La propia fila no  */
  /*  se marca —nadie se cierra la sesión a sí mismo desde acá— y sin    */
  /*  permisos de administrador la columna entera no se dibuja: una      */
  /*  casilla que al final rechaza la acción es peor que no ofrecerla.   */
  /* ------------------------------------------------------------------ */

  const selectableRows = rows.filter(canManage);
  const selected = selectableRows.filter((member) => selectedIds.includes(member.id));
  const allPageSelected =
    selectableRows.length > 0 && selectableRows.every((member) => selectedIds.includes(member.id));

  function toggleSelection(id: number) {
    setSelectedIds((previous) =>
      previous.includes(id) ? previous.filter((entry) => entry !== id) : [...previous, id],
    );
  }

  function toggleAllOnPage() {
    setSelectedIds((previous) => {
      if (allPageSelected) {
        return previous.filter((id) => !selectableRows.some((member) => member.id === id));
      }
      const ids = new Set(previous);
      for (const member of selectableRows) ids.add(member.id);
      return [...ids];
    });
  }

  /**
   * Una acción sobre varios colaboradores.
   *
   * Va de a uno y a propósito: no hay endpoint en lote, y lanzar cinco
   * peticiones en paralelo contra el mismo recurso deja el servidor resolviendo
   * un orden que nadie pidió. Secuencial además permite lo importante — que un
   * fallo no cancele al resto y que al final se pueda decir QUIÉN quedó afuera.
   *
   * Un «falló en 2 de 5» obliga a adivinar cuáles dos. Los nombres no.
   */
  async function runOnMany(members: StaffResponse[], action: (id: number) => Promise<void>) {
    setBulkError(null);
    const failed: string[] = [];

    for (const member of members) {
      setBusyId(member.id);
      try {
        await action(member.id);
      } catch {
        failed.push(fullName(member));
      }
    }

    setBusyId(null);
    setSelectedIds([]);
    refresh();

    if (failed.length > 0) {
      setBulkError(
        failed.length === 1
          ? `No se pudo completar la acción sobre ${failed[0]}. El resto sí se aplicó.`
          : `No se pudo completar la acción sobre ${failed.length} colaboradores: ${failed.join(", ")}. El resto sí se aplicó.`,
      );
    }
  }

  function askBulkRevokeSessions() {
    const members = selected;
    setConfirmation({
      tone: "warn",
      icon: LogOut,
      eyebrow: "Personal",
      title: `Cerrar sesiones de ${members.length} colaboradores`,
      description: (
        <>
          Se cerrarán todas las sesiones abiertas de{" "}
          <strong className="font-semibold text-ink">{members.map(fullName).join(", ")}</strong>, en
          cualquier dispositivo. Las cuentas siguen activas: podrán volver a entrar con su
          contraseña.
        </>
      ),
      confirmLabel: "Cerrar sesiones",
      onConfirm: () => runOnMany(members, staffApi.revokeSessions),
    });
  }

  function askBulkDeactivate() {
    /* Reactivar no viene en lote: encender accesos de a varios sin mirar a quién
       se le está encendiendo qué es justo lo que el módulo de permisos existe
       para evitar. Apagar en lote es contención; encender en lote es un riesgo. */
    const members = selected.filter((member) => member.isActive);
    setConfirmation({
      tone: "warn",
      icon: UserX,
      eyebrow: "Personal",
      title: `Desactivar ${members.length} colaboradores`,
      description: (
        <>
          <strong className="font-semibold text-ink">{members.map(fullName).join(", ")}</strong>{" "}
          dejarán de poder iniciar sesión y sus sesiones abiertas se cerrarán. Las cuentas y su
          historial se conservan, y puedes reactivarlas una por una cuando quieras.
        </>
      ),
      confirmLabel: "Desactivar",
      onConfirm: () => runOnMany(members, staffApi.deactivate),
    });
  }

  /** El error sube al dialogo, que lo muestra sin cerrarse. */
  async function runOnRow(id: number, action: () => Promise<void>) {
    setBusyId(id);
    try {
      await action();
      refresh();
    } finally {
      setBusyId(null);
    }
  }

  function askDeactivate(member: StaffResponse) {
    setConfirmation({
      tone: "warn",
      icon: UserX,
      eyebrow: "Personal",
      title: "Desactivar colaborador",
      description: (
        <>
          <strong className="font-semibold text-ink">{fullName(member)}</strong> dejará de poder
          iniciar sesión y sus sesiones abiertas se cerrarán. La cuenta y su historial se conservan,
          y puedes reactivarla cuando quieras.
        </>
      ),
      confirmLabel: "Desactivar",
      onConfirm: () => runOnRow(member.id, () => staffApi.deactivate(member.id)),
    });
  }

  function askActivate(member: StaffResponse) {
    setConfirmation({
      tone: "warn",
      icon: UserCheck,
      eyebrow: "Personal",
      title: "Reactivar colaborador",
      description: (
        <>
          <strong className="font-semibold text-ink">{fullName(member)}</strong> volverá a poder
          iniciar sesión con los accesos que ya tenía asignados. Revisa que sigan siendo los
          correctos antes de reactivarlo.
        </>
      ),
      confirmLabel: "Reactivar",
      onConfirm: () => runOnRow(member.id, () => staffApi.activate(member.id)),
    });
  }

  function askRevokeSessions(member: StaffResponse) {
    setConfirmation({
      tone: "warn",
      icon: LogOut,
      eyebrow: "Personal",
      title: "Cerrar sesiones",
      description: (
        <>
          Se cerrarán todas las sesiones abiertas de{" "}
          <strong className="font-semibold text-ink">{fullName(member)}</strong>, en cualquier
          dispositivo. La cuenta sigue activa: podrá volver a entrar con su contraseña.
        </>
      ),
      confirmLabel: "Cerrar sesiones",
      onConfirm: () => runOnRow(member.id, () => staffApi.revokeSessions(member.id)),
    });
  }

  function askDelete(member: StaffResponse) {
    setConfirmation({
      tone: "danger",
      icon: Trash2,
      eyebrow: "Personal",
      title: "Eliminar colaborador",
      description: (
        <>
          Se eliminará permanentemente a{" "}
          <strong className="font-semibold text-ink">{fullName(member)}</strong>. Esta acción no se
          puede deshacer. Si ya tiene actividad registrada en el sistema, desactívalo en su lugar.
        </>
      ),
      confirmLabel: "Eliminar",
      onConfirm: () => runOnRow(member.id, () => staffApi.remove(member.id)),
    });
  }

  return (
    <div className="flex h-full flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto pb-8">
        {error && (
          <div className="mb-3">
            <Alert variant="error">{error}</Alert>
          </div>
        )}

        {bulkError && (
          <div className="mb-3">
            <Alert variant="error">{bulkError}</Alert>
          </div>
        )}

        {/* Barra de selección: filete arriba y abajo, sin tinte ni recuadro.
            En este sistema la estructura es una línea de 1 px, no una caja. */}
        {selected.length > 0 && (
          <div className="mb-3 flex flex-wrap items-center gap-3 border-y border-line py-2">
            <span className="text-[12.5px] font-medium tabular-nums text-ink">
              {selected.length}{" "}
              {selected.length === 1 ? "colaborador seleccionado" : "colaboradores seleccionados"}
            </span>
            <Button size="sm" variant="secondary" onClick={askBulkRevokeSessions}>
              <LogOut className="h-[15px] w-[15px]" />
              Cerrar sesiones
            </Button>
            {selected.some((member) => member.isActive) && (
              <Button size="sm" variant="secondary" onClick={askBulkDeactivate}>
                <UserX className="h-[15px] w-[15px]" />
                Desactivar
              </Button>
            )}
            <Button size="sm" variant="ghost" onClick={() => setSelectedIds([])}>
              Limpiar selección
            </Button>
          </div>
        )}

        <ListPanel
        action={
          isAdmin && (
            <Button size="sm" onClick={() => setModal("nuevo")}>
              <Plus className="h-[15px] w-[15px]" />
              Agregar personal
            </Button>
          )
        }
          toolbar={
            <>
              <SearchInput
                value={search}
                onChange={setSearch}
                placeholder="Buscar por nombre o correo…"
                className="w-[240px]"
              />

              <Select
                size="sm"
                className="w-[220px]"
                aria-label="Filtrar por departamento"
                value={String(departmentId)}
                onChange={(next) => setDepartmentId(next === "todos" ? "todos" : Number(next))}
                options={[
                  { value: "todos", label: "Todos los departamentos" },
                  ...departmentOptions(departments),
                ]}
              />

              <span aria-hidden className="mx-1 h-5 w-px bg-line" />

              {filters.map(({ key, label, countKey }) => (
                <FilterChip
                  key={key}
                  label={label}
                  count={counts?.[countKey] ?? 0}
                  active={filter === key}
                  onClick={() => setFilter(key)}
                />
              ))}
            </>
          }
          footer={
            data !== null && (
              <Pagination
                page={data.page}
                pageSize={data.pageSize}
                total={data.total}
                totalPages={data.totalPages}
                onPageChange={setPage}
                onPageSizeChange={setPageSize}
                noun="colaboradores"
              />
            )
          }
        >
          {data === null ? (
            error === null && <TableSkeleton rows={pageSize} columns={8} />
          ) : rows.length === 0 ? (
            <EmptyResult
              message={
                unfiltered
                  ? "Todavía no hay personal registrado."
                  : "Ningún colaborador coincide con este filtro o búsqueda."
              }
              onClear={unfiltered ? undefined : clearFilters}
            />
          ) : (
            <div className={`plf-results-in transition-opacity ${isStale ? "opacity-60" : ""}`}>
              <DataTable>
              <thead>
                <HeadRow>
                  {isAdmin && (
                    <Th className="w-9">
                      <input
                        type="checkbox"
                        checked={allPageSelected}
                        disabled={selectableRows.length === 0}
                        onChange={toggleAllOnPage}
                        aria-label={
                          allPageSelected
                            ? "Quitar la selección de esta página"
                            : "Seleccionar todos los colaboradores de esta página"
                        }
                        className="h-4 w-4 rounded-edge border-line-strong accent-brand-red
                          disabled:cursor-not-allowed disabled:opacity-40"
                      />
                    </Th>
                  )}
                  {/* Sin cabecera ordenable: el servidor no ordena por id. */}
                  <Th className="w-20">ID</Th>
                  {columns.map(({ key, label }) => (
                    <Th
                      key={key}
                      sort={{ dir: sort.key === key ? sort.dir : null, onToggle: () => toggleSort(key) }}
                    >
                      {label}
                    </Th>
                  ))}
                  {isAdmin && <Th className="w-36 text-right">Acciones</Th>}
                </HeadRow>
              </thead>

              <tbody>
                {rows.map((member) => (
                  <Row key={member.id} busy={busyId === member.id}>
                    {isAdmin && (
                      <Td>
                        {/* La propia fila no lleva casilla. El hueco se deja
                            vacío en vez de poner una casilla deshabilitada:
                            una casilla apagada invita a preguntarse por qué, y
                            la respuesta —«sos vos»— ya la da la fila. */}
                        {canManage(member) && (
                          <input
                            type="checkbox"
                            checked={selectedIds.includes(member.id)}
                            onChange={() => toggleSelection(member.id)}
                            aria-label={`Seleccionar a ${fullName(member)}`}
                            className="h-4 w-4 rounded-edge border-line-strong accent-brand-red"
                          />
                        )}
                      </Td>
                    )}
                    <Td className="text-[12.5px] tabular-nums text-faint">#{member.id}</Td>
                    <Td>
                      {/* El nombre no enlazaba a nada: la ficha del colaborador y
                          toda su pestana de Accesos existian como ruta pero no
                          habia forma de llegar desde el panel. Mismo patron que
                          el listado de Clientes. */}
                      <Link
                        to={`/staff/${member.id}`}
                        className="flex items-center gap-2.5 rounded-edge underline-offset-4 outline-none
                          focus-visible:ring-3 focus-visible:ring-brand-red/20"
                      >
                        <Avatar name={fullName(member)} seed={member.id} />
                        <span className="whitespace-nowrap text-[13px] font-medium text-ink hover:underline">
                          {fullName(member)}
                        </span>
                      </Link>
                    </Td>
                    <Td className="text-[12.5px] text-brand-gray">
                      {departmentName(member.primaryDepartmentId)}
                    </Td>
                    <Td className="text-[12.5px] text-brand-gray">{member.email}</Td>
                    <Td>
                      {member.isAdmin ? <Badge tone="red">Administrador</Badge> : <Badge>Staff</Badge>}
                    </Td>
                    <Td>
                      <StatusDot active={member.isActive} />
                    </Td>
                    {isAdmin && (
                      <Td>
                        <div className="flex items-center justify-end gap-1">
                          <RowAction
                            label={`Editar a ${fullName(member)}`}
                            icon={Pencil}
                            onClick={() => setModal(member)}
                            disabled={busyId === member.id}
                          />
                          {member.isActive && canManage(member) && (
                            <>
                              <RowAction
                                label={`Cerrar las sesiones de ${fullName(member)}`}
                                icon={LogOut}
                                onClick={() => askRevokeSessions(member)}
                                disabled={busyId === member.id}
                              />
                              <RowAction
                                label={`Desactivar a ${fullName(member)}`}
                                icon={UserX}
                                onClick={() => askDeactivate(member)}
                                disabled={busyId === member.id}
                              />
                            </>
                          )}
                          {!member.isActive && canManage(member) && (
                            <RowAction
                              label={`Reactivar a ${fullName(member)}`}
                              icon={UserCheck}
                              onClick={() => askActivate(member)}
                              disabled={busyId === member.id}
                            />
                          )}
                          {canManage(member) && (
                            <RowAction
                              label={`Eliminar a ${fullName(member)}`}
                              icon={Trash2}
                              onClick={() => askDelete(member)}
                              disabled={busyId === member.id}
                              danger
                            />
                          )}
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
      </div>

      {confirmation && (
        <ConfirmDialog {...confirmation} onClose={() => setConfirmation(null)} />
      )}

      {modal !== null && (
        <StaffModal
          departments={departments}
          staff={modal === "nuevo" ? undefined : modal}
          onClose={() => setModal(null)}
          onSaved={refresh}
        />
      )}
    </div>
  );
}
