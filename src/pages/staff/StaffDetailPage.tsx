import { Building2, KeyRound, ShieldCheck, Star, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { ApiError } from "../../api/client";
import { departmentsApi } from "../../api/departments";
import { staffApi } from "../../api/staff";
import { DetailLoadError } from "../../components/app/DetailLoadError";
import { ModuleHeader } from "../../components/app/ModuleHeader";
import { Alert } from "../../components/ui/Alert";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { ConfirmDialog, type ConfirmDialogProps } from "../../components/ui/ConfirmDialog";
import { DataTable, HeadRow, Row, Td, Th } from "../../components/ui/DataTable";
import { DetailCard } from "../../components/ui/DetailCard";
import { ErrorRetry } from "../../components/ui/ErrorRetry";
import { StaffDetailSkeleton } from "../../components/ui/Skeleton";
import { RowAction } from "../../components/ui/RowAction";
import { useDynamicBreadcrumb } from "../../context/useBreadcrumb";
import { usePermissions } from "../../hooks/usePermissions";
import { departmentPaths } from "../../lib/departments";
import type { DepartmentResponse } from "../../types/api";
import type { DepartmentAccess, StaffDetail } from "../../types/permissions";
import { StaffOverview } from "./StaffOverview";

interface StaffDetailPageProps {
  section: "datos" | "accesos";
}

const dateFormat = new Intl.DateTimeFormat("es-DO", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

/** Las fechas viajan en UTC; la conversión a hora local ocurre solo al mostrar. */
function formatDate(value: string | null) {
  return value === null ? "—" : dateFormat.format(new Date(value));
}

export function StaffDetailPage({ section }: StaffDetailPageProps) {
  const { id } = useParams();
  const { isAdmin } = usePermissions();
  const canWrite = isAdmin;

  const [staff, setStaff] = useState<StaffDetail | null>(null);
  const [departments, setDepartments] = useState<DepartmentResponse[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [referenceError, setReferenceError] = useState<string | null>(null);
  const [busyDepartmentId, setBusyDepartmentId] = useState<number | null>(null);
  const [confirmation, setConfirmation] = useState<Omit<ConfirmDialogProps, "onClose"> | null>(null);

  const staffId = Number(id);

  function reload() {
    return staffApi.getDepartmentAccess(staffId).then(setStaff);
  }

  function load() {
    setError(null);
    return staffApi
      .getDepartmentAccess(staffId)
      .then(setStaff)
      .catch((err) => {
        setError(
          err instanceof ApiError ? err.message : "No se pudo cargar la ficha del colaborador",
        );
      });
  }

  function loadDepartments() {
    setReferenceError(null);
    departmentsApi
      .list()
      .then(setDepartments)
      .catch(() => {
        setReferenceError(
          "No se pudieron cargar los departamentos completos para resolver sus rutas jerárquicas.",
        );
      });
  }

  useEffect(() => {
    if (!id) return;
    void load();
    void loadDepartments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const fullName = staff ? `${staff.firstName} ${staff.lastName}` : "";
  useDynamicBreadcrumb(staff ? fullName : null);
  const primary = staff?.accesses.find((access) => access.isPrimary) ?? null;
  const departmentPathById = departmentPaths(departments);
  const departmentLabel = (access: { departmentId: number; departmentName: string }) =>
    departmentPathById.get(access.departmentId) ?? access.departmentName;
  const effective = staff?.effectivePermissions ?? [];

  async function makePrimary(access: DepartmentAccess) {
    setBusyDepartmentId(access.departmentId);
    setError(null);
    try {
      await staffApi.updateDepartmentAccess(staffId, access.departmentId, {
        roleId: access.roleId,
        isPrimary: true,
      });
      await reload();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo cambiar el departamento principal");
    } finally {
      setBusyDepartmentId(null);
    }
  }

  function askRevoke(access: DepartmentAccess) {
    if (!staff) return;

    setConfirmation({
      tone: "warn",
      icon: KeyRound,
      title: "Revocar acceso",
      description: (
        <>
          <strong className="font-semibold text-ink">{fullName}</strong> dejará de ver y trabajar
          los recursos de{" "}
          <strong className="font-semibold text-ink">{departmentLabel(access)}</strong>. Su historial
          en ese departamento se conserva, y puedes volver a otorgarle el acceso cuando quieras.
        </>
      ),
      confirmLabel: "Revocar acceso",
      onConfirm: async () => {
        setBusyDepartmentId(access.departmentId);
        try {
          await staffApi.revokeDepartmentAccess(staffId, access.departmentId);
          await reload();
        } finally {
          setBusyDepartmentId(null);
        }
      },
    });
  }

  const sections = [
    { label: "Datos", to: `/staff/${id}` },
    { label: "Accesos", to: `/staff/${id}/accesos` },
  ];

  if (error !== null && staff === null) {
    return (
      <DetailLoadError title="Colaborador" sections={sections} onRetry={() => void load()}>
        {error}
      </DetailLoadError>
    );
  }

  if (staff === null) {
    return <StaffDetailSkeleton section={section} />;
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <ModuleHeader
        backTo="/staff"
        backLabel="Volver al listado de personal"
        title={fullName}
        summary={`${staff.email} · ${primary ? primary.departmentName : "Sin departamento principal"}`}
        sections={sections}
      />

      <div className="min-h-0 flex-1 overflow-y-auto pb-8 pr-0.5">
        <div className="mx-auto mt-3.5 max-w-6xl px-3 lg:px-4">
          {error !== null && (
            <ErrorRetry className="mb-3.5" onRetry={() => void load()}>
              {error}
            </ErrorRetry>
          )}

          {referenceError !== null && (
            <ErrorRetry className="mb-3.5" onRetry={() => void loadDepartments()}>
              {referenceError}
            </ErrorRetry>
          )}

          {staff.isLastAdmin && (
            <div className="mb-3.5">
              <Alert variant="info">
                Es el único administrador activo del sistema. Hasta que exista otro, no se le puede
                quitar el perfil de administrador ni desactivar: quedarían todos fuera de la
                administración del panel.
              </Alert>
            </div>
          )}

          <div key={section} className="animate-plf-apple-tab">
            {section === "datos" ? (
              <StaffOverview
                staff={staff}
                fullName={fullName}
                departmentLabel={departmentLabel}
                formatDate={formatDate}
                accessesTo={`/staff/${id}/accesos`}
              />
            ) : (
              <div className="space-y-3.5">
                {staff.isAdmin && (
                  <Alert variant="info">
                    Es administrador: tiene todos los permisos en todos los departamentos. Los accesos de
                    abajo no limitan lo que puede hacer, solo indican dónde trabaja.
                  </Alert>
                )}

                {/* Tarjeta 1: Departamentos con acceso */}
                <DetailCard
                  icon={Building2}
                  title={`Departamentos y roles asignados (${staff.accesses.length})`}
                  aside={
                    primary ? (
                      <span className="inline-flex items-center gap-1.5 text-[11.5px] font-medium text-zinc-500">
                        <Star className="size-3.5 fill-brand-gray text-brand-gray" />
                        <span>Principal: {departmentLabel(primary)}</span>
                      </span>
                    ) : null
                  }
                >
                  {staff.accesses.length === 0 ? (
                    <div className="py-10 text-center">
                      <Building2 className="mx-auto h-8 w-8 text-zinc-300" />
                      <p className="mt-2 text-[13px] font-medium text-zinc-700">
                        Sin departamentos asignados
                      </p>
                      <p className="mt-0.5 text-[12px] text-zinc-400">
                        Este colaborador no tiene acceso configurado a ningún departamento.
                      </p>
                    </div>
                  ) : (
                    <DataTable bare>
                      <thead>
                        <HeadRow>
                          <Th>Departamento</Th>
                          <Th>Rol</Th>
                          <Th>Principal</Th>
                          <Th>Otorgado por</Th>
                          <Th>Desde</Th>
                          {canWrite && <Th className="w-24 text-right">Acciones</Th>}
                        </HeadRow>
                      </thead>
                      <tbody>
                        {staff.accesses.map((access) => (
                          <Row key={access.departmentId} busy={busyDepartmentId === access.departmentId}>
                            <Td className="text-[13px] font-medium text-ink">
                              <span className="flex items-center gap-2">
                                <span
                                  aria-hidden
                                  className="flex size-6 shrink-0 items-center justify-center rounded-md bg-zinc-100 text-zinc-500"
                                >
                                  {access.isPrimary ? (
                                    <Star className="size-3.5 fill-brand-gray text-brand-gray" />
                                  ) : (
                                    <Building2 className="size-3.5" strokeWidth={2.25} />
                                  )}
                                </span>
                                <span>{departmentLabel(access)}</span>
                              </span>
                            </Td>
                            <Td>
                              <Badge>{access.roleName}</Badge>
                            </Td>
                            <Td>
                              {access.isPrimary ? (
                                <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-[12.5px] font-medium text-ink">
                                  <Star aria-hidden className="h-3.5 w-3.5 fill-brand-gray text-brand-gray" />
                                  Principal
                                </span>
                              ) : !canWrite ? (
                                <span className="text-[12.5px] text-faint">—</span>
                              ) : (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="-mx-3.5"
                                  onClick={() => makePrimary(access)}
                                  disabled={busyDepartmentId === access.departmentId}
                                >
                                  Hacer principal
                                </Button>
                              )}
                            </Td>
                            <Td className="text-[12.5px] text-brand-gray">{access.grantedByName ?? "—"}</Td>
                            <Td className="text-[12.5px] font-mono tabular-nums text-brand-gray">
                              {formatDate(access.grantedAt)}
                            </Td>
                            {canWrite && (
                              <Td>
                                <div className="flex items-center justify-end">
                                  <RowAction
                                    label={
                                      access.isPrimary
                                        ? "El acceso principal no se revoca: marca otro como principal primero"
                                        : `Revocar el acceso a ${departmentLabel(access)}`
                                    }
                                    icon={Trash2}
                                    onClick={() => askRevoke(access)}
                                    disabled={access.isPrimary || busyDepartmentId === access.departmentId}
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
                </DetailCard>

                {/* Tarjeta 2: Permisos efectivos */}
                <DetailCard
                  icon={ShieldCheck}
                  title={`Permisos efectivos (${effective.length})`}
                  aside={
                    <span className="text-[11.5px] text-zinc-400">
                      {staff.isAdmin
                        ? "Acceso total de administrador"
                        : "Suma de los permisos de los roles asignados"}
                    </span>
                  }
                >
                  <div className="border-b border-zinc-100 bg-zinc-50/50 px-4 py-2 text-[12px] text-zinc-500">
                    Lo que esta persona puede hacer hoy en el panel de Plastifar. No se edita directamente aquí: se gestiona mediante los roles otorgados a cada departamento.
                  </div>

                  {effective.length === 0 ? (
                    <div className="py-10 text-center">
                      <ShieldCheck className="mx-auto h-8 w-8 text-zinc-300" />
                      <p className="mt-2 text-[13px] font-medium text-zinc-700">
                        Sin permisos efectivos
                      </p>
                      <p className="mt-0.5 text-[12px] text-zinc-400">
                        {staff.accesses.length === 0
                          ? "Sin accesos departamentales no hay permisos: hoy esta persona no puede realizar acciones dentro del panel."
                          : "Tiene accesos, pero ninguno de sus roles concede todavía un permiso en la matriz."}
                      </p>
                    </div>
                  ) : (
                    <DataTable bare>
                      <thead>
                        <HeadRow>
                          <Th className="sm:w-[360px]">Permiso / Acción</Th>
                          <Th className="sm:w-[180px]">Módulo</Th>
                          <Th>Ámbito / Dónde aplica</Th>
                        </HeadRow>
                      </thead>
                      <tbody>
                        {effective.map(({ permission, module, departments, scope }) => (
                          <Row key={permission.key}>
                            <Td>
                              <span className="flex flex-col gap-0.5">
                                <span className="text-[13px] font-medium leading-tight text-ink">
                                  {permission.label}
                                </span>
                                <span className="font-mono text-[10.5px] leading-tight text-faint">
                                  {permission.key}
                                </span>
                              </span>
                            </Td>
                            <Td>
                              <Badge tone="slate">{module}</Badge>
                            </Td>
                            <Td className="text-[12.5px] text-brand-gray">
                              {scope === "todos" ? (
                                <Badge tone="green">Todos los departamentos</Badge>
                              ) : (
                                departments.join(", ")
                              )}
                            </Td>
                          </Row>
                        ))}
                      </tbody>
                    </DataTable>
                  )}
                </DetailCard>
              </div>
            )}
          </div>
        </div>
      </div>

      {confirmation && <ConfirmDialog {...confirmation} onClose={() => setConfirmation(null)} />}
    </div>
  );
}
