import { KeyRound, Pencil, Plus, Star, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { ModuleHeader } from "../../components/app/ModuleHeader";
import { Alert } from "../../components/ui/Alert";
import { Avatar } from "../../components/ui/Avatar";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { ConfirmDialog, type ConfirmDialogProps } from "../../components/ui/ConfirmDialog";
import { DataTable, HeadRow, Row, Td, Th } from "../../components/ui/DataTable";
import { RowAction } from "../../components/ui/RowAction";
import { Spinner } from "../../components/ui/Spinner";
import { StatusDot } from "../../components/ui/StatusDot";
import { useDynamicBreadcrumb } from "../../context/useBreadcrumb";
import { usePermissions } from "../../hooks/usePermissions";
import { permissionsMock, resolveEffectivePermissions } from "../../mocks/permissions";
import type {
  DepartmentAccess,
  PermissionMatrixResponse,
  StaffDetail,
} from "../../types/permissions";
import { AccessModal } from "./AccessModal";

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
  const { can } = usePermissions();
  const canWrite = can("staff.write");

  const [staff, setStaff] = useState<StaffDetail | null>(null);
  const [matrix, setMatrix] = useState<PermissionMatrixResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [modal, setModal] = useState<"nuevo" | DepartmentAccess | null>(null);
  const [confirmation, setConfirmation] = useState<Omit<ConfirmDialogProps, "onClose"> | null>(null);

  useEffect(() => {
    Promise.all([permissionsMock.staffDetail(), permissionsMock.matrix()])
      .then(([detail, data]) => {
        setStaff(detail);
        setMatrix(data);
      })
      .catch(() => setError("No se pudo cargar la ficha del colaborador"));
  }, [id]);

  const fullName = staff ? `${staff.firstName} ${staff.lastName}` : "";
  useDynamicBreadcrumb(staff ? fullName : null);
  const primary = staff?.accesses.find((access) => access.isPrimary) ?? null;

  const effective = useMemo(() => {
    if (!staff || !matrix) return [];
    return resolveEffectivePermissions(matrix.groups, matrix.grants, staff);
  }, [staff, matrix]);

  function updateAccesses(next: DepartmentAccess[]) {
    setStaff((previous) => (previous ? { ...previous, accesses: next } : previous));
  }

  function saveAccess(value: { departmentId: number; roleId: number; isPrimary: boolean }) {
    if (!staff || !matrix) return;

    const department = permissionsMock
      .departments()
      .find((entry) => entry.id === value.departmentId);
    const role = matrix.roles.find((entry) => entry.id === value.roleId);
    if (!department || !role) return;

    const existing = staff.accesses.find((access) => access.departmentId === value.departmentId);

    const entry: DepartmentAccess = {
      departmentId: department.id,
      departmentName: department.name,
      roleId: role.id,
      roleName: role.name,
      isPrimary: value.isPrimary,
      grantedAt: existing?.grantedAt ?? new Date().toISOString(),
      grantedByName: existing?.grantedByName ?? "Tú",
    };

    const rest = staff.accesses.filter((access) => access.departmentId !== value.departmentId);
    // Principal exclusivo: marcar uno desmarca al anterior en la misma operación.
    const normalized = value.isPrimary
      ? rest.map((access) => ({ ...access, isPrimary: false }))
      : rest;

    updateAccesses([...normalized, entry].sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary)));
  }

  function makePrimary(access: DepartmentAccess) {
    if (!staff) return;
    updateAccesses(
      staff.accesses
        .map((entry) => ({ ...entry, isPrimary: entry.departmentId === access.departmentId }))
        .sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary)),
    );
  }

  function askRevoke(access: DepartmentAccess) {
    if (!staff) return;

    setConfirmation({
      tone: "warn",
      icon: KeyRound,
      eyebrow: "Personal · Accesos",
      title: "Revocar acceso",
      description: (
        <>
          <strong className="font-semibold text-ink">{fullName}</strong> dejará de ver y trabajar
          los recursos de{" "}
          <strong className="font-semibold text-ink">{access.departmentName}</strong>. Su historial
          en ese departamento se conserva, y puedes volver a otorgarle el acceso cuando quieras.
        </>
      ),
      confirmLabel: "Revocar acceso",
      onConfirm: () =>
        updateAccesses(
          staff.accesses.filter((entry) => entry.departmentId !== access.departmentId),
        ),
    });
  }

  const sections = [
    { label: "Datos", to: `/staff/${id}` },
    { label: "Accesos", to: `/staff/${id}/accesos` },
  ];

  if (error) {
    return (
      <div>
        <ModuleHeader sections={sections} />
        <Alert variant="error">{error}</Alert>
      </div>
    );
  }

  if (staff === null || matrix === null) {
    return (
      <div className="flex justify-center py-16">
        <Spinner />
      </div>
    );
  }

  return (
    <div>
      <ModuleHeader
        sections={sections}
        action={
          section === "accesos" && canWrite && (
            <Button size="sm" onClick={() => setModal("nuevo")}>
              <Plus className="h-[15px] w-[15px]" />
              Otorgar acceso
            </Button>
          )
        }
      />

      {/* RF-P7: la instalación no puede quedarse sin ningún administrador
          activo. Se avisa donde se toma la decisión, no solo con un 409 después. */}
      {staff.isLastAdmin && (
        <div className="mb-3">
          <Alert variant="info">
            Es el único administrador activo del sistema. Hasta que exista otro, no se le puede
            quitar el perfil de administrador ni desactivar: quedarían todos fuera de la
            administración del panel.
          </Alert>
        </div>
      )}

      {section === "datos" ? (
        <DataTable>
          <tbody>
            <DetailRow label="Nombre">
              <span className="flex items-center gap-2.5">
                <Avatar name={fullName} seed={staff.id} />
                <span className="text-[13px] font-medium text-ink">{fullName}</span>
              </span>
            </DetailRow>
            <DetailRow label="Correo">{staff.email}</DetailRow>
            <DetailRow label="Extensión">{staff.phoneExt ?? "—"}</DetailRow>
            <DetailRow label="Departamento principal">
              {primary ? primary.departmentName : "—"}
            </DetailRow>
            <DetailRow label="Perfil">
              {staff.isAdmin ? <Badge tone="red">Administrador</Badge> : <Badge>Staff</Badge>}
            </DetailRow>
            <DetailRow label="Estado">
              <StatusDot active={staff.isActive} />
            </DetailRow>
            <DetailRow label="Último acceso">{formatDate(staff.lastLoginAt)}</DetailRow>
          </tbody>
        </DataTable>
      ) : (
        <>
          {staff.isAdmin && (
            <div className="mb-3">
              <Alert variant="info">
                Es administrador: tiene todos los permisos en todos los departamentos. Los accesos de
                abajo no limitan lo que puede hacer, solo indican dónde trabaja.
              </Alert>
            </div>
          )}

          {staff.accesses.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-[13.5px] text-faint">
                Todavía no tiene acceso a ningún departamento: entra al sistema pero no ve nada.
              </p>
              <div className="mt-3 flex justify-center">
                <Button size="sm" onClick={() => setModal("nuevo")}>
                  <Plus className="h-[15px] w-[15px]" />
                  Otorgar el primero
                </Button>
              </div>
            </div>
          ) : (
          <DataTable>
            <thead>
              <HeadRow>
                <Th>Departamento</Th>
                <Th>Rol</Th>
                <Th>Principal</Th>
                <Th>Otorgado por</Th>
                <Th>Desde</Th>
                <Th className="w-24 text-right">Acciones</Th>
              </HeadRow>
            </thead>

            <tbody>
              {staff.accesses.map((access) => (
                <Row key={access.departmentId}>
                  <Td className="text-[13px] font-medium text-ink">{access.departmentName}</Td>
                  <Td>
                    <Badge>{access.roleName}</Badge>
                  </Td>
                  <Td>
                    {access.isPrimary ? (
                      <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-[12.5px] font-medium text-ink">
                        <Star aria-hidden className="h-3.5 w-3.5 fill-brand-red text-brand-red" />
                        Principal
                      </span>
                    ) : !canWrite ? (
                      <span className="text-[12.5px] text-faint">—</span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => makePrimary(access)}
                        className="rounded-edge text-[12.5px] text-muted underline-offset-4 transition-colors
                          hover:text-ink hover:underline"
                      >
                        Hacer principal
                      </button>
                    )}
                  </Td>
                  <Td className="text-[12.5px] text-brand-gray">{access.grantedByName ?? "—"}</Td>
                  <Td className="text-[12.5px] text-brand-gray">{formatDate(access.grantedAt)}</Td>
                  <Td>
                    <div className="flex items-center justify-end gap-1">
                      {!canWrite && <span className="text-[12px] text-faint">—</span>}
                      {canWrite && (
                      <>
                      <RowAction
                        label={`Cambiar el rol en ${access.departmentName}`}
                        icon={Pencil}
                        onClick={() => setModal(access)}
                      />
                      <RowAction
                        label={
                          access.isPrimary
                            ? "El acceso principal no se revoca: marca otro como principal primero"
                            : `Revocar el acceso a ${access.departmentName}`
                        }
                        icon={Trash2}
                        onClick={() => askRevoke(access)}
                        disabled={access.isPrimary}
                        danger
                      />
                      </>
                      )}
                    </div>
                  </Td>
                </Row>
              ))}
            </tbody>
          </DataTable>
          )}

          <h2 className="mb-1 mt-9 font-heading text-[14px] font-bold tracking-[-0.01em] text-ink">
            Permiso efectivo
          </h2>
          <p className="mb-3 max-w-[76ch] text-[12.5px] leading-relaxed text-muted">
            Lo que esta persona puede hacer hoy, resultado de sumar los permisos de los roles que
            tiene en cada departamento. No se edita aquí: se cambia el rol arriba, o los permisos del
            rol en la matriz.
          </p>

          {effective.length === 0 ? (
            <p className="py-12 text-center text-[13.5px] text-faint">
              Sin accesos no hay permisos: hoy esta persona no puede hacer nada dentro del panel.
            </p>
          ) : (
          <DataTable>
            <thead>
              <HeadRow>
                <Th className="sm:w-[360px]">Puede</Th>
                <Th className="sm:w-[160px]">Módulo</Th>
                <Th>Dónde aplica</Th>
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
                  <Td className="text-[12.5px] text-brand-gray">{module}</Td>
                  <Td className="text-[12.5px] text-brand-gray">
                    {scope === "todos" ? (
                      <span className="inline-flex items-center gap-1.5">
                        <Badge tone="green">Todos los departamentos</Badge>
                      </span>
                    ) : (
                      departments.join(", ")
                    )}
                  </Td>
                </Row>
              ))}
            </tbody>
          </DataTable>
          )}
        </>
      )}

      {modal !== null && (
        <AccessModal
          staffName={fullName}
          access={modal === "nuevo" ? undefined : modal}
          departments={permissionsMock.departments()}
          roles={matrix.roles}
          taken={staff.accesses.map((access) => access.departmentId)}
          isFirst={staff.accesses.length === 0}
          onClose={() => setModal(null)}
          onSave={saveAccess}
        />
      )}

      {confirmation && <ConfirmDialog {...confirmation} onClose={() => setConfirmation(null)} />}
    </div>
  );
}

/** Fila de la ficha: etiqueta a la izquierda, valor a la derecha, sin tarjeta. */
function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Row>
      <Td className="w-[220px] py-3 align-middle font-heading text-[10px] font-semibold uppercase tracking-[0.08em] text-faint">
        {label}
      </Td>
      <Td className="py-3 text-[13px] text-brand-gray">{children}</Td>
    </Row>
  );
}
