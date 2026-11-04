import {
  ArrowRight,
  Briefcase,
  Building2,
  Clock,
  History,
  KeyRound,
  Mail,
  Phone,
  ShieldCheck,
  Star,
  UserRound,
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { Avatar } from "../../components/ui/Avatar";
import { Badge } from "../../components/ui/Badge";
import { CopyButton } from "../../components/ui/CopyButton";
import { DetailCard } from "../../components/ui/DetailCard";
import { StatTile } from "../../components/ui/StatTile";
import { StatusDot } from "../../components/ui/StatusDot";
import type { DepartmentAccess, StaffDetail } from "../../types/permissions";
import { AlignedClampBody } from "../tickets/detail/AlignedClampBody";

/** Tarjeta de la columna derecha que marca hasta dónde baja la lista de accesos. */
const PERMISSIONS_CARD_ID = "staff-permissions-summary-card";

interface StaffOverviewProps {
  staff: StaffDetail;
  fullName: string;
  /** Rotula un acceso con el camino del departamento cuando se conoce. */
  departmentLabel: (access: DepartmentAccess) => string;
  formatDate: (value: string | null) => string;
  /** Ruta de la pestaña «Accesos», destino de los atajos del resumen. */
  accessesTo: string;
}

const rowClass = "flex items-center justify-between gap-3 py-2 text-[12.5px]";
const rowLabelClass = "shrink-0 font-medium text-zinc-500";

/**
 * Métricas compactas de la ficha. Viven por encima de las pestañas: al pasar de
 * «Datos» a «Accesos» se quedan quietas y solo cambia lo de debajo, así el
 * cambio se lee como una misma ficha y no como dos páginas.
 */
export function StaffKpiTiles({
  staff,
  departmentLabel,
  formatDate,
}: Pick<StaffOverviewProps, "staff" | "departmentLabel" | "formatDate">) {
  const primary = staff.accesses.find((access) => access.isPrimary) ?? null;

  return (
    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <StatTile
          label="Estado"
          indicator={
            <span
              aria-hidden
              className={`h-2 w-2 rounded-full ${staff.isActive ? "bg-emerald-500" : "bg-zinc-400"}`}
            />
          }
        >
          <div className="mt-1 flex items-baseline gap-2">
            <span className="truncate font-heading text-[15px] font-bold text-zinc-900">
              {staff.isActive ? "Activo" : "Inactivo"}
            </span>
            {!staff.isActive && (
              <span className="truncate text-[11px] font-medium text-zinc-500">Sin acceso al panel</span>
            )}
          </div>
        </StatTile>

        <StatTile label="Perfil" indicator={<ShieldCheck className="h-3.5 w-3.5 text-zinc-400" />}>
          <div className="mt-1 flex items-center justify-between gap-2">
            {staff.isAdmin ? <Badge tone="red">Administrador</Badge> : <Badge>Staff</Badge>}
            {staff.isLastAdmin && (
              <span className="truncate text-[11px] font-medium text-amber-600">Único admin</span>
            )}
          </div>
        </StatTile>

        <StatTile label="Departamentos" indicator={<Building2 className="h-3.5 w-3.5 text-zinc-400" />}>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="font-heading text-[15px] font-bold tabular-nums text-zinc-900">
              {staff.accesses.length}
            </span>
            <span
              className="truncate text-[11px] font-medium text-zinc-500"
              title={primary ? departmentLabel(primary) : undefined}
            >
              {primary ? primary.departmentName : "Sin principal"}
            </span>
          </div>
        </StatTile>

        <StatTile label="Último acceso" indicator={<Clock className="h-3.5 w-3.5 text-zinc-400" />}>
          <div className="mt-1 flex items-baseline gap-2">
            {staff.lastLoginAt ? (
              <span className="truncate font-heading text-[15px] font-bold tabular-nums text-zinc-900">
                {formatDate(staff.lastLoginAt)}
              </span>
            ) : (
              <span className="font-heading text-[13.5px] font-bold italic text-amber-600">Nunca</span>
            )}
          </div>
        </StatTile>
    </div>
  );
}

/**
 * Pestaña «Datos»: la grilla 2/3 + 1/3 de tarjetas con cabecera gris, con el
 * mismo lenguaje que el resumen de la ficha de un ticket.
 */
export function StaffOverview({ staff, fullName, departmentLabel, formatDate, accessesTo }: StaffOverviewProps) {
  const navigate = useNavigate();
  const primary = staff.accesses.find((access) => access.isPrimary) ?? null;
  const effective = staff.effectivePermissions;
  const modules = new Set(effective.map((item) => item.module)).size;
  // Los accesos se listan con el principal primero: es el que define el puesto.
  const accesses = [...staff.accesses].sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary));

  return (
    <div className="space-y-3.5">
      <StaffKpiTiles staff={staff} departmentLabel={departmentLabel} formatDate={formatDate} />

      {/* Grilla principal (2/3 + 1/3) */}
      <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-3">
        {/* Columna izquierda */}
        <div className="space-y-3.5 lg:col-span-2">
          <DetailCard icon={UserRound} title="Datos personales">
            <div className="flex items-center gap-3 border-b border-zinc-100 px-4 py-3">
              <Avatar name={fullName} seed={staff.id} size={36} />
              <div className="min-w-0">
                <span className="block truncate text-[14px] font-bold leading-tight text-zinc-900" title={fullName}>
                  {fullName}
                </span>
                <span className="mt-0.5 block truncate text-[12px] text-zinc-500">
                  {primary ? `${primary.roleName} · ${primary.departmentName}` : "Sin departamento principal"}
                </span>
              </div>
            </div>

            <div className="divide-y divide-zinc-100 px-4 py-1">
              <div className={rowClass}>
                <span className={`${rowLabelClass} flex items-center gap-1.5`}>
                  <Mail className="size-3 text-zinc-400" />
                  Correo
                </span>
                <div className="flex min-w-0 max-w-[70%] items-center gap-1.5">
                  <a
                    href={`mailto:${staff.email}`}
                    title={staff.email}
                    className="truncate font-medium text-zinc-900 hover:text-brand-red"
                  >
                    {staff.email}
                  </a>
                  <CopyButton text={staff.email} label="Copiar correo" className="cursor-pointer" />
                </div>
              </div>

              <div className={rowClass}>
                <span className={`${rowLabelClass} flex items-center gap-1.5`}>
                  <Phone className="size-3 text-zinc-400" />
                  Extensión
                </span>
                {staff.phoneExt ? (
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono font-semibold tabular-nums text-zinc-800">{staff.phoneExt}</span>
                    <CopyButton text={staff.phoneExt} label="Copiar extensión" className="cursor-pointer" />
                  </div>
                ) : (
                  <span className="text-zinc-400">Sin extensión</span>
                )}
              </div>

              {/* RF-O9: solo cuando existe. Es un dato heredado para emparejar la
                  carga, no un usuario con el que se inicie sesión. */}
              {staff.legacyUsername && (
                <div className={rowClass}>
                  <span className={rowLabelClass}>Usuario anterior</span>
                  <span className="font-mono text-[12px] text-zinc-800">{staff.legacyUsername}</span>
                </div>
              )}
            </div>
          </DetailCard>

          <DetailCard
            icon={Building2}
            title={`Departamentos con acceso (${staff.accesses.length})`}
            aside={
              <Link
                to={accessesTo}
                className="inline-flex items-center gap-1 text-[11.5px] font-medium text-brand-red hover:underline"
              >
                Ver accesos
                <ArrowRight className="size-3" />
              </Link>
            }
          >
            {accesses.length === 0 ? (
              <p className="px-4 py-6 text-center text-[12.5px] italic text-zinc-400">
                Todavía no tiene acceso a ningún departamento: entra al sistema pero no ve nada.
              </p>
            ) : (
              /* Como la descripción del caso en la ficha de ticket: la lista no
                 baja más que la columna derecha; si no cabe, se recorta y el
                 aviso lleva a «Accesos», donde están todos. */
              <AlignedClampBody
                alignToId={PERMISSIONS_CARD_ID}
                onExpand={() => navigate(accessesTo)}
                label={`Haz clic para ver los ${accesses.length} accesos`}
                innerClassName="px-4 py-1"
              >
                <div className="divide-y divide-zinc-100">
                {accesses.map((access) => (
                  <div key={access.departmentId} className="flex items-center justify-between gap-3 py-2">
                    <div className="flex min-w-0 items-center gap-2.5">
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
                      <div className="min-w-0">
                        <span
                          className="block truncate text-[12.5px] font-medium text-zinc-800"
                          title={departmentLabel(access)}
                        >
                          {departmentLabel(access)}
                        </span>
                        <span className="block text-[11px] text-zinc-400">
                          {access.isPrimary ? "Principal · " : ""}Desde {formatDate(access.grantedAt)}
                        </span>
                      </div>
                    </div>
                    <Badge>{access.roleName}</Badge>
                  </div>
                ))}
                </div>
              </AlignedClampBody>
            )}
          </DetailCard>
        </div>

        {/* Columna derecha */}
        <div className="space-y-3.5">
          <DetailCard icon={Briefcase} title="Puesto">
            <div className="divide-y divide-zinc-100 px-4 py-1">
              <div className={rowClass}>
                <span className={rowLabelClass}>Departamento</span>
                <span
                  className="max-w-[65%] truncate text-right font-medium text-zinc-800"
                  title={primary ? departmentLabel(primary) : undefined}
                >
                  {primary ? departmentLabel(primary) : <span className="text-zinc-400">—</span>}
                </span>
              </div>
              <div className={rowClass}>
                <span className={rowLabelClass}>Rol</span>
                <span className="max-w-[65%] truncate text-right font-medium text-zinc-800">
                  {primary?.roleName ?? <span className="text-zinc-400">—</span>}
                </span>
              </div>
              <div className={rowClass}>
                <span className={rowLabelClass}>Perfil</span>
                {staff.isAdmin ? <Badge tone="red">Administrador</Badge> : <Badge>Staff</Badge>}
              </div>
            </div>
          </DetailCard>

          <DetailCard icon={KeyRound} title="Cuenta" aside={<StatusDot active={staff.isActive} />}>
            <div className="divide-y divide-zinc-100 px-4 py-1">
              <div className={rowClass}>
                <span className={rowLabelClass}>Estado</span>
                <span className={`font-medium ${staff.isActive ? "text-emerald-700" : "text-zinc-500"}`}>
                  {staff.isActive ? "Puede entrar al panel" : "Desactivado"}
                </span>
              </div>
              <div className={rowClass}>
                <span className={rowLabelClass}>Último acceso</span>
                <span className="font-medium tabular-nums text-zinc-800">
                  {staff.lastLoginAt ? formatDate(staff.lastLoginAt) : <span className="text-zinc-400">Nunca</span>}
                </span>
              </div>
            </div>
          </DetailCard>

          <DetailCard id={PERMISSIONS_CARD_ID} icon={ShieldCheck} title="Resumen de permisos">
            <div className="space-y-2.5 p-3.5">
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: "Permisos", value: effective.length },
                  { label: "Módulos", value: modules },
                  { label: "Deptos.", value: staff.accesses.length },
                ].map((stat) => (
                  <Link
                    key={stat.label}
                    to={accessesTo}
                    className="group rounded-lg border border-zinc-200/80 bg-zinc-50/60 p-2 text-left outline-none transition-colors hover:border-zinc-300 hover:bg-zinc-100/70 focus-visible:ring-2 focus-visible:ring-brand-red/25"
                  >
                    <span className="block font-heading text-[10px] font-semibold uppercase tracking-wider text-zinc-400 group-hover:text-zinc-600">
                      {stat.label}
                    </span>
                    <span className="font-heading text-[16px] font-bold tabular-nums text-zinc-900">
                      {stat.value}
                    </span>
                  </Link>
                ))}
              </div>
              <p className="text-[11.5px] leading-relaxed text-zinc-500">
                {staff.isAdmin
                  ? "Es administrador: tiene todos los permisos en todos los departamentos."
                  : effective.length === 0
                    ? "Hoy no puede hacer nada dentro del panel."
                    : "Suma de los permisos de los roles que tiene en cada departamento."}
              </p>

              <Link
                to={`/staff/${staff.id}/actividad`}
                className="flex w-full items-center justify-between rounded-lg border border-zinc-200/80 bg-zinc-50/60 px-3 py-2 text-[12px] font-medium text-zinc-700 transition-colors hover:border-zinc-300 hover:bg-zinc-100/70"
              >
                <span className="flex items-center gap-1.5">
                  <History className="size-3.5 text-zinc-500" />
                  <span>Ver historial de actividad</span>
                </span>
                <ArrowRight className="size-3 text-zinc-400" />
              </Link>
            </div>
          </DetailCard>
        </div>
      </div>
    </div>
  );
}
