import { useCallback, useEffect, useMemo, useState } from "react";
import { permissionsApi } from "../../api/permissions";
import { ApiError } from "../../api/client";
import { rolesApi } from "../../api/roles";
import { ModuleHeader } from "../../components/app/ModuleHeader";
import { Alert } from "../../components/ui/Alert";
import { Button } from "../../components/ui/Button";
import { ColumnPicker } from "../../components/ui/ColumnPicker";
import { ConfirmDialog } from "../../components/ui/ConfirmDialog";
import { CriteriaField, CriteriaSelect } from "../../components/ui/CriteriaField";
import { FilterChip } from "../../components/ui/FilterChip";
import { SearchInput } from "../../components/ui/SearchInput";
import { Spinner } from "../../components/ui/Spinner";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";
import { usePermissions } from "../../hooks/usePermissions";
import { flattenPermissions } from "../../lib/permissionCatalog";
import type { PermissionKey, PermissionMatrixResponse } from "../../types/permissions";
import { PermissionMatrix } from "./PermissionMatrix";

type ChipKey = "todos" | "sinAsignar" | "conCambios";

/** Concesiones de un rol, siempre como lista nueva: nunca se muta el estado. */
function withPermission(current: PermissionKey[], key: PermissionKey) {
  return current.includes(key) ? current : [...current, key];
}

function withoutPermission(current: PermissionKey[], key: PermissionKey) {
  return current.filter((value) => value !== key);
}

