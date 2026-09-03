import { useEffect, useMemo, useState } from "react";
import { ModuleHeader } from "../../components/app/ModuleHeader";
import { Alert } from "../../components/ui/Alert";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { ColumnPicker } from "../../components/ui/ColumnPicker";
import { FilterChip } from "../../components/ui/FilterChip";
import { SearchInput } from "../../components/ui/SearchInput";
import { Select } from "../../components/ui/Select";
import { Spinner } from "../../components/ui/Spinner";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";
import { flattenPermissions, permissionsMock } from "../../mocks/permissions";
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
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const debouncedSearch = useDebouncedValue(search).trim().toLowerCase();

  useEffect(() => {
    permissionsMock
      .matrix()
      .then((data) => {
        setMatrix(data);
        setGrants(data.grants);
        setOriginal(data.grants);
        setVisibleRoles(data.roles.map((role) => String(role.id)));
      })
      .catch(() => setError("No se pudo cargar el catálogo de permisos"));
  }, []);

  // El aviso de guardado se retira solo: no es un estado, es un acuse.
  useEffect(() => {
    if (savedAt === null) return;
    const timer = window.setTimeout(() => setSavedAt(null), 4000);
    return () => window.clearTimeout(timer);
  }, [savedAt]);

  const catalog = useMemo(() => (matrix ? flattenPermissions(matrix.groups) : []), [matrix]);
  const editableRoles = useMemo(
    () => (matrix?.roles ?? []).filter((role) => !role.grantsAll),
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

  async function save() {
    setIsSaving(true);
    setError(null);
    try {
      const stored = await permissionsMock.saveGrants(grants);
      setOriginal(stored);
      setGrants(stored);
      setSavedAt(Date.now());
    } catch {
      setError("No se pudieron guardar los permisos");
    } finally {
      setIsSaving(false);
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

  return (
    <div>
      <ModuleHeader
        summary={
          matrix ? (
            <span className="inline-flex flex-wrap items-center gap-2">
              {`${catalog.length} permisos · ${matrix.roles.length} roles · ${
                counts.sinAsignar === 0
                  ? "todos asignados"
                  : `${counts.sinAsignar} sin asignar a ningún rol`
              }`}
              <Badge>Datos de demostración</Badge>
            </span>
          ) : (
            "Cargando el catálogo de permisos…"
          )
        }
        action={
          dirtyCells > 0 && (
            <div className="flex items-center gap-2">
              <Button size="sm" variant="ghost" onClick={discard} disabled={isSaving}>
                Descartar
              </Button>
              <Button size="sm" onClick={save} isLoading={isSaving}>
                Guardar {dirtyCells} {dirtyCells === 1 ? "cambio" : "cambios"}
              </Button>
            </div>
          )
        }
      />

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Buscar permiso…"
          className="w-[240px]"
        />

        <Select
          size="sm"
          className="w-[200px]"
          aria-label="Filtrar por módulo"
          value={module}
          onChange={setModule}
          options={[
            { value: "todos", label: "Todos los módulos" },
            ...(matrix?.groups ?? []).map((group) => ({ value: group.module, label: group.module })),
          ]}
        />

        <span aria-hidden className="mx-1 h-5 w-px bg-line" />

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

        <div className="ml-auto">
          <ColumnPicker
            columns={(matrix?.roles ?? []).map((role) => ({ id: String(role.id), label: role.name }))}
            visible={visibleRoles}
            onChange={setVisibleRoles}
            label="Roles"
          />
        </div>
      </div>

      {error && (
        <div className="mb-3">
          <Alert variant="error">{error}</Alert>
        </div>
      )}

      {savedAt !== null && (
        <div className="mb-3">
          <Alert variant="success">
            Cambios guardados en los datos de demostración. Todavía no hay servidor detrás: al
            recargar la página vuelve el estado inicial.
          </Alert>
        </div>
      )}

      {matrix === null ? (
        <div className="flex justify-center py-16">
          <Spinner />
        </div>
      ) : isEmpty ? (
        <p className="py-14 text-center text-[13.5px] text-faint">
          Ningún permiso coincide con este filtro o búsqueda.
        </p>
      ) : (
        <PermissionMatrix
          groups={groups}
          roles={roles}
          grants={grants}
          original={original}
          onToggle={toggle}
        />
      )}

      <p className="mt-4 max-w-[76ch] text-[12px] leading-relaxed text-faint">
        Un permiso concede la acción, pero solo sobre los recursos de los departamentos donde esa
        persona tiene el rol que lo otorga. La única excepción es{" "}
        <span className="font-mono text-[11px] text-muted">tickets.read_all</span>, pensada para
        supervisión: amplía la lectura a todos los departamentos sin conceder escritura. Dentro de la
        matriz se navega con las flechas del teclado.
      </p>
    </div>
  );
}
