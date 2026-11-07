import {
  Ban,
  CheckCircle2,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  UserCheck,
  UserMinus,
  XCircle,
} from "lucide-react";
import { useMemo, useState } from "react";
import { staffApi } from "../../api/staff";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { DataTable, HeadRow, Row, Td, Th } from "../../components/ui/DataTable";
import { DetailCard } from "../../components/ui/DetailCard";
import { EmptyResult } from "../../components/ui/EmptyResult";
import { SearchInput } from "../../components/ui/SearchInput";
import { SegmentedFilter } from "../../components/ui/SegmentedFilter";
import { Select } from "../../components/ui/Select";
import { Spinner } from "../../components/ui/Spinner";
import { useReceipts } from "../../context/useReceipts";
import {
  DEFAULT_PERMISSION_GROUPS,
  flattenPermissions,
} from "../../lib/permissionCatalog";
import type { PermissionGroup, StaffDetail } from "../../types/permissions";

interface StaffEffectivePermissionsCardProps {
  staff: StaffDetail;
  catalogGroups?: PermissionGroup[];
  onReload?: () => Promise<unknown> | void;
}

type FilterState = "todos" | "permitidos" | "noPermitidos";

interface UnifiedPermissionItem {
  key: string;
  label: string;
  hint: string;
  module: string;
  requires?: string;
  reserved: boolean;
  isAllowed: boolean;
  isCustomGranted: boolean;
  isCustomRevoked: boolean;
  scope: "todos" | "departamentos" | null;
  departments: string[];
  denialReason: string | null;
}