export function PermissionsPage() {
  const [matrix, setMatrix] = useState<PermissionMatrixResponse | null>(null);
  const [grants, setGrants] = useState<Record<number, PermissionKey[]>>({});
  const [original, setOriginal] = useState<Record<number, PermissionKey[]>>({});
  const [visibleRoles, setVisibleRoles] = useState<string[]>([]);

  const [search, setSearch] = useState("");
  const [module, setModule] = useState("todos");
  const [chip, setChip] = useState<ChipKey>("todos");

  const [isSaving, setIsSaving] = useState(false);
  /** Relectura de la matriz sobre una pagina ya pintada: se atenua, no se vacia. */
  const [isRefetching, setIsRefetching] = useState(true);
  // Contador, no marca de tiempo: el instante nunca se lee, solo hace falta
  // saber que hubo un guardado y reiniciar el temporizador si hay otro encima.
  const [saveAck, setSaveAck] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [confirmingDiscard, setConfirmingDiscard] = useState(false);

  const debouncedSearch = useDebouncedValue(search).trim().toLowerCase();

  // Sin roles.write la matriz sigue siendo util para consultar la politica: se
  // muestra entera, pero las celdas no se tocan y no hay nada que guardar.
  const { can } = usePermissions();
  const canWrite = can("roles.write");

  /**
   * Carga inicial y reintento comparten camino. Si falla no queda nada pintado,
   * asi que el aviso tiene que traer la salida: sin reintento la unica forma de
   * recuperarse era recargar la pagina entera.
   */
  // No fija estado de forma sincrona: al montar eso era un render extra antes
  // de la primera pintura. `isRefetching` arranca en true y lo apaga el
  // `finally`; quien reintenta lo vuelve a encender desde su propio manejador.
  const load = useCallback(() => {
    permissionsApi
      .matrix()
      .then((data) => {
        setMatrix(data);
        setGrants(data.grants);
        setOriginal(data.grants);
        setVisibleRoles(data.roles.map((role) => String(role.id)));
      })
      .catch(() => setError("No se pudo cargar el catálogo de permisos. Vuelve a intentarlo."))
      .finally(() => setIsRefetching(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // El aviso de guardado se retira solo: no es un estado, es un acuse.
  useEffect(() => {
    if (saveAck === 0) return;
    const timer = window.setTimeout(() => setSaveAck(0), 4000);
    return () => window.clearTimeout(timer);
  }, [saveAck]);

  const catalog = useMemo(() => (matrix ? flattenPermissions(matrix.groups) : []), [matrix]);
  const editableRoles = useMemo(
    // Editable = no es del sistema. `grantsAll` solo dice que su lista cubre el
    // catalogo entero, que es un hecho distinto y no impide editarla.
    () => (matrix?.roles ?? []).filter((role) => !role.isSystem),
    [matrix],
  );

  /** Permisos que hoy no concede ningún rol editable. */
  const unassigned = useMemo(() => {
    const assigned = new Set(editableRoles.flatMap((role) => grants[role.id] ?? []));
    return new Set(catalog.map(({ permission }) => permission.key).filter((key) => !assigned.has(key)));
  }, [catalog, editableRoles, grants]);

  /** Permisos con al menos una celda distinta de como llegó del servidor. */
  const dirtyKeys = useMemo(() => {
    const keys = new Set<PermissionKey>();
    for (const role of editableRoles) {
      const before = new Set(original[role.id] ?? []);
      const after = new Set(grants[role.id] ?? []);
      for (const key of new Set([...before, ...after])) {
        if (before.has(key) !== after.has(key)) keys.add(key);
      }
    }
    return keys;
  }, [editableRoles, grants, original]);

  const dirtyCells = useMemo(() => {
    let total = 0;
    for (const role of editableRoles) {
      const before = new Set(original[role.id] ?? []);
      const after = new Set(grants[role.id] ?? []);
      for (const key of new Set([...before, ...after])) {
        if (before.has(key) !== after.has(key)) total += 1;
      }
    }
    return total;
  }, [editableRoles, grants, original]);

  const counts = {
    todos: catalog.length,
    sinAsignar: unassigned.size,
    conCambios: dirtyKeys.size,
  };

  /**
   * Conceder escritura arrastra su lectura, y quitar la lectura se lleva todo lo
   * que depende de ella: un rol que puede crear clientes y no puede verlos no es
   * una política, es un descuido que el servidor rechazaría después.
   */
  function toggle(roleId: number, key: PermissionKey) {
    if (!matrix) return;

    setGrants((previous) => {
      const current = previous[roleId] ?? [];
      const permission = catalog.find((entry) => entry.permission.key === key)?.permission;
      const granting = !current.includes(key);

      let next = granting ? withPermission(current, key) : withoutPermission(current, key);

      if (granting && permission?.requires) {
        next = withPermission(next, permission.requires);
      }

      if (!granting) {
        const dependents = catalog
          .filter((entry) => entry.permission.requires === key)
          .map((entry) => entry.permission.key);
        next = next.filter((value) => !dependents.includes(value));
      }

      return { ...previous, [roleId]: next };
    });
  }

  /**
   * No existe un endpoint de matriz completa: cada rol se guarda con su propio
   * PUT /api/roles/{id} (seccion 12.3 — se sigue el criterio del modulo de
   * Personal, que ya expone ese endpoint). Solo se manda lo que cambio.
   *
   * Cada rol se resuelve por separado: si el tercero guarda y el cuarto falla,
   * el tercero deja de estar sucio igualmente. Con un `Promise.all` un fallo
   * parcial dejaba el anillo ambar sobre celdas ya guardadas y el siguiente
   * intento las volvia a mandar.
   */
  async function save() {
    setIsSaving(true);
    setError(null);
    try {
      const changedRoles = editableRoles.filter((role) => {
        const before = new Set(original[role.id] ?? []);
        const after = new Set(grants[role.id] ?? []);
        return before.size !== after.size || [...before].some((key) => !after.has(key));
      });

      const results = await Promise.allSettled(
        changedRoles.map((role) =>
          rolesApi.update(role.id, {
            name: role.name,
            isActive: role.isActive,
            permissions: grants[role.id] ?? [],
          }),
        ),
      );

      const failed = changedRoles.filter((_, index) => results[index].status === "rejected");

      if (failed.length === changedRoles.length && failed.length > 0) {
        const reason = results[0];
        setError(
          reason.status === "rejected" && reason.reason instanceof ApiError
            ? `${reason.reason.message} Vuelve a intentarlo.`
            : "No se pudieron guardar los permisos. Vuelve a intentarlo.",
        );
        return;
      }

      // Lo guardado deja de estar sucio aunque otro rol haya fallado.
      await refreshAfterSave();

      if (failed.length > 0) {
        setError(
          `Se guardaron ${changedRoles.length - failed.length} de ${changedRoles.length} roles. ` +
            `Quedó sin guardar: ${failed.map((role) => role.name).join(", ")}. Vuelve a intentarlo.`,
        );
        return;
      }

      // Con el filtro «Con cambios» puesto, guardar vacia el listado: ya no hay
      // ningun permiso cambiado que mostrar. Se vuelve a «Todos» para que el
      // acuse de guardado no llegue junto a una pagina en blanco.
      if (chip === "conCambios") setChip("todos");
      setSaveAck((previous) => previous + 1);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? `${err.message} Vuelve a intentarlo.`
          : "No se pudieron guardar los permisos. Vuelve a intentarlo.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  /**
   * Relee la matriz y reconcilia lo que depende de la lista de roles: un rol
   * creado o borrado en el servidor dejaba la columna fuera de la vista o un id
   * fantasma en el selector de columnas.
   */
  async function refreshAfterSave() {
    setIsRefetching(true);
    try {
      const fresh = await permissionsApi.matrix();
      const freshIds = fresh.roles.map((role) => String(role.id));
      setMatrix(fresh);
      setGrants(fresh.grants);
      setOriginal(fresh.grants);
      setVisibleRoles((previous) => {
        const kept = freshIds.filter((id) => previous.includes(id));
        const added = freshIds.filter((id) => !previous.includes(id));
        // Un rol nuevo entra visible; uno que ya no existe se cae.
        return kept.length + added.length === 0 ? freshIds : [...kept, ...added];
      });
    } finally {
      setIsRefetching(false);
    }
  }

  function discard() {
    setGrants(original);
  }

  const groups = useMemo(() => {
    if (!matrix) return [];

    return matrix.groups
      .filter((group) => module === "todos" || group.module === module)
      .map((group) => ({
        ...group,
        permissions: group.permissions.filter((permission) => {
          const matchesSearch =
            debouncedSearch === "" ||
            permission.label.toLowerCase().includes(debouncedSearch) ||
            permission.key.toLowerCase().includes(debouncedSearch);

          const matchesChip =
            chip === "todos" ||
            (chip === "sinAsignar" && unassigned.has(permission.key)) ||
            (chip === "conCambios" && dirtyKeys.has(permission.key));

          return matchesSearch && matchesChip;
        }),
      }))
      .filter((group) => group.permissions.length > 0);
  }, [matrix, module, debouncedSearch, chip, unassigned, dirtyKeys]);

  const roles = useMemo(
    () => (matrix?.roles ?? []).filter((role) => visibleRoles.includes(String(role.id))),
    [matrix, visibleRoles],
  );

  const isEmpty = matrix !== null && groups.length === 0;
  /** Catalogo vacio y filtro vacio no son el mismo vacio y no se dicen igual. */
  const catalogIsEmpty = catalog.length === 0;
  const unfiltered = chip === "todos" && module === "todos" && debouncedSearch === "";

  return (
    <div>
      <ModuleHeader
        action={
          // La accion primaria se pinta siempre que se pueda escribir, apagada
          // mientras no haya nada que guardar: desmontarla dejaba la cabecera
          // vacia y sin decir que guardar es el proposito de la pagina.
          canWrite && (
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setConfirmingDiscard(true)}
                disabled={isSaving || dirtyCells === 0}
              >
                Descartar
              </Button>
              <Button size="sm" onClick={save} isLoading={isSaving} disabled={dirtyCells === 0}>
                {dirtyCells === 0
                  ? "Guardar cambios"
                  : `Guardar ${dirtyCells} ${dirtyCells === 1 ? "cambio" : "cambios"}`}
              </Button>
            </div>
          )
        }
      />

      <div className="mb-3 flex flex-wrap items-end gap-2">
        <CriteriaField label="Buscar">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Buscar permiso…"
            className="w-[240px]"
          />
        </CriteriaField>

        <CriteriaSelect
          label="Módulo"
          ariaLabel="Filtrar por módulo"
          value={module}
          onChange={setModule}
          width="w-[200px]"
          options={[
            { value: "todos", label: "Todos los módulos" },
            ...(matrix?.groups ?? []).map((group) => ({ value: group.module, label: group.module })),
          ]}
        />

        <span aria-hidden className="mx-1 mb-1.5 h-5 w-px bg-line" />

        <div className="flex flex-wrap items-center gap-2 pb-0.5">
          <FilterChip
            label="Todos"
            count={counts.todos}
            active={chip === "todos"}
            onClick={() => setChip("todos")}
          />
          <FilterChip
            label="Sin asignar"
            count={counts.sinAsignar}
            active={chip === "sinAsignar"}
            onClick={() => setChip("sinAsignar")}
          />
          <FilterChip
            label="Con cambios"
            count={counts.conCambios}
            active={chip === "conCambios"}
            onClick={() => setChip("conCambios")}
          />
        </div>

        <div className="ml-auto pb-0.5">
          <ColumnPicker
            columns={(matrix?.roles ?? []).map((role) => ({ id: String(role.id), label: role.name }))}
            visible={visibleRoles}
            // Una columna de permisos sin ningun rol enfrente no cruza nada: se
            // conserva siempre al menos un rol a la vista.
            onChange={(next) => {
              if (next.length === 0) return;
              setVisibleRoles(next);
            }}
            label="Mostrar roles"
          />
        </div>
      </div>

      {error && (
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <div className="min-w-[240px] flex-1">
            <Alert variant="error">{error}</Alert>
          </div>
          <Button
            size="sm"
            variant="secondary"
            disabled={isRefetching}
            onClick={() => {
              setError(null);
              setIsRefetching(true);
              load();
            }}
          >
            Reintentar
          </Button>
        </div>
      )}

      {saveAck > 0 && (
        <div className="mb-3">
          <Alert variant="success">Cambios guardados.</Alert>
        </div>
      )}

      {matrix !== null && !canWrite && (
        <div className="mb-3">
          <Alert variant="info">
            Estás viendo la política en modo consulta. Para cambiar los permisos de un rol necesitas
            el permiso <span className="font-mono text-[11px]">roles.write</span>.
          </Alert>
        </div>
      )}

      {matrix === null ? (
        // Con un error de carga no queda nada que esperar: el aviso de arriba ya
        // trae el reintento, y una rueda eterna bajo el aviso mentia.
        error === null && (
          <div className="flex justify-center py-16">
            <Spinner />
          </div>
        )
      ) : isEmpty ? (
        <p className="py-14 text-center text-[13.5px] text-faint">
          {catalogIsEmpty || unfiltered
            ? "Todavía no hay permisos en el catálogo."
            : "Ningún permiso coincide con este filtro o búsqueda."}
        </p>
      ) : (
        <div className={`transition-opacity ${isRefetching ? "opacity-60" : ""}`}>
          <PermissionMatrix
            groups={groups}
            roles={roles}
            grants={grants}
            original={original}
            onToggle={toggle}
            readOnly={!canWrite}
          />
        </div>
      )}

      <p className="mt-4 max-w-[76ch] text-[12px] leading-relaxed text-faint">
        Un permiso concede la acción, pero solo sobre los recursos de los departamentos donde esa
        persona tiene el rol que lo otorga. La única excepción es{" "}
        <span className="font-mono text-[11px] text-muted">tickets.read_all</span>, pensada para
        supervisión: amplía la lectura a todos los departamentos sin conceder escritura. Dentro de la
        matriz se navega con las flechas del teclado.
      </p>

      {confirmingDiscard && (
        <ConfirmDialog
          tone="warn"
          title="Descartar los cambios sin guardar"
          description={
            <>
              Se perderán {dirtyCells} {dirtyCells === 1 ? "cambio" : "cambios"} de la matriz y las
              celdas vuelven a como llegaron del servidor.
            </>
          }
          confirmLabel="Descartar cambios"
          cancelLabel="Seguir editando"
          onConfirm={discard}
          onClose={() => setConfirmingDiscard(false)}
        />
      )}
    </div>
  );
}
