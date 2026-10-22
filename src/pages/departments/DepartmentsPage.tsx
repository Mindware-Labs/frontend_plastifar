import {
  Building,
  Lock,
  Mail,
  Pencil,
  Plus,
  Power,
  Shield,
  Trash2,
  UserCheck,
  Users,
} from "lucide-react";
import { useMemo, useState } from "react";
import { departmentsApi } from "../../api/departments";
import { sedesApi } from "../../api/sedes";
import { ModuleHeader } from "../../components/app/ModuleHeader";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { ConfirmDialog, type ConfirmDialogProps } from "../../components/ui/ConfirmDialog";
import { DataTable, HeadRow, Row, Td, Th } from "../../components/ui/DataTable";
import { ClearFiltersButton, FilterDropdown, type FilterOption } from "../../components/ui/FilterDropdown";
import { HeaderTag } from "../../components/ui/HeaderTag";
import { ListPanel } from "../../components/ui/ListPanel";
import { RowAction } from "../../components/ui/RowAction";
import { SearchInput } from "../../components/ui/SearchInput";
import { TableSkeleton } from "../../components/ui/Skeleton";
import { StatusDot } from "../../components/ui/StatusDot";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";
import { usePermissions } from "../../hooks/usePermissions";
import type { DepartmentResponse, DepartmentType } from "../../types/api";
import { LoadErrorAlert } from "../settings/catalogSection";
import { useReferenceData } from "../settings/catalogState";
import { DepartmentModal } from "./DepartmentModal";

type ChipKey = "todos" | "activos" | "inactivos";
type TypeKey = "todos" | DepartmentType;

