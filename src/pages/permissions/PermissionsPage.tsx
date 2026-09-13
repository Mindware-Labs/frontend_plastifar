import { Check, Lock } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { permissionsApi } from "../../api/permissions";
import { ApiError } from "../../api/client";
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

  /**
   * Un solo recorrido para las dos lecturas del mismo hecho: qué permisos
   * cambiaron (`keys`, para el filtro «Con cambios») y cuántas celdas lo
   * hicieron (`cells`, para el contador del botón). Antes eran dos memos con
   * el bucle repetido palabra por palabra.
   */
  const { dirtyKeys, dirtyCells } = useMemo(() => {
    const keys = new Set<PermissionKey>();
    let cells = 0;
    for (const role of editableRoles) {
      const before = new Set(original[role.id] ?? []);
      const after = new Set(grants[role.id] ?? []);
      for (const key of new Set([...before, ...after])) {
        if (before.has(key) !== after.has(key)) {
          keys.add(key);
          cells += 1;
        }
      }
    }
    return { dirtyKeys: keys, dirtyCells: cells };
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
   * La matriz se guarda entera en una sola peticion: POST /api/permissions/matrix
   * aplica todos los roles cambiados dentro de la misma transaccion. Antes se
   * mandaba un PUT por rol y un fallo a mitad dejaba media politica aplicada,
   * que es justo lo que una matriz de permisos no puede permitirse.
   *
   * Al ser todo o nada ya no hay fallo parcial que enumerar: si la peticion
   * falla no se guardo nada y basta un unico aviso con el motivo del servidor.
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

      if (changedRoles.length === 0) return;

      await permissionsApi.save({
        roles: changedRoles.map((role) => ({
          roleId: role.id,
          permissions: grants[role.id] ?? [],
        })),
      });

      // La relectura ya no forma parte del guardado: si falla, los permisos
      // estan guardados igual y decir «no se pudieron guardar» seria mentir.
      try {
        await refreshAfterSave();
      } catch {
        setError("Se guardaron los permisos, pero no se pudo releer la matriz. Recarga la página.");
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

  /** Roles que la matriz puede comparar de verdad: los que se pueden editar. */
  const comparableRoles = editableRoles.length;

  const isEmpty = matrix !== null && groups.length === 0;
  /** Catalogo vacio y filtro vacio no son el mismo vacio y no se dicen igual. */
  const catalogIsEmpty = catalog.length === 0;
  const unfiltered = chip === "todos" && module === "todos" && debouncedSearch === "";

  return (
    <div>
      {/* La matriz es la unica pantalla del panel que vivia a la intemperie: la
          cabecera blanca, las bandas de modulo grises y las filas blancas se
          apilaban sin nada que las contuviera, asi que se leian como tres capas
          sueltas en vez de como una tabla. Aca va la misma superficie que usa
          cada listado —borde, radio y sombra— construida a mano y no con
          `ListPanel`, porque la rejilla trae su propio desbordamiento en dos ejes
          con cabecera y columna congeladas, y meterla dentro de otro contenedor
          con scroll despega justamente eso. */}
      <section className="overflow-hidden rounded-card border border-line bg-white shadow-card">
      <div className="flex flex-wrap items-end gap-2 border-b border-line px-4 py-3">
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

      <div className="px-4 pt-3">

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
          {/* Con una sola columna esto no es una tabulacion cruzada, y la
              pantalla se lee como si estuviera rota: media hoja en blanco al
              lado de una columna sola. Decirlo es mas honesto que dejar que
              la persona lo interprete —y es donde de verdad esta la salida. */}
          {comparableRoles < 2 && (
            <p className="mb-3 border-l-2 border-line-strong bg-canvas px-3.5 py-2.5 text-[12.5px] leading-relaxed text-subtle">
              {comparableRoles === 0
                ? "No hay ningún rol editable todavía. La matriz compara lo que concede cada rol, así que necesita al menos uno."
                : "Solo hay un rol editable. La matriz sirve para comparar lo que concede cada uno, y con una sola columna no hay nada contra qué comparar."}{" "}
              <Link to="/roles" className="font-medium text-brand-red-dark underline">
                Crear otro rol
              </Link>
              .
            </p>
          )}

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
      </div>

      {/* Leyenda: hasta ahora el punto ambar, el candado y el anillo de cambio
          no se explicaban en ninguna parte visible de la pantalla. Un simbolo
          que hay que adivinar no informa, decora. */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-line px-4 py-2.5">
        <span className="flex items-center gap-1.5 text-[11.5px] text-faint">
          <span aria-hidden className="inline-flex h-4 w-4 items-center justify-center rounded-edge bg-brand-red/10 text-brand-red">
            <Check className="h-3 w-3" strokeWidth={3} />
          </span>
          Concede
        </span>
        <span className="flex items-center gap-1.5 text-[11.5px] text-faint">
          <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-warn" />
          Ningún rol lo concede
        </span>
        <span className="flex items-center gap-1.5 text-[11.5px] text-faint">
          <span aria-hidden className="inline-flex h-4 w-4 items-center justify-center rounded-edge ring-2 ring-inset ring-warn/45" />
          Sin guardar
        </span>
        <span className="flex items-center gap-1.5 text-[11.5px] text-faint">
          <Lock aria-hidden className="h-3 w-3" />
          Rol del sistema
        </span>

        {/* El guardado vivia arriba del todo y apagado: ocupaba el mejor sitio de
            la pantalla para no decir nada durante el 95 % del tiempo. Aparece
            cuando hay algo que guardar, al pie de lo que se estuvo tocando. */}
        {canWrite && dirtyCells > 0 && (
          <span className="ml-auto flex items-center gap-2">
            <span className="text-[12px] font-medium tabular-nums text-ink">
              {dirtyCells} sin guardar
            </span>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setConfirmingDiscard(true)}
              disabled={isSaving}
            >
              Descartar
            </Button>
            <Button size="sm" onClick={save} isLoading={isSaving}>
              Guardar
            </Button>
          </span>
        )}
      </div>
      </section>

      <p className="mt-3 max-w-[76ch] text-[12px] leading-relaxed text-faint">
        Un permiso concede la acción, pero solo sobre los recursos de los departamentos donde esa
        persona tiene el rol que lo otorga. La única excepción es{" "}
        <span className="font-mono text-[11px] text-subtle">tickets.read_all</span>, pensada para
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
