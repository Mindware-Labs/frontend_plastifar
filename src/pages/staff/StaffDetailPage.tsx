import { Building2, KeyRound, Star, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { ApiError } from "../../api/client";
import { departmentsApi } from "../../api/departments";
import { permissionsApi } from "../../api/permissions";
import { staffApi } from "../../api/staff";
import { DetailLoadError } from "../../components/app/DetailLoadError";
import { ModuleHeader } from "../../components/app/ModuleHeader";
import { Alert } from "../../components/ui/Alert";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { ListEmptyState } from "../../components/ui/ListEmptyState";
import { ConfirmDialog, type ConfirmDialogProps } from "../../components/ui/ConfirmDialog";
import { DataTable, HeadRow, Row, Td, Th } from "../../components/ui/DataTable";
import { DetailCard } from "../../components/ui/DetailCard";
import { ErrorRetry } from "../../components/ui/ErrorRetry";
import { StaffDetailSkeleton } from "../../components/ui/Skeleton";
import { RowAction } from "../../components/ui/RowAction";
import { useDynamicBreadcrumb } from "../../context/useBreadcrumb";
import { useReceipts } from "../../context/useReceipts";
import { useConfigNoticeReceipt } from "../../hooks/useNoticeReceipts";
import { usePermissions } from "../../hooks/usePermissions";
import { departmentPaths } from "../../lib/departments";
import type { DepartmentResponse } from "../../types/api";
import type { DepartmentAccess, PermissionGroup, StaffDetail } from "../../types/permissions";
import { StaffActivityTab } from "./StaffActivityTab";
import { StaffEffectivePermissionsCard } from "./StaffEffectivePermissionsCard";
import { StaffOverview } from "./StaffOverview";

interface StaffDetailPageProps {
  section: "datos" | "accesos" | "actividad";
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
  const [catalogGroups, setCatalogGroups] = useState<PermissionGroup[]>([]);
  const receipts = useReceipts();
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

  function loadCatalog() {
    permissionsApi
      .catalog()
      .then(setCatalogGroups)
      .catch(() => {
        // En caso de fallo de red, StaffEffectivePermissionsCard utilizará el catálogo canónico por defecto.
      });
  }

  useEffect(() => {
    if (!id) return;
    void load();
    void loadDepartments();
    void loadCatalog();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const fullName = staff ? `${staff.firstName} ${staff.lastName}` : "";
  useDynamicBreadcrumb(staff ? fullName : null);

  // Notificación tipo toast al entrar a accesos si el colaborador es administrador
  useConfigNoticeReceipt(
    Boolean(staff?.isAdmin && section === "accesos"),
    "Perfil de administrador",
    "Es administrador del sistema",
    "Tiene todos los permisos en todos los departamentos. Los accesos asignados indican dónde trabaja.",
  );

  const primary = staff?.accesses.find((access) => access.isPrimary) ?? null;
  const departmentPathById = departmentPaths(departments);
  const departmentLabel = (access: { departmentId: number; departmentName: string }) =>
    departmentPathById.get(access.departmentId) ?? access.departmentName;

  async function makePrimary(access: DepartmentAccess) {
    setBusyDepartmentId(access.departmentId);
    setError(null);
    try {
      await staffApi.updateDepartmentAccess(staffId, access.departmentId, {
        roleId: access.roleId,
        isPrimary: true,
      });
      await reload();
      receipts.done({
        action: "departamento-principal",
        title: "Departamento principal actualizado",
        detail: departmentLabel(access),
      });
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "No se pudo cambiar el departamento principal";
      setError(message);
      receipts.failed({ action: "departamento-principal", title: "No se pudo cambiar el departamento principal", detail: message });
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
          receipts.done({ action: "revocar-acceso", title: "Acceso revocado", detail: departmentLabel(access) });
        } catch (err) {
          receipts.failed({
            action: "revocar-acceso",
            title: "No se pudo revocar el acceso",
            detail: err instanceof Error ? err.message : undefined,
          });
        } finally {
          setBusyDepartmentId(null);
        }
      },
    });
  }

  const sections = [
    { label: "Datos", to: `/staff/${id}` },
    { label: "Accesos", to: `/staff/${id}/accesos` },
    { label: "Actividad", to: `/staff/${id}/actividad` },
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
            ) : section === "accesos" ? (
              <div className="space-y-3.5">
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
                    <ListEmptyState
                      icon={Building2}
                      isFiltered={false}
                      filteredTitle=""
                      emptyTitle="Sin departamentos asignados"
                      emptyDescription="Este colaborador no tiene acceso configurado a ningún departamento."
                    />
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

                {/* Tarjeta 2: Permisos efectivos y restricciones */}
                <StaffEffectivePermissionsCard
                  staff={staff}
                  catalogGroups={catalogGroups}
                  onReload={reload}
                />
              </div>
            ) : (
              <StaffActivityTab staffId={staffId} staffName={fullName} />
            )}
          </div>
        </div>
      </div>

      {confirmation && <ConfirmDialog {...confirmation} onClose={() => setConfirmation(null)} />}
    </div>
  );
}