export function DepartmentsPage() {
  const { can } = usePermissions();
  const canWrite = can("settings.write");

  const [busyId, setBusyId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [chip, setChip] = useState<ChipKey>("todos");
  const [typeChip, setTypeChip] = useState<TypeKey>("todos");
  const [selectedSedeId, setSelectedSedeId] = useState<string>("todas");
  const [modal, setModal] = useState<"nuevo" | DepartmentResponse | null>(null);
  const [confirmation, setConfirmation] = useState<Omit<ConfirmDialogProps, "onClose"> | null>(null);

  const debouncedSearch = useDebouncedValue(search).trim().toLowerCase();

  const {
    data: all,
    failed,
    reload,
  } = useReferenceData<DepartmentResponse[] | null>(
    () => departmentsApi.list({ includeInactive: true }),
    null,
  );

  const { data: sedesList } = useReferenceData(
    () => sedesApi.list({ includeInactive: false, pageSize: 100 }),
    null,
  );

  const counts = useMemo(() => {
    if (all === null) return undefined;
    return {
      all: all.length,
      active: all.filter((d) => d.isActive).length,
      inactive: all.filter((d) => !d.isActive).length,
      publicos: all.filter((d) => (d.type ?? "Publico") === "Publico").length,
      privados: all.filter((d) => d.type === "Privado").length,
    };
  }, [all]);

  // Opciones de filtro para el selector de Sedes
  const sedeOptions = useMemo<FilterOption[]>(() => {
    const sedes = sedesList?.items ?? [];
    const options: FilterOption[] = [
      {
        value: "todas",
        label: "Todas las sedes",
        icon: <Building className="h-4 w-4 text-zinc-500" />,
      },
    ];

    for (const s of sedes) {
      options.push({
        value: String(s.id),
        label: s.name,
        icon: <Building className="h-4 w-4 text-zinc-500" />,
      });
    }

    const hasSinSede = all ? all.some((d) => !d.sedeId) : true;
    if (hasSinSede) {
      options.push({
        value: "sin-sede",
        label: "Sin sede asignada",
        icon: <Building className="h-4 w-4 text-zinc-400" />,
      });
    }

    return options;
  }, [all, sedesList]);

  const visible = useMemo(() => {
    if (all === null) return [];

    // 1. Filtrar por sede / pestaña
    let list = all;
    if (selectedSedeId === "sin-sede") {
      list = list.filter((d) => !d.sedeId);
    } else if (selectedSedeId !== "todas") {
      const sedeIdNum = Number(selectedSedeId);
      list = list.filter((d) => d.sedeId === sedeIdNum);
    }

    // 2. Filtrar por estado y tipo
    list = list
      .filter((d) => (chip === "todos" ? true : chip === "activos" ? d.isActive : !d.isActive))
      .filter((d) => typeChip === "todos" || (d.type ?? "Publico") === typeChip);

    // 3. Filtrar por búsqueda
    if (debouncedSearch !== "") {
      list = list.filter((d) => {
        const nameMatch = d.name.toLowerCase().includes(debouncedSearch);
        const sedeMatch = d.sedeName?.toLowerCase().includes(debouncedSearch) ?? false;
        const mailMatch = d.mailboxAddress?.toLowerCase().includes(debouncedSearch) ?? false;
        const managerMatch = d.managerName?.toLowerCase().includes(debouncedSearch) ?? false;
        return nameMatch || sedeMatch || mailMatch || managerMatch;
      });
    }

    return list;
  }, [all, chip, typeChip, selectedSedeId, debouncedSearch]);

  const isFiltering =
    debouncedSearch !== "" || chip !== "todos" || typeChip !== "todos" || selectedSedeId !== "todas";

  function askToggle(department: DepartmentResponse) {
    setConfirmation({
      tone: "warn",
      icon: Power,
      title: department.isActive ? "Desactivar departamento" : "Reactivar departamento",
      description: department.isActive ? (
        <>
          <strong className="font-semibold text-ink">{department.name}</strong> dejará de ofrecerse
          al asignar personal o encolar un ticket.{" "}
          {(department.staffCount ?? 0) > 0 ? (
            <>
              {department.staffCount}{" "}
              {department.staffCount === 1
                ? "colaborador lo conserva"
                : "colaboradores lo conservan"}{" "}
              como departamento primario.
            </>
          ) : (
            <>No hay nadie asignado a él.</>
          )}
        </>
      ) : (
        <>
          <strong className="font-semibold text-ink">{department.name}</strong> vuelve a estar
          disponible al asignar personal y al encolar un ticket.
        </>
      ),
      confirmLabel: department.isActive ? "Desactivar" : "Reactivar",
      onConfirm: async () => {
        setBusyId(department.id);
        try {
          const current = await departmentsApi.get(department.id);
          await departmentsApi.update(current.id, {
            name: current.name,
            parentId: current.parentId ?? null,
            sedeId: current.sedeId ?? null,
            isActive: !current.isActive,
            type: current.type ?? "Publico",
            defaultRoleId: current.defaultRoleId ?? null,
            mailboxId: current.mailboxId ?? null,
            managerStaffId: current.managerStaffId ?? null,
          });
          reload();
        } finally {
          setBusyId(null);
        }
      },
    });
  }

  function askDelete(department: DepartmentResponse) {
    setConfirmation({
      tone: "danger",
      icon: Trash2,
      title: "Eliminar departamento",
      description: (
        <>
          <strong className="font-semibold text-ink">{department.name}</strong> se borra de forma
          permanente.
        </>
      ),
      confirmLabel: "Eliminar",
      onConfirm: async () => {
        setBusyId(department.id);
        try {
          await departmentsApi.remove(department.id);
          reload();
        } finally {
          setBusyId(null);
        }
      },
    });
  }

  return (
    <div className="flex h-full flex-col">
      <ModuleHeader
        title="Departamentos"
        summary={
          counts ? (
            <div className="flex flex-wrap items-center gap-1.5 tabular-nums">
              <HeaderTag
                label={counts.all === 1 ? "departamento" : "departamentos"}
                count={counts.all}
                active={chip === "todos" && typeChip === "todos"}
                onClick={() => {
                  setChip("todos");
                  setTypeChip("todos");
                }}
                tone="neutral"
                title="Mostrar todos los departamentos"
              />
              <span aria-hidden className="text-zinc-300">·</span>
              <HeaderTag
                label={counts.active === 1 ? "activo" : "activos"}
                count={counts.active}
                active={chip === "activos"}
                onClick={() => setChip("activos")}
                tone="emerald"
                dot
                title="Filtrar por departamentos activos"
              />
              <span aria-hidden className="text-zinc-300">·</span>
              <HeaderTag
                label={counts.inactive === 1 ? "inactivo" : "inactivos"}
                count={counts.inactive}
                active={chip === "inactivos"}
                onClick={() => setChip("inactivos")}
                tone="red"
                dot
                title="Filtrar por departamentos inactivos"
              />
              <span aria-hidden className="text-zinc-300">·</span>
              <HeaderTag
                label={counts.publicos === 1 ? "público" : "públicos"}
                count={counts.publicos}
                active={typeChip === "Publico"}
                onClick={() => setTypeChip(typeChip === "Publico" ? "todos" : "Publico")}
                tone="blue"
                dot
                title="Filtrar por departamentos públicos"
              />
              <span aria-hidden className="text-zinc-300">·</span>
              <HeaderTag
                label={counts.privados === 1 ? "privado" : "privados"}
                count={counts.privados}
                active={typeChip === "Privado"}
                onClick={() => setTypeChip(typeChip === "Privado" ? "todos" : "Privado")}
                tone="amber"
                dot
                title="Filtrar por departamentos privados"
              />
            </div>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-[12px] text-zinc-400">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-zinc-300" />
              Cargando departamentos…
            </span>
          )
        }
        action={
          canWrite && (
            <Button size="sm" onClick={() => setModal("nuevo")} disabled={busyId !== null}>
              <Plus className="h-[15px] w-[15px]" />
              Nuevo departamento
            </Button>
          )
        }
      />

      {failed && (
        <LoadErrorAlert message="No se pudieron cargar los departamentos" onRetry={reload} />
      )}

      <div className="min-h-0 flex-1 overflow-y-auto pb-8">
        <ListPanel
          toolbar={
            <div className="flex flex-wrap items-center gap-2">
              <SearchInput
                value={search}
                onChange={setSearch}
                placeholder="Buscar por departamento, sede o correo…"
                className="w-[260px] sm:w-[280px]"
              />
              <FilterDropdown
                title="Seleccionar tipo"
                aria-label="Filtrar por tipo de departamento"
                value={typeChip}
                onChange={(next) => setTypeChip(next as TypeKey)}
                defaultIcon={<Users className="h-3.5 w-3.5 text-zinc-500" />}
                options={[
                  { value: "todos", label: "Todos los tipos", icon: <Users className="h-4 w-4 text-zinc-500" /> },
                  { value: "Publico", label: "Públicos", icon: <Users className="h-4 w-4 text-blue-600" /> },
                  { value: "Privado", label: "Privados", icon: <Lock className="h-4 w-4 text-amber-600" /> },
                ]}
              />
              <FilterDropdown
                title="Seleccionar sede"
                aria-label="Filtrar por sede"
                value={selectedSedeId}
                onChange={(next) => setSelectedSedeId(next)}
                defaultIcon={<Building className="h-3.5 w-3.5 text-zinc-500" />}
                options={sedeOptions}
                searchable={sedeOptions.length > 6}
                searchPlaceholder="Buscar sede…"
              />
              {(search || typeChip !== "todos" || chip !== "todos" || selectedSedeId !== "todas") && (
                <ClearFiltersButton
                  onClick={() => {
                    setSearch("");
                    setTypeChip("todos");
                    setChip("todos");
                    setSelectedSedeId("todas");
                  }}
                />
              )}
            </div>
          }
        >
          {all === null ? (
            !failed && <TableSkeleton rows={8} columns={7} />
          ) : visible.length === 0 ? (
            <p className="py-14 text-center text-[13.5px] text-faint">
              {isFiltering
                ? "Ningún departamento coincide con este filtro o búsqueda."
                : "Todavía no hay ningún departamento registrado."}
            </p>
          ) : (
            <DataTable>
              <thead>
                <HeadRow>
                  <Th className="w-56">Sede</Th>
                  <Th>Departamento</Th>
                  <Th className="w-28">Tipo</Th>
                  <Th className="w-56">Correo</Th>
                  <Th className="w-56">Administrador</Th>
                  <Th className="w-48">Permisos</Th>
                  <Th className="w-24">Estado</Th>
                  {canWrite && <Th className="w-24 text-right">Acciones</Th>}
                </HeadRow>
              </thead>
              <tbody>
                {visible.map((d) => {
                  const propios = d.staffCount ?? 0;

                  return (
                    <Row key={d.id} busy={busyId === d.id}>
                      {/* 1. SEDE */}
                      <Td>
                        {d.sedeName ? (
                          <span className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-zinc-800">
                            <Building className="h-3.5 w-3.5 shrink-0 text-zinc-400" />
                            <span className="truncate">{d.sedeName}</span>
                          </span>
                        ) : (
                          <span className="text-[12px] text-zinc-400 italic">Sin sede</span>
                        )}
                      </Td>

                      {/* 2. DEPARTAMENTO */}
                      <Td>
                        <span className="text-[12.5px] font-semibold text-ink">
                          {d.name}
                        </span>
                      </Td>

                      {/* 3. TIPO */}
                      <Td>
                        {d.type === "Privado" ? (
                          <Badge tone="slate" className="gap-1">
                            <Lock className="h-2.5 w-2.5" />
                            Privado
                          </Badge>
                        ) : (
                          <Badge tone="neutral" className="gap-1">
                            <Users className="h-2.5 w-2.5" />
                            Público
                          </Badge>
                        )}
                      </Td>

                      {/* 4. CORREO / BUZÓN */}
                      <Td>
                        {d.mailboxAddress ? (
                          <span
                            className="inline-flex items-center gap-1.5 max-w-[210px] truncate text-[12.5px] text-zinc-700"
                            title={d.mailboxAddress}
                          >
                            <Mail className="h-3.5 w-3.5 shrink-0 text-zinc-400" />
                            <span className="truncate">{d.mailboxAddress}</span>
                          </span>
                        ) : (
                          <span className="text-[12px] text-zinc-400 italic">Sin correo</span>
                        )}
                      </Td>

                      {/* 5. ADMINISTRADOR / ENCARGADO */}
                      <Td>
                        {d.managerName ? (
                          <span className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-zinc-800">
                            <UserCheck className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
                            <span className="truncate">{d.managerName}</span>
                          </span>
                        ) : (
                          <span className="text-[12px] text-zinc-400 italic">Sin administrador</span>
                        )}
                      </Td>

                      {/* 6. PERMISOS / ROL PREDETERMINADO */}
                      <Td>
                        {d.defaultRoleName ? (
                          <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-[12px] text-zinc-700">
                            <Shield className="h-3.5 w-3.5 shrink-0 text-zinc-400" />
                            <span>{d.defaultRoleName}</span>
                          </span>
                        ) : (
                          <span className="text-[12px] text-zinc-400 italic">Sin rol</span>
                        )}
                      </Td>

                      {/* 7. ESTADO */}
                      <Td>
                        <StatusDot active={d.isActive} />
                      </Td>

                      {/* 8. ACCIONES */}
                      {canWrite && (
                        <Td>
                          <div className="flex items-center justify-end gap-1">
                            <RowAction
                              label={`Editar ${d.name}`}
                              icon={Pencil}
                              onClick={() => setModal(d)}
                              disabled={busyId === d.id}
                            />
                            <RowAction
                              label={d.isActive ? `Desactivar ${d.name}` : `Reactivar ${d.name}`}
                              icon={Power}
                              onClick={() => askToggle(d)}
                              disabled={busyId === d.id}
                            />
                            {propios === 0 && (
                              <RowAction
                                label={`Eliminar ${d.name}`}
                                icon={Trash2}
                                danger
                                onClick={() => askDelete(d)}
                                disabled={busyId === d.id}
                              />
                            )}
                          </div>
                        </Td>
                      )}
                    </Row>
                  );
                })}
              </tbody>
            </DataTable>
          )}
        </ListPanel>
      </div>

      {modal !== null && (
        <DepartmentModal
          department={modal === "nuevo" ? undefined : modal}
          onClose={() => setModal(null)}
          onSaved={reload}
        />
      )}

      {confirmation && <ConfirmDialog {...confirmation} onClose={() => setConfirmation(null)} />}
    </div>
  );
}
