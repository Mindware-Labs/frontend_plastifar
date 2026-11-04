import { claimsApi } from "../../api/claims";
import { discrepanciesApi } from "../../api/discrepancies";
import { qualityApi } from "../../api/quality";
import { withdrawalsApi } from "../../api/withdrawals";
import { ClaimDocumentSheet } from "../../components/claims/ClaimDocumentSheet";
import { DiscrepancyDocumentSheet } from "../../components/discrepancies/DiscrepancyDocumentSheet";
import { HcaDocumentSheet } from "../../components/quality/HcaDocumentSheet";
import { Skeleton } from "../../components/ui/Skeleton";
import { usePrintRecord } from "../../components/print/usePrintRecord";
import { WithdrawalDocumentSheet } from "../../components/withdrawals/WithdrawalDocumentSheet";
import { CLAIM_FORM_CONTROL } from "../../lib/claims";
import { DISCREPANCY_FORM_CONTROL } from "../../lib/discrepancies";
import { WITHDRAWAL_FORM_CONTROL } from "../../lib/withdrawals";
import type { CustomerClaim } from "../../types/claims";
import type { DiscrepancyDetail } from "../../types/discrepancies";
import type { CorrectiveActionSheet } from "../../types/quality";
import type { MerchandiseWithdrawal } from "../../types/withdrawals";
import type { RegisteredFormItem } from "./TicketFormsTab";

interface TicketFormDocumentViewProps {
  form: RegisteredFormItem;
  onBack: () => void;
}

/** Marcador mientras se recarga el registro: hoja en blanco con el mismo ancho que el documento. */
function DocumentPending({ error }: { error: string | null }) {
  if (error) return <p className="p-8 text-[13px] text-red-700">{error}</p>;

  return (
    <div className="min-h-0 flex-1 overflow-hidden p-4 sm:p-6" role="status" aria-label="Cargando documento">
      <div className="mb-4 flex items-center justify-between gap-3">
        <Skeleton className="h-8 w-24" />
        <div className="flex gap-2">
          <Skeleton className="h-8 w-24" />
          <Skeleton className="h-8 w-24" />
          <Skeleton className="h-8 w-24" />
        </div>
      </div>
      <div className="mx-auto w-full max-w-[860px] space-y-4 rounded-lg border border-line bg-white p-6 shadow-2xs">
        <div className="flex items-center justify-between gap-4">
          <Skeleton className="h-12 w-32" />
          <Skeleton className="h-6 w-56" />
          <Skeleton className="h-12 w-32" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          {Array.from({ length: 8 }, (_, i) => (
            <Skeleton key={i} className="h-8 w-full" delay={i * 60} />
          ))}
        </div>
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
        <div className="grid grid-cols-3 gap-3">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      </div>
    </div>
  );
}
function TicketClaimDocument({ claimId, onBack }: { claimId: number; onBack: () => void }) {
  const { data: claim, error } = usePrintRecord(
    claimId,
    async (id) => (await claimsApi.get(id)).claim,
    {
      documentTitle: (record) => `${CLAIM_FORM_CONTROL.code} · ${record.ticketNumber}`,
      failed: "No se pudo cargar la reclamación.",
    },
  );

  if (claim === null) return <DocumentPending error={error} />;

  return <ClaimDocumentSheet claim={claim} onBack={onBack} backLabel="Volver al ticket" />;
}

function TicketWithdrawalDocument({ withdrawalId, onBack }: { withdrawalId: number; onBack: () => void }) {
  const { data: detail, error } = usePrintRecord(
    withdrawalId,
    (id) => withdrawalsApi.get(id),
    {
      documentTitle: (record) => `${WITHDRAWAL_FORM_CONTROL.code} · ${record.withdrawal.number}`,
      failed: "No se pudo cargar la solicitud de retiro.",
    },
  );

  if (detail === null) return <DocumentPending error={error} />;

  return (
    <WithdrawalDocumentSheet withdrawal={detail.withdrawal} onBack={onBack} backLabel="Volver al ticket" />
  );
}

function TicketDiscrepancyDocument({ discrepancyId, onBack }: { discrepancyId: number; onBack: () => void }) {
  const { data: discrepancy, error } = usePrintRecord(
    discrepancyId,
    async (id) => (await discrepanciesApi.get(id)).discrepancy,
    {
      documentTitle: (record) => `${DISCREPANCY_FORM_CONTROL.code} · ${record.number}`,
      failed: "No se pudo cargar la investigación.",
    },
  );

  if (discrepancy === null) return <DocumentPending error={error} />;

  return <DiscrepancyDocumentSheet discrepancy={discrepancy} onBack={onBack} backLabel="Volver al ticket" />;
}

function TicketHcaDocument({ sheetId, onBack }: { sheetId: number; onBack: () => void }) {
  const { data: detail, error } = usePrintRecord(sheetId, qualityApi.sheets.get, {
    documentTitle: (record) => `PF-FOR-109 · ${record.sheet.number}`,
    failed: "No se pudo cargar la HCA.",
  });

  if (detail === null) return <DocumentPending error={error} />;

  return (
    <HcaDocumentSheet
      sheet={detail.sheet}
      planItems={detail.planItems}
      onBack={onBack}
      backLabel="Volver al ticket"
    />
  );
}

/** Documento oficial incrustado en el ticket: recarga el registro completo antes de pintar. */
export function TicketFormDocumentView({ form, onBack }: TicketFormDocumentViewProps) {
  switch (form.type) {
    case "reclamacion":
      return <TicketClaimDocument claimId={(form.data as CustomerClaim).id} onBack={onBack} />;
    case "retiro":
      return <TicketWithdrawalDocument withdrawalId={(form.data as MerchandiseWithdrawal).id} onBack={onBack} />;
    case "discrepancia":
      return (
        <TicketDiscrepancyDocument
          discrepancyId={(form.data as DiscrepancyDetail).discrepancy.id}
          onBack={onBack}
        />
      );
    case "hca":
      return <TicketHcaDocument sheetId={(form.data as CorrectiveActionSheet).id} onBack={onBack} />;
    default:
      return <DocumentPending error="Tipo de formulario no soportado para vista de documento." />;
  }
}
