import { ArrowLeftRight, ArrowUpRight, Pencil, Printer } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "../../../components/ui/Button";
import type { CustomerClaim } from "../../../types/claims";
import type { DiscrepancyDetail } from "../../../types/discrepancies";
import type { CorrectiveActionSheet } from "../../../types/quality";
import type { MerchandiseWithdrawal } from "../../../types/withdrawals";
import { ClaimStatusBadge } from "../../claims/ClaimStatusBadge";
import { DiscrepancyStatusBadge } from "../../discrepancies/DiscrepancyStatusBadge";
import { HcaStatusBadge } from "../../quality/StatusBadges";
import { WithdrawalStatusBadge } from "../../withdrawals/WithdrawalStatusBadge";
import type { RegisteredForm } from "./ticketForms";

interface ActiveFormHeaderProps {
  activeForm: RegisteredForm;
  ticketNumber: string;
  onEdit: () => void;
  onMigrate: () => void;
}

/** Cabecera del formulario activo: codigo, estado y acciones (imprimir, editar, cambiar, ficha). */
export function ActiveFormHeader({ activeForm, ticketNumber, onEdit, onMigrate }: ActiveFormHeaderProps) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-zinc-100 pb-4">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-heading text-[11px] font-bold uppercase tracking-wider text-brand-red bg-brand-red/10 px-2 py-0.5 rounded">
            {activeForm.code}
          </span>
          <h3 className="text-sm font-semibold text-zinc-900">{activeForm.title}</h3>

          {activeForm.type === "reclamacion" && (
            <ClaimStatusBadge status={(activeForm.data as CustomerClaim).status} />
          )}
          {activeForm.type === "retiro" && (
            <WithdrawalStatusBadge status={(activeForm.data as MerchandiseWithdrawal).status} />
          )}
          {activeForm.type === "discrepancia" && (
            <DiscrepancyStatusBadge
              status={(activeForm.data as DiscrepancyDetail).discrepancy.status}
            />
          )}
          {activeForm.type === "hca" && (
            <HcaStatusBadge status={(activeForm.data as CorrectiveActionSheet).status} />
          )}
        </div>
        <p className="mt-1 text-xs text-zinc-500">
          Formulario empresarial vinculado a {ticketNumber} · Plastifar S.A.
        </p>
      </div>

      {/* Form Actions (Print, Edit, Switch, Link) */}
      <div className="flex flex-wrap items-center gap-1.5">
        {/* Official Print Button */}
        <Button
          size="sm"
          variant="secondary"
          onClick={() => {
            let printPath = "";
            if (activeForm.type === "reclamacion") {
              printPath = `/reclamaciones/${(activeForm.data as CustomerClaim).id}/imprimir`;
            } else if (activeForm.type === "retiro") {
              printPath = `/retiros/${(activeForm.data as MerchandiseWithdrawal).id}/imprimir`;
            } else if (activeForm.type === "discrepancia") {
              printPath = `/discrepancias/${(activeForm.data as DiscrepancyDetail).discrepancy.id}/imprimir`;
            } else if (activeForm.type === "hca") {
              printPath = `/calidad/hca/${(activeForm.data as CorrectiveActionSheet).id}/imprimir`;
            }
            if (printPath) window.open(printPath, "_blank");
          }}
          title="Exportar o imprimir con el formato y cabecera oficial de Plastifar"
        >
          <Printer className="size-3.5 text-zinc-500" />
          Imprimir formato oficial
        </Button>

        {/* Edit Form Button */}
        <Button
          size="sm"
          variant="secondary"
          onClick={onEdit}
          title="Editar datos del formulario"
        >
          <Pencil className="size-3.5 text-zinc-500" />
          Editar
        </Button>

        {/* Switch / Migrate Form Button */}
        <Button
          size="sm"
          variant="secondary"
          className="text-amber-800 border-amber-200 bg-amber-50 hover:bg-amber-100"
          onClick={onMigrate}
          title="Cambiar o transferir datos a otro tipo de formulario"
        >
          <ArrowLeftRight className="size-3.5 text-amber-600" />
          Cambiar de formulario
        </Button>

        {/* View Details Link */}
        <Link
          to={
            activeForm.type === "reclamacion"
              ? `/reclamaciones/${(activeForm.data as CustomerClaim).id}`
              : activeForm.type === "retiro"
              ? `/retiros/${(activeForm.data as MerchandiseWithdrawal).id}`
              : activeForm.type === "discrepancia"
              ? `/discrepancias/${(activeForm.data as DiscrepancyDetail).discrepancy.id}`
              : `/calidad/hca/${(activeForm.data as CorrectiveActionSheet).id}`
          }
          className="inline-flex h-8 items-center gap-1.5 rounded-md border border-zinc-200 bg-white px-2.5 text-xs font-medium text-zinc-700 shadow-2xs hover:bg-zinc-50"
        >
          Ficha
          <ArrowUpRight className="size-3.5" />
        </Link>
      </div>
    </div>
  );
}