export function StaffEffectivePermissionsCard({
  staff,
  catalogGroups = DEFAULT_PERMISSION_GROUPS,
  onReload,
}: StaffEffectivePermissionsCardProps) {
  const receipts = useReceipts();
  const [filter, setFilter] = useState<FilterState>("todos");
  const [search, setSearch] = useState("");
  const [selectedModule, setSelectedModule] = useState<string>("todos");
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const grantedSet = useMemo(
    () => new Set(staff.grantedPermissions ?? []),
    [staff.grantedPermissions],
  );
  const revokedSet = useMemo(
    () => new Set(staff.revokedPermissions ?? []),
    [staff.revokedPermissions],
  );

  // Unificamos el catálogo con los permisos efectivos de la ficha del colaborador.
  const { items, modules, allowedCount, deniedCount, totalCount } = useMemo(() => {
    const flattened = flattenPermissions(
      catalogGroups.length > 0 ? catalogGroups : DEFAULT_PERMISSION_GROUPS,
    );

    const effectiveMap = new Map<string, { scope: "todos" | "departamentos"; departments: string[] }>();
    for (const ep of staff.effectivePermissions) {
      effectiveMap.set(ep.permission.key, {
        scope: ep.scope,
        departments: ep.departments,
      });
    }

    const uniqueModules = Array.from(new Set(flattened.map((f) => f.module))).sort((a, b) =>
      a.localeCompare(b, "es"),
    );

    let allowed = 0;
    let denied = 0;

    const unified: UnifiedPermissionItem[] = flattened.map(({ module, permission }) => {
      const match = effectiveMap.get(permission.key);
      const isCustomGranted = grantedSet.has(permission.key);
      const isCustomRevoked = revokedSet.has(permission.key);

      // Si fue revocado individualmente, queda denegado; si fue concedido o matched, queda permitido
      const isAllowed = !isCustomRevoked && (isCustomGranted || match !== undefined);

      if (isAllowed) {
        allowed++;
      } else {
        denied++;
      }

      let denialReason: string | null = null;
      if (!isAllowed) {
        if (isCustomRevoked) {
          denialReason = "Revocado individualmente para este usuario";
        } else if (!staff.isActive) {
          denialReason = "Colaborador desactivado";
        } else if (staff.accesses.length === 0) {
          denialReason = "Sin departamentos ni roles asignados";
        } else if (permission.reserved) {
          denialReason = "Función del sistema reservada";
        } else {
          denialReason = "Ningún rol asignado otorga este permiso";
        }
      }

      return {
        key: permission.key,
        label: permission.label,
        hint: permission.hint,
        module,
        requires: permission.requires,
        reserved: permission.reserved,
        isAllowed,
        isCustomGranted,
        isCustomRevoked,
        scope: isCustomGranted ? "todos" : match?.scope ?? null,
        departments: isCustomGranted ? [] : match?.departments ?? [],
        denialReason,
      };
    });

    return {
      items: unified,
      modules: uniqueModules,
      allowedCount: allowed,
      deniedCount: denied,
      totalCount: unified.length,
    };
  }, [catalogGroups, staff, grantedSet, revokedSet]);

  // Filtrado por estado, búsqueda y módulo.
  const filteredItems = useMemo(() => {
    const term = search.trim().toLowerCase();

    return items.filter((item) => {
      // Filtro de estado
      if (filter === "permitidos" && !item.isAllowed) return false;
      if (filter === "noPermitidos" && item.isAllowed) return false;

      // Filtro de módulo
      if (selectedModule !== "todos" && item.module !== selectedModule) return false;

      // Filtro de texto
      if (term) {
        const matchesLabel = item.label.toLowerCase().includes(term);
        const matchesKey = item.key.toLowerCase().includes(term);
        const matchesModule = item.module.toLowerCase().includes(term);
        const matchesHint = item.hint.toLowerCase().includes(term);
        const matchesDept = item.departments.some((d) => d.toLowerCase().includes(term));
        if (!matchesLabel && !matchesKey && !matchesModule && !matchesHint && !matchesDept) {
          return false;
        }
      }

      return true;
    });
  }, [items, filter, selectedModule, search]);

  async function handleOverride(permissionKey: string, action: "grant" | "revoke" | "reset") {
    setActionError(null);
    setBusyKey(permissionKey);
    try {
      await staffApi.overridePermission(staff.id, permissionKey, action);
      if (onReload) {
        await onReload();
      }
      const titles = { grant: "Permiso otorgado", revoke: "Permiso restringido", reset: "Permiso restablecido" };
      receipts.done({ action: "permiso-colaborador", title: titles[action], detail: permissionKey });
    } catch {
      setActionError("No se pudo actualizar la personalización del permiso. Intenta de nuevo.");
      receipts.failed({ action: "permiso-colaborador", title: "No se pudo actualizar el permiso", detail: permissionKey });
    } finally {
      setBusyKey(null);
    }
  }

  return (
    <DetailCard
      icon={ShieldCheck}
      title={`Permisos efectivos y restricciones (${allowedCount} permitidos · ${deniedCount} no permitidos)`}
      aside={
        <span className="text-[11.5px] text-zinc-500 font-medium">
          {staff.isAdmin
            ? "Acceso total de administrador"
            : `${allowedCount} de ${totalCount} permisos habilitados`}
        </span>
      }
    >
      {/* Explicación de la matriz de permisos */}
      <div className="border-b border-zinc-100 bg-zinc-50/70 px-4 py-2.5 text-[12px] text-zinc-500">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <span>
            Auditoría y control de permisos de este colaborador. Puedes personalizar excepciones
            individuales (conceder o quitar) directamente para su cuenta.
          </span>
          {staff.isAdmin && (
            <span className="inline-flex items-center gap-1 font-semibold text-emerald-700 shrink-0">
              <CheckCircle2 className="size-3.5" />
              <span>Privilegios totales de administrador</span>
            </span>
          )}
        </div>
        {actionError && (
          <p className="mt-1.5 text-[11.5px] font-medium text-rose-600">{actionError}</p>
        )}
      </div>

      {/* Barra de herramientas y filtros */}
      <div className="flex flex-col gap-2.5 border-b border-zinc-100 bg-white p-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <SegmentedFilter<FilterState>
            items={[
              { key: "todos", label: "Todos", count: totalCount },
              { key: "permitidos", label: "Permitidos", count: allowedCount },
              { key: "noPermitidos", label: "No permitidos", count: deniedCount },
            ]}
            value={filter}
            onChange={setFilter}
            aria-label="Filtrar por estado del permiso"
          />

          <div className="w-56">
            <Select
              size="sm"
              value={selectedModule}
              onChange={setSelectedModule}
              options={[
                { value: "todos", label: `Todos los módulos (${modules.length})` },
                ...modules.map((m) => ({ value: m, label: m })),
              ]}
              placeholder="Filtrar por módulo"
              aria-label="Filtrar por módulo"
            />
          </div>
        </div>

        <div className="w-full sm:w-64">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Buscar permiso, acción o código..."
          />
        </div>
      </div>

      {/* Contenido / Tabla */}
      {filteredItems.length === 0 ? (
        <div className="py-12 text-center">
          {filter === "noPermitidos" && staff.isAdmin && revokedSet.size === 0 ? (
            <div className="space-y-1">
              <ShieldCheck className="mx-auto size-9 text-emerald-500" />
              <p className="mt-2 text-[13px] font-semibold text-zinc-800">
                Sin permisos restringidos
              </p>
              <p className="mx-auto max-w-sm text-[12px] text-zinc-500">
                Al ser administrador activo del sistema, este colaborador posee autorización completa
                en todos los módulos y departamentos.
              </p>
            </div>
          ) : filter === "permitidos" && allowedCount === 0 ? (
            <div className="space-y-1">
              <ShieldAlert className="mx-auto size-9 text-amber-500" />
              <p className="mt-2 text-[13px] font-semibold text-zinc-800">
                Sin permisos concedidos
              </p>
              <p className="mx-auto max-w-sm text-[12px] text-zinc-500">
                Este colaborador no tiene departamentos con roles activos asignados, por lo que no puede
                realizar acciones dentro del panel.
              </p>
            </div>
          ) : search || selectedModule !== "todos" ? (
            <EmptyResult
              message="No se encontraron permisos coincidentes con los filtros aplicados."
              onClear={() => {
                setSearch("");
                setSelectedModule("todos");
              }}
              clearLabel="Limpiar búsqueda y filtros"
            />
          ) : (
            <div className="text-[12.5px] text-faint">No hay permisos para mostrar.</div>
          )}
        </div>
      ) : (
        <DataTable bare>
          <thead>
            <HeadRow>
              <Th className="w-36">Estado</Th>
              <Th className="sm:w-[310px]">Permiso / Acción</Th>
              <Th className="w-32">Módulo</Th>
              <Th>Ámbito / Dónde aplica</Th>
              <Th className="w-48 text-right pr-4">Personalización</Th>
            </HeadRow>
          </thead>
          <tbody>
            {filteredItems.map((item) => {
              const isBusy = busyKey === item.key;

              return (
                <Row key={item.key}>
                  {/* Columna Estado */}
                  <Td>
                    {item.isAllowed ? (
                      <Badge tone="green" className="gap-1 font-semibold">
                        <CheckCircle2 className="size-3 text-emerald-600" />
                        <span>Permitido</span>
                      </Badge>
                    ) : (
                      <Badge tone="neutral" className="gap-1 border-rose-200 bg-rose-50 text-rose-700 font-semibold">
                        <XCircle className="size-3 text-rose-500" />
                        <span>No permitido</span>
                      </Badge>
                    )}
                  </Td>

                  {/* Columna Permiso / Acción */}
                  <Td>
                    <div className="flex flex-col gap-0.5">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[13px] font-medium leading-tight text-ink">
                          {item.label}
                        </span>
                        {item.isCustomGranted && (
                          <Badge tone="amber" className="text-[9.5px] h-4 px-1" title="Permiso concedido individualmente como excepción para este usuario">
                            Personalizado (+Concedido)
                          </Badge>
                        )}
                        {item.isCustomRevoked && (
                          <Badge tone="red" className="text-[9.5px] h-4 px-1" title="Permiso revocado individualmente como excepción para este usuario">
                            Personalizado (-Quitado)
                          </Badge>
                        )}
                      </div>
                      <span className="mt-0.5 text-[11.5px] leading-normal text-zinc-500">
                        {item.hint}
                      </span>
                    </div>
                  </Td>

                  {/* Columna Módulo */}
                  <Td>
                    <Badge tone="slate">{item.module}</Badge>
                  </Td>

                  {/* Columna Ámbito / Detalle de acceso */}
                  <Td className="text-[12.5px]">
                    {item.isAllowed ? (
                      item.scope === "todos" ? (
                        <Badge tone="green">Todos los departamentos</Badge>
                      ) : item.departments.length > 0 ? (
                        <span className="font-medium text-zinc-700">
                          {item.departments.join(", ")}
                        </span>
                      ) : (
                        <span className="text-faint">—</span>
                      )
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-[12px] text-faint">
                        <Ban className="size-3 text-rose-400 shrink-0" />
                        <span>{item.denialReason}</span>
                      </span>
                    )}
                  </Td>

                  {/* Columna Personalización / Acciones */}
                  <Td className="text-right pr-4">
                    <div className="flex items-center justify-end gap-1.5">
                      {item.isCustomGranted ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={isBusy}
                          onClick={() => handleOverride(item.key, "reset")}
                          className="text-[11.5px] h-7 px-2 text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
                          title="Restablecer al permiso definido por sus roles asignados"
                        >
                          {isBusy ? (
                            <Spinner size="sm" className="size-3 text-zinc-500" />
                          ) : (
                            <RotateCcw className="size-3 mr-1" />
                          )}
                          <span>Restablecer</span>
                        </Button>
                      ) : item.isCustomRevoked ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={isBusy}
                          onClick={() => handleOverride(item.key, "reset")}
                          className="text-[11.5px] h-7 px-2 text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
                          title="Restablecer al permiso definido por sus roles asignados"
                        >
                          {isBusy ? (
                            <Spinner size="sm" className="size-3 text-zinc-500" />
                          ) : (
                            <RotateCcw className="size-3 mr-1" />
                          )}
                          <span>Restablecer</span>
                        </Button>
                      ) : item.isAllowed ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={isBusy}
                          onClick={() => handleOverride(item.key, "revoke")}
                          className="text-[11.5px] h-7 px-2 text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                          title="Quitar este permiso a nivel individual para este usuario"
                        >
                          {isBusy ? (
                            <Spinner size="sm" className="size-3 text-rose-500" />
                          ) : (
                            <UserMinus className="size-3 mr-1" />
                          )}
                          <span>Quitar permiso</span>
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={isBusy}
                          onClick={() => handleOverride(item.key, "grant")}
                          className="text-[11.5px] h-7 px-2 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800"
                          title="Conceder este permiso a nivel individual para este usuario"
                        >
                          {isBusy ? (
                            <Spinner size="sm" className="size-3 text-emerald-600" />
                          ) : (
                            <UserCheck className="size-3 mr-1" />
                          )}
                          <span>Permitir</span>
                        </Button>
                      )}
                    </div>
                  </Td>
                </Row>
              );
            })}
          </tbody>
        </DataTable>
      )}
    </DetailCard>
  );
}
