import {
  AlertCircle,
  Building,
  Check,
  CheckCheck,
  FileWarning,
  Layers,
  Lock,
  PackageMinus,
  PackageSearch,
  Pencil,
  RotateCcw,
  Search,
  Settings,
  ShieldCheck,
  Ticket,
  Users,
} from "lucide-react";
import { useMemo, useState } from "react";
import { ApiError } from "../../api/client";
import { rolesApi } from "../../api/roles";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { ConfirmDialog } from "../../components/ui/ConfirmDialog";
import { Drawer } from "../../components/ui/Drawer";
import { SearchInput } from "../../components/ui/SearchInput";
import { Spinner } from "../../components/ui/Spinner";
import { flattenPermissions } from "../../lib/permissionCatalog";
import type { RoleResponse } from "../../types/api";
import type {
  Permission,
  PermissionGroup,
  PermissionKey,
  PermissionMatrixResponse,
} from "../../types/permissions";

interface RolePermissionsDrawerProps {
  role: RoleResponse;
  matrix: PermissionMatrixResponse | null;
  onClose: () => void;
  onSaved: (updatedRole: RoleResponse) => void;
  onEditRole?: (role: RoleResponse) => void;
}

const MODULE_ICONS: Record<string, React.ReactNode> = {
  Personal: <Users className="h-4 w-4 text-blue-600" />,
  Clientes: <Building className="h-4 w-4 text-emerald-600" />,
  Tickets: <Ticket className="h-4 w-4 text-indigo-600" />,
  Calidad: <ShieldCheck className="h-4 w-4 text-amber-600" />,
  Reclamaciones: <FileWarning className="h-4 w-4 text-rose-600" />,
  Discrepancias: <PackageSearch className="h-4 w-4 text-purple-600" />,
  "Retiros de mercancía": <PackageMinus className="h-4 w-4 text-orange-600" />,
  Retiros: <PackageMinus className="h-4 w-4 text-orange-600" />,
  Reportes: <Layers className="h-4 w-4 text-cyan-600" />,
  Configuración: <Settings className="h-4 w-4 text-zinc-600" />,
};

