import { KeyRound, Pencil, Plus, Star, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { ApiError } from "../../api/client";
import { departmentsApi } from "../../api/departments";
import { permissionsApi } from "../../api/permissions";
import { staffApi } from "../../api/staff";
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
import type {
  DepartmentAccess,
  PermissionMatrixResponse,
  StaffDetail,
} from "../../types/permissions";
import type { DepartmentResponse } from "../../types/api";
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
  const [departments, setDepartments] = useState<DepartmentResponse[]>([]);
  const [error, setError] = useState<string | null>(null);
  // Igual que en la ficha de cliente: mientras una accion sobre un acceso esta
  // en vuelo su fila se atenua y sus controles no aceptan un segundo click, que
  // es lo que provocaba dos PUT y dos recargas resolviendo en desorden.
  const [busyDepartmentId, setBusyDepartmentId] = useState<number | null>(null);

  const [modal, setModal] = useState<"nuevo" | DepartmentAccess | null>(null);
  const [confirmation, setConfirmation] = useState<Omit<ConfirmDialogProps, "onClose"> | null>(null);

  const staffId = Number(id);

  function reload() {
    return staffApi.getDepartmentAccess(staffId).then(setStaff);
  }

  /** Refresco tras una mutacion: el fallo se dice, no se pierde en la consola. */
  function reloadOrReport() {
    return reload().catch((err) => {
      setError(
        err instanceof ApiError ? err.message : "No se pudo actualizar la ficha del colaborador",
      );
    });
  }

  function load() {
    setError(null);
    return Promise.all([
      staffApi.getDepartmentAccess(staffId),
      permissionsApi.matrix(),
      departmentsApi.list(),
    ])
      .then(([detail, data, depts]) => {
        setStaff(detail);
        setMatrix(data);
        setDepartments(depts);
      })
      .catch((err) => {
        setError(
          err instanceof ApiError ? err.message : "No se pudo cargar la ficha del colaborador",
        );
      });
  }

  useEffect(() => {
    if (!id) return;
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const fullName = staff ? `${staff.firstName} ${staff.lastName}` : "";
  useDynamicBreadcrumb(staff ? fullName : null);
  const primary = staff?.accesses.find((access) => access.isPrimary) ?? null;
  const effective = staff?.effectivePermissions ?? [];

  /** RF-P2/RF-P3: el POST solo sirve para un departamento nuevo; editar uno ya
   * concedido — rol o principal — pasa por el PUT (ver seccion 6.5). */
  async function saveAccess(value: { departmentId: number; roleId: number; isPrimary: boolean }) {
    const isEdit = staff?.accesses.some((access) => access.departmentId === value.departmentId) ?? false;
    if (isEdit) {
      await staffApi.updateDepartmentAccess(staffId, value.departmentId, {
        roleId: value.roleId,
        isPrimary: value.isPrimary,
      });
    } else {
      await staffApi.grantDepartmentAccess(staffId, value);
    }
    // El refresco no viaja al diálogo: la escritura ya salió bien y decir "no se
    // pudo otorgar el acceso" por un GET fallido sería mentir sobre lo ocurrido.
    await reloadOrReport();
  }

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
          <strong className="font-semibold text-ink">{access.departmentName}</strong>. Su historial
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

  // Solo es fatal si no hay ficha que mostrar; con la ficha cargada el fallo de
  // una mutacion se dice sobre la propia pagina.
  if (error !== null && (staff === null || matrix === null)) {
    return (
      <div>
        <ModuleHeader sections={sections} />
        <div className="flex flex-col items-start gap-2">
          <Alert variant="error">{error}</Alert>
          <Button size="sm" variant="secondary" onClick={() => void load()}>
            Reintentar
          </Button>
        </div>
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

      {error !== null && (
        <div className="mb-3 flex flex-col items-start gap-2">
          <Alert variant="error">{error}</Alert>
          <Button size="sm" variant="secondary" onClick={() => void load()}>
            Reintentar
          </Button>
        </div>
      )}

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
              {canWrite && (
                <div className="mt-3 flex justify-center">
                  <Button size="sm" onClick={() => setModal("nuevo")}>
                    <Plus className="h-[15px] w-[15px]" />
                    Otorgar el primero
                  </Button>
                </div>
              )}
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
                <Row key={access.departmentId} busy={busyDepartmentId === access.departmentId}>
                  <Td className="text-[13px] font-medium text-ink">{access.departmentName}</Td>
                  <Td>
                    <Badge>{access.roleName}</Badge>
                  </Td>
                  <Td>
                    {access.isPrimary ? (
                      // Gris, no rojo: marcar el registro designado no es ni la accion
                      // primaria ni el estado activo, los dos unicos usos del 185 C.
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
                  <Td className="text-[12.5px] text-brand-gray">{formatDate(access.grantedAt)}</Td>
                  <Td>
                    <div className="flex items-center justify-end gap-1">
                      {!canWrite && <span className="text-[12.5px] text-faint">—</span>}
                      {canWrite && (
                        <>
                          <RowAction
                            label={`Cambiar el rol en ${access.departmentName}`}
                            icon={Pencil}
                            onClick={() => setModal(access)}
                            disabled={busyDepartmentId === access.departmentId}
                          />
                          <RowAction
                            label={
                              access.isPrimary
                                ? "El acceso principal no se revoca: marca otro como principal primero"
                                : `Revocar el acceso a ${access.departmentName}`
                            }
                            icon={Trash2}
                            onClick={() => askRevoke(access)}
                            disabled={access.isPrimary || busyDepartmentId === access.departmentId}
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

          {/* Cabecera de grupo, no un titulo de pagina: la rampa solo tiene
              versalita de 10 px para nombrar un bloque dentro de una vista. */}
          <h2 className="mb-1 mt-9 font-heading text-[10px] font-semibold uppercase tracking-[0.08em] text-faint">
            Permiso efectivo
          </h2>
          <p className="mb-3 max-w-[76ch] text-[12.5px] leading-relaxed text-muted">
            Lo que esta persona puede hacer hoy, resultado de sumar los permisos de los roles que
            tiene en cada departamento. No se edita aquí: se cambia el rol arriba, o los permisos del
            rol en la matriz.
          </p>

          {effective.length === 0 ? (
            // Una lista derivada se queda vacia por dos motivos distintos, y la
            // accion que corresponde a cada uno tambien lo es: otorgar un acceso,
            // o revisar los permisos de los roles ya otorgados.
            <p className="py-12 text-center text-[13.5px] text-faint">
              {staff.accesses.length === 0
                ? "Sin accesos no hay permisos: hoy esta persona no puede hacer nada dentro del panel."
                : "Tiene accesos, pero ninguno de sus roles concede todavía un permiso: revisa esos roles en la matriz."}
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
          departments={departments}
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

/**
 * Fila de la ficha: etiqueta a la izquierda, valor a la derecha, sin tarjeta.
 * La etiqueta es la cabecera de su fila, no una celda mas: sin `th scope="row"`
 * un lector de pantalla recita los valores sin decir de que son.
 */
function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Row>
      <th
        scope="row"
        className="w-[220px] py-3 pl-0 pr-3.5 text-left align-middle font-heading text-[10px] font-semibold uppercase tracking-[0.08em] text-faint"
      >
        {label}
      </th>
      <Td className="py-3 text-[13px] text-brand-gray">{children}</Td>
    </Row>
  );
}
