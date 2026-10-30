import { CheckCircle2 } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { ApiError } from "../../api/client";
import { ticketsApi } from "../../api/tickets";
import { ticketVerdictsApi } from "../../api/ticketVerdicts";
import { useReceipts } from "../../context/useReceipts";
import { autoResizeTextarea } from "../../lib/autoResizeTextarea";
import { Button } from "../ui/Button";
import { SelectField, TextAreaField } from "../ui/Field";
import { Modal } from "../ui/Modal";

export interface EnterpriseFormCloseTicketModalProps {
  open: boolean;
  ticketId: number;
  formCode: string;
  recordNumber: string;
  descriptionText?: string;
  defaultReason?: string;
  extraAlert?: ReactNode;
  receiptTitle?: string;
  receiptDetail?: string;
  onClose: () => void;
  onSuccess: () => void;
  onTicketStatusChanged?: () => void;
}

/**
 * Modal unificado de recomendación para resolver y cerrar el ticket
 * tras completar cualquier formulario empresarial (HCA, Discrepancias,
 * Reclamaciones de clientes, Solicitud de retiro de mercancía).
 */
export function EnterpriseFormCloseTicketModal({
  open,
  ticketId,
  formCode,
  recordNumber,
  descriptionText = "El formulario ha sido registrado exitosamente. Puedes dar por concluido y cerrar este ticket indicando el veredicto oficial y el comentario de resolución.",
  defaultReason,
  extraAlert,
  receiptTitle = "Ticket cerrado y solucionado",
  receiptDetail,
  onClose,
  onSuccess,
  onTicketStatusChanged,
}: EnterpriseFormCloseTicketModalProps) {
  const receipts = useReceipts();
  const [closing, setClosing] = useState(false);
  const [verdicts, setVerdicts] = useState<Array<{ id: number; name: string }>>([]);
  const [selectedVerdictId, setSelectedVerdictId] = useState<string>("");
  const [closeReason, setCloseReason] = useState<string>("");
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const initialReason =
    defaultReason ||
    `Cerrado tras completar ${recordNumber}`;

  useEffect(() => {
    if (!open) return;

    setCloseReason(initialReason);
    requestAnimationFrame(() => {
      if (textareaRef.current) {
        autoResizeTextarea(textareaRef.current, 52);
      }
    });

    ticketVerdictsApi
      .list({ page: 1, pageSize: 100, status: "activos" })
      .then((res) => {
        const active = res.items.map((v) => ({ id: v.id, name: v.name }));
        setVerdicts(active);
        if (active.length > 0) {
          setSelectedVerdictId(String(active[0].id));
        }
      })
      .catch(() => setVerdicts([]));
  }, [open, initialReason]);

  if (!open) return null;

  const handleConfirmClose = async () => {
    if (ticketId <= 0) {
      onClose();
      return;
    }

    setClosing(true);
    try {
      const finalVerdictId = selectedVerdictId
        ? Number(selectedVerdictId)
        : verdicts.length > 0
        ? verdicts[0].id
        : undefined;

      await ticketsApi.updateStatus(ticketId, {
        status: "Solucionado",
        verdictId: finalVerdictId,
        reason: closeReason.trim() || initialReason,
      });

      receipts.done({
        action: "cerrar-ticket",
        title: receiptTitle,
        detail:
          receiptDetail ||
          `El ticket ha sido marcado como solucionado en base a ${recordNumber}.`,
      });

      onTicketStatusChanged?.();
      onSuccess();
    } catch (err) {
      receipts.failed({
        action: "error-cerrar-ticket",
        title: "No se pudo cerrar el ticket",
        detail:
          err instanceof ApiError ? err.message : "Error al actualizar estado del ticket",
      });
    } finally {
      setClosing(false);
      onClose();
    }
  };

  return (
    <Modal
      title="¿Deseas cerrar este ticket ahora?"
      eyebrow={`${formCode} · Resolución de caso`}
      onClose={onClose}
      maxWidth="max-w-xl"
      closeOnBackdropClick={false}
      footer={
        <div className="flex w-full items-center justify-end gap-2.5">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={onClose}
          >
            Mantener ticket abierto
          </Button>
          <Button
            type="button"
            variant="primary"
            size="sm"
            disabled={closing || ticketId <= 0}
            onClick={handleConfirmClose}
          >
            <CheckCircle2 className="mr-1.5 size-4" />
            {closing ? "Cerrando..." : "Sí, cerrar ticket"}
          </Button>
        </div>
      }
    >
      <div className="-mt-1 space-y-4 text-left">
        <div className="rounded-xl border border-zinc-200/90 bg-zinc-50/70 p-4">
          <div className="flex items-start gap-3.5">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600">
              <CheckCircle2 className="size-5" />
            </div>
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <h4 className="font-heading text-sm font-bold tracking-tight text-zinc-900">
                {recordNumber}
              </h4>
              <p className="text-xs leading-relaxed text-zinc-600">
                {descriptionText}
              </p>
            </div>
          </div>
        </div>

        {verdicts.length > 0 && (
          <SelectField
            size="sm"
            label="Veredicto de resolución"
            required
            searchable
            value={selectedVerdictId}
            onChange={setSelectedVerdictId}
            options={verdicts.map((v) => ({
              value: String(v.id),
              label: v.name,
            }))}
          />
        )}

        <TextAreaField
          label="Comentario de cierre"
          required
          rows={1}
          className="min-h-[52px] resize-none overflow-hidden text-[13px] leading-relaxed break-words [overflow-wrap:anywhere]"
          value={closeReason}
          onChange={(e) => {
            setCloseReason(e.target.value);
            autoResizeTextarea(e.target, 52);
          }}
          ref={(el) => {
            textareaRef.current = el;
            if (el) autoResizeTextarea(el, 52);
          }}
          placeholder="Motivo o comentario de resolución..."
        />

        {extraAlert}
      </div>
    </Modal>
  );
}