export function RolePermissionsDrawer({
  role,
  matrix,
  onClose,
  onSaved,
  onEditRole,
}: RolePermissionsDrawerProps) {
  const isSystem = role.isSystem;

  // Lista de permisos seleccionados para este rol
  const initialGrants = useMemo<PermissionKey[]>(
    () => (role.permissions ?? []) as PermissionKey[],
    [role.permissions],
  );

  const [grants, setGrants] = useState<PermissionKey[]>(initialGrants);
  const [search, setSearch] = useState("");
  const [selectedModule, setSelectedModule] = useState<string>("todos");
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [confirmDiscard, setConfirmDiscard] = useState(false);

  // Catálogo aplanado para búsquedas y dependencias
  const flatCatalog = useMemo(() => {
    return matrix ? flattenPermissions(matrix.groups) : [];
  }, [matrix]);

  // Mapa de clave a objeto Permission
  const permissionMap = useMemo(() => {
    const map = new Map<PermissionKey, { module: string; permission: Permission }>();
    for (const item of flatCatalog) {
      map.set(item.permission.key, item);
    }
    return map;
  }, [flatCatalog]);

  const totalCatalogCount = flatCatalog.length;
  const grantedCount = isSystem
    ? totalCatalogCount
    : grants.filter((k) => permissionMap.has(k)).length;
  const coveragePercent = totalCatalogCount > 0
    ? Math.round((grantedCount / totalCatalogCount) * 100)
    : 0;

  // Detección de cambios sin guardar
  const dirtyChanges = useMemo(() => {
    if (isSystem) return { added: [], removed: [], total: 0 };
    const initialSet = new Set(initialGrants);
    const currentSet = new Set(grants);

    const added = grants.filter((k) => !initialSet.has(k));
    const removed = initialGrants.filter((k) => !currentSet.has(k));
    return { added, removed, total: added.length + removed.length };
  }, [isSystem, initialGrants, grants]);

  const hasChanges = dirtyChanges.total > 0;

  // Concesión / Revocación con resolución inteligente de dependencias
  function togglePermission(key: PermissionKey) {
    if (isSystem) return;

    setGrants((current) => {
      const granting = !current.includes(key);
      const perm = permissionMap.get(key)?.permission;

      let next = granting ? [...current, key] : current.filter((k) => k !== key);

      // Si concedemos y requiere lectura previa, agregarla automáticamente
      if (granting && perm?.requires && !next.includes(perm.requires)) {
        next.push(perm.requires);
      }

      // Si revocamos y otros permisos dependen de este, retirarlos también
      if (!granting) {
        const dependents = flatCatalog
          .filter((item) => item.permission.requires === key)
          .map((item) => item.permission.key);
        next = next.filter((k) => !dependents.includes(k));
      }

      return next;
    });
  }

  // Conceder todos los permisos de un módulo
  function grantModule(module: PermissionGroup) {
    if (isSystem) return;
    setGrants((current) => {
      const next = new Set(current);
      for (const p of module.permissions) {
        next.add(p.key);
        if (p.requires) next.add(p.requires);
      }
      return Array.from(next);
    });
  }

  // Revocar todos los permisos de un módulo
  function revokeModule(module: PermissionGroup) {
    if (isSystem) return;
    const moduleKeys = new Set(module.permissions.map((p) => p.key));
    // También quitar permisos de otros módulos que dependan de alguno de este módulo
    const dependentKeys = new Set(
      flatCatalog
        .filter((item) => item.permission.requires && moduleKeys.has(item.permission.requires))
        .map((item) => item.permission.key),
    );

    setGrants((current) =>
      current.filter((k) => !moduleKeys.has(k) && !dependentKeys.has(k)),
    );
  }

  // Conceder todos los permisos del catálogo
  function grantAll() {
    if (isSystem) return;
    setGrants(flatCatalog.map((item) => item.permission.key));
  }

  // Limpiar todos los permisos
  function revokeAll() {
    if (isSystem) return;
    setGrants([]);
  }

  // Guardar cambios
  async function handleSave() {
    if (isSystem || !hasChanges) return;
    setIsSaving(true);
    setSaveError(null);

    try {
      await rolesApi.update(role.id, {
        name: role.name,
        permissions: grants,
        isActive: role.isActive,
      });

      const updated: RoleResponse = {
        ...role,
        permissions: grants,
      };

      onSaved(updated);
      onClose();
    } catch (err) {
      setSaveError(
        err instanceof ApiError ? err.message : "No se pudieron guardar los permisos del rol.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  // Filtrado de grupos y permisos según búsqueda y módulo
  const filteredGroups = useMemo(() => {
    if (!matrix) return [];
    const query = search.trim().toLowerCase();

    return matrix.groups
      .filter((group) => selectedModule === "todos" || group.module === selectedModule)
      .map((group) => {
        const matchingPermissions = group.permissions.filter((p) => {
          if (!query) return true;
          return (
            p.label.toLowerCase().includes(query) ||
            p.key.toLowerCase().includes(query) ||
            p.hint.toLowerCase().includes(query)
          );
        });

        return {
          ...group,
          permissions: matchingPermissions,
        };
      })
      .filter((group) => group.permissions.length > 0);
  }, [matrix, selectedModule, search]);

  function handleCloseRequest() {
    if (hasChanges) {
      setConfirmDiscard(true);
    } else {
      onClose();
    }
  }

  return (
    <>
      <Drawer
        title={role.name}
        eyebrow={`Personal · Rol #${role.id}`}
        onClose={handleCloseRequest}
        maxWidth="max-w-2xl"
        footer={
          <div className="flex w-full items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-[12px] text-zinc-500">
              {isSystem ? (
                <span className="flex items-center gap-1.5 text-zinc-500">
                  <Lock className="h-3.5 w-3.5 text-zinc-400" />
                  Rol protegido del sistema (solo lectura)
                </span>
              ) : hasChanges ? (
                <span className="font-medium text-amber-700 bg-amber-50 px-2.5 py-1 rounded-md border border-amber-200/80">
                  {dirtyChanges.total} {dirtyChanges.total === 1 ? "cambio pendiente" : "cambios pendientes"}
                </span>
              ) : (
                <span className="text-zinc-400">Sin cambios pendientes</span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <Button type="button" variant="secondary" size="sm" onClick={handleCloseRequest}>
                {hasChanges ? "Cancelar" : "Cerrar"}
              </Button>
              {!isSystem && (
                <Button
                  type="button"
                  size="sm"
                  onClick={handleSave}
                  isLoading={isSaving}
                  disabled={!hasChanges}
                >
                  Guardar permisos
                </Button>
              )}
            </div>
          </div>
        }
      >
        <div className="flex flex-col gap-5 text-left">
          {/* Banner de error si falló el guardado */}
          {saveError && (
            <div className="flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50 p-3 text-[12.5px] text-red-900">
              <AlertCircle className="h-4 w-4 shrink-0 text-brand-red mt-0.5" />
              <div className="flex-1">
                <p className="font-semibold">No se pudo guardar</p>
                <p className="text-red-700 mt-0.5">{saveError}</p>
              </div>
            </div>
          )}

          {/* Tarjeta de resumen editorial del rol */}
          <div className="rounded-xl border border-zinc-200/80 bg-zinc-50/70 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                {isSystem ? (
                  <Badge tone="neutral" className="gap-1 font-medium">
                    <Lock className="h-3 w-3 text-zinc-500" />
                    Rol del sistema
                  </Badge>
                ) : (
                  <Badge tone="green" className="font-medium">
                    Rol personalizado
                  </Badge>
                )}

                <Badge tone={role.isActive ? "green" : "neutral"}>
                  {role.isActive ? "Activo" : "Inactivo"}
                </Badge>

                {onEditRole && !isSystem && (
                  <button
                    type="button"
                    onClick={() => onEditRole(role)}
                    className="inline-flex items-center gap-1 text-[11.5px] text-zinc-500 hover:text-zinc-900 font-medium transition-colors cursor-pointer ml-1"
                  >
                    <Pencil className="h-3 w-3" />
                    <span>Renombrar</span>
                  </button>
                )}
              </div>

              <div className="text-[12px] tabular-nums font-medium text-zinc-600">
                <span className="font-semibold text-zinc-900">{grantedCount}</span> de{" "}
                <span className="text-zinc-500">{totalCatalogCount}</span> permisos (
                <span className="font-semibold text-zinc-800">{coveragePercent}%</span>)
              </div>
            </div>

            {/* Barra de progreso de cobertura */}
            <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-zinc-200">
              <div
                className="h-full rounded-full bg-brand-red transition-all duration-300 ease-out"
                style={{ width: `${coveragePercent}%` }}
              />
            </div>

            {isSystem && (
              <p className="mt-2.5 text-[11.5px] leading-relaxed text-zinc-500">
                Los roles del sistema son esenciales para la operación y seguridad de Plastifar.
                Sus permisos están protegidos contra edición directa.
              </p>
            )}
          </div>

          {/* Barra de herramientas: Búsqueda y Filtros de Módulo */}
          <div className="flex flex-col gap-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="relative flex-1 min-w-[200px]">
                <SearchInput
                  value={search}
                  onChange={setSearch}
                  placeholder="Buscar permiso por nombre, clave o descripción…"
                  className="w-full text-xs"
                />
              </div>

              {!isSystem && (
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={grantAll}
                    disabled={grantedCount === totalCatalogCount}
                    className="inline-flex h-8 items-center gap-1 rounded-lg border border-zinc-200 bg-white px-2.5 text-[11.5px] font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-40 disabled:pointer-events-none transition-colors cursor-pointer shadow-2xs"
                  >
                    <CheckCheck className="h-3.5 w-3.5 text-emerald-600" />
                    <span>Conceder todos</span>
                  </button>
                  <button
                    type="button"
                    onClick={revokeAll}
                    disabled={grantedCount === 0}
                    className="inline-flex h-8 items-center gap-1 rounded-lg border border-zinc-200 bg-white px-2.5 text-[11.5px] font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-40 disabled:pointer-events-none transition-colors cursor-pointer shadow-2xs"
                  >
                    <RotateCcw className="h-3.5 w-3.5 text-zinc-400" />
                    <span>Limpiar</span>
                  </button>
                </div>
              )}
            </div>

            {/* Selector horizontal de módulos */}
            {matrix && (
              <div className="flex items-center gap-1 overflow-x-auto pb-1 scrollbar-none">
                <button
                  type="button"
                  onClick={() => setSelectedModule("todos")}
                  className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg px-2.5 py-1 text-[11.5px] font-medium transition-colors cursor-pointer ${
                    selectedModule === "todos"
                      ? "bg-zinc-900 text-white font-semibold"
                      : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200/70 hover:text-zinc-900"
                  }`}
                >
                  <span>Todos</span>
                  <span className="opacity-75 text-[10px]">({totalCatalogCount})</span>
                </button>

                {matrix.groups.map((group) => {
                  const isSelected = selectedModule === group.module;
                  const groupGrantedCount = isSystem
                    ? group.permissions.length
                    : group.permissions.filter((p) => grants.includes(p.key)).length;

                  return (
                    <button
                      key={group.module}
                      type="button"
                      onClick={() => setSelectedModule(group.module)}
                      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg px-2.5 py-1 text-[11.5px] font-medium transition-colors cursor-pointer ${
                        isSelected
                          ? "bg-zinc-900 text-white font-semibold"
                          : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200/70 hover:text-zinc-900"
                      }`}
                    >
                      <span className="shrink-0">{MODULE_ICONS[group.module]}</span>
                      <span>{group.module}</span>
                      <span
                        className={`text-[10px] rounded-full px-1.5 py-0.2 ${
                          groupGrantedCount === group.permissions.length && groupGrantedCount > 0
                            ? isSelected
                              ? "bg-emerald-500 text-white font-bold"
                              : "bg-emerald-100 text-emerald-800 font-bold"
                            : isSelected
                            ? "bg-white/20 text-white"
                            : "bg-zinc-200 text-zinc-600"
                        }`}
                      >
                        {groupGrantedCount}/{group.permissions.length}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Contenido: Módulos y Permisos agrupados */}
          {matrix === null ? (
            <div className="flex flex-col items-center justify-center py-16 text-zinc-400">
              <Spinner />
              <p className="mt-3 text-[12.5px]">Cargando catálogo de permisos…</p>
            </div>
          ) : filteredGroups.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-zinc-200 py-14 text-center">
              <Search className="h-6 w-6 text-zinc-300" />
              <p className="mt-2 text-[13px] font-medium text-zinc-700">
                No se encontraron permisos
              </p>
              <p className="text-[12px] text-zinc-400 mt-0.5">
                Prueba con otro término de búsqueda o cambia el filtro de módulo.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {filteredGroups.map((group) => {
                const groupGrantedCount = isSystem
                  ? group.permissions.length
                  : group.permissions.filter((p) => grants.includes(p.key)).length;
                const isAllGranted =
                  group.permissions.length > 0 && groupGrantedCount === group.permissions.length;

                return (
                  <div
                    key={group.module}
                    className="overflow-hidden rounded-xl border border-zinc-200/80 bg-white shadow-2xs"
                  >
                    {/* Cabecera del Módulo */}
                    <div className="flex items-center justify-between border-b border-zinc-100 bg-zinc-50/80 px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <div className="flex h-6 w-6 items-center justify-center rounded-md bg-white border border-zinc-200/80 shadow-2xs">
                          {MODULE_ICONS[group.module] ?? (
                            <Layers className="h-3.5 w-3.5 text-zinc-500" />
                          )}
                        </div>
                        <h3 className="font-heading text-[13px] font-bold text-zinc-900 tracking-tight">
                          {group.module}
                        </h3>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10.5px] font-semibold tabular-nums ${
                            isAllGranted
                              ? "bg-emerald-100 text-emerald-800"
                              : groupGrantedCount > 0
                              ? "bg-zinc-200/70 text-zinc-700"
                              : "bg-zinc-100 text-zinc-400"
                          }`}
                        >
                          {groupGrantedCount} de {group.permissions.length} concedidos
                        </span>
                      </div>

                      {!isSystem && (
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => (isAllGranted ? revokeModule(group) : grantModule(group))}
                            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold text-zinc-600 hover:text-zinc-900 hover:bg-zinc-200/50 transition-colors cursor-pointer"
                          >
                            {isAllGranted ? (
                              <span>Revocar módulo</span>
                            ) : (
                              <span>Conceder módulo</span>
                            )}
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Lista de Permisos del Módulo */}
                    <div className="divide-y divide-zinc-100">
                      {group.permissions.map((p) => {
                        const isGranted = isSystem || grants.includes(p.key);
                        const requiredLabel = p.requires
                          ? permissionMap.get(p.requires)?.permission.label ?? p.requires
                          : null;

                        return (
                          <div
                            key={p.key}
                            onClick={() => togglePermission(p.key)}
                            className={`group flex items-start gap-3 px-4 py-3 transition-colors ${
                              isSystem
                                ? "cursor-default"
                                : "cursor-pointer hover:bg-zinc-50/80"
                            } ${isGranted ? "bg-zinc-50/30" : ""}`}
                          >
                            {/* Control interactivo (Checkbox / Check indicator) */}
                            <div className="pt-0.5">
                              {isSystem ? (
                                <div className="flex h-5 w-5 items-center justify-center rounded-md border border-zinc-200 bg-zinc-100 text-zinc-500">
                                  <Lock className="h-3 w-3" />
                                </div>
                              ) : (
                                <div
                                  className={`flex h-5 w-5 items-center justify-center rounded-md border transition-all duration-150 ${
                                    isGranted
                                      ? "border-brand-red bg-brand-red text-white shadow-2xs"
                                      : "border-zinc-300 bg-white group-hover:border-zinc-400"
                                  }`}
                                >
                                  {isGranted && <Check className="h-3.5 w-3.5 stroke-[3]" />}
                                </div>
                              )}
                            </div>

                            {/* Contenido descriptivo del permiso */}
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <span
                                  className={`font-heading text-[13px] font-semibold tracking-tight ${
                                    isGranted ? "text-zinc-900" : "text-zinc-600"
                                  }`}
                                >
                                  {p.label}
                                </span>

                                <code className="rounded border border-zinc-200 bg-zinc-100 px-1.5 py-0.2 font-mono text-[10.5px] text-zinc-500">
                                  {p.key}
                                </code>

                                {p.reserved && (
                                  <span className="rounded-full bg-amber-100 px-1.5 py-0.2 text-[9.5px] font-bold text-amber-800">
                                    Función reservada
                                  </span>
                                )}
                              </div>

                              <p className="mt-1 text-[12px] leading-relaxed text-zinc-500">
                                {p.hint}
                              </p>

                              {requiredLabel && (
                                <p className="mt-1 flex items-center gap-1 text-[11px] text-zinc-400">
                                  <span>Requiere:</span>
                                  <span className="font-medium text-zinc-600 underline decoration-zinc-300">
                                    {requiredLabel}
                                  </span>
                                </p>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </Drawer>

      {/* Diálogo de confirmación para descartar cambios */}
      {confirmDiscard && (
        <ConfirmDialog
          tone="warn"
          title="Descartar cambios"
          description={
            <>
              Tienes <strong className="font-semibold text-ink">{dirtyChanges.total}</strong>{" "}
              {dirtyChanges.total === 1 ? "cambio sin guardar" : "cambios sin guardar"} en los permisos de{" "}
              <strong className="font-semibold text-ink">{role.name}</strong>. ¿Deseas descartarlos y salir?
            </>
          }
          confirmLabel="Descartar y salir"
          cancelLabel="Continuar editando"
          onClose={() => setConfirmDiscard(false)}
          onConfirm={() => {
            setConfirmDiscard(false);
            onClose();
          }}
        />
      )}
    </>
  );
}
