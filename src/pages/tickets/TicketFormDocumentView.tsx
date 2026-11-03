import { claimsApi } from "../../api/claims";
import { discrepanciesApi } from "../../api/discrepancies";
import { qualityApi } from "../../api/quality";
import { withdrawalsApi } from "../../api/withdrawals";
import { ClaimDocumentSheet } from "../../components/claims/ClaimDocumentSheet";
import { DiscrepancyDocumentSheet } from "../../components/discrepancies/DiscrepancyDocumentSheet";
import { HcaDocumentSheet } from "../../components/quality/HcaDocumentSheet";
import { PrintPending } from "../../components/print/PrintSheet";
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

function TicketClaimDocument({ claimId, onBack }: { claimId: number; onBack: () => void }) {
  const { data: claim, error } = usePrintRecord(
    claimId,
    async (id) => (await claimsApi.get(id)).claim,
    {
      documentTitle: (record) => `${CLAIM_FORM_CONTROL.code} · ${record.ticketNumber}`,
      failed: "No se pudo cargar la reclamación.",
    },
  );

  if (claim === null) return <PrintPending error={error} />;

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

  if (detail === null) return <PrintPending error={error} />;

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

  if (discrepancy === null) return <PrintPending error={error} />;

  return <DiscrepancyDocumentSheet discrepancy={discrepancy} onBack={onBack} backLabel="Volver al ticket" />;
}

function TicketHcaDocument({ sheetId, onBack }: { sheetId: number; onBack: () => void }) {
  const { data: detail, error } = usePrintRecord(sheetId, qualityApi.sheets.get, {
    documentTitle: (record) => `PF-FOR-109 · ${record.sheet.number}`,
    failed: "No se pudo cargar la HCA.",
  });

  if (detail === null) return <PrintPending error={error} />;

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
      return <PrintPending error="Tipo de formulario no soportado para vista de documento." />;
  }
}
