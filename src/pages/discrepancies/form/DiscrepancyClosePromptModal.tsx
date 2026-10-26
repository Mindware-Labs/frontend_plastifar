import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { Button } from "../../../components/ui/Button";
import { SelectField, TextField } from "../../../components/ui/Field";
import { Modal } from "../../../components/ui/Modal";
import type { DiscrepancyDetail } from "../../../types/discrepancies";

interface DiscrepancyClosePromptModalProps {
  completedDiscrepancy: DiscrepancyDetail;
  verdicts: Array<{ id: number; name: string }>;
  selectedVerdictId: string;
  setSelectedVerdictId: (id: string) => void;
  closeReason: string;
  setCloseReason: (reason: string) => void;
  closingTicket: boolean;
  /** Termina sin tocar el ticket. */
  onKeepOpen: () => void;
  /** Cierra el ticket como solucionado y termina. */
  onCloseTicket: () => Promise<void>;
}

/** Pregunta si se cierra el ticket al completar la investigacion. */
export function DiscrepancyClosePromptModal({
  completedDiscrepancy,
  verdicts,
  selectedVerdictId,
  setSelectedVerdictId,
  closeReason,
  setCloseReason,
  closingTicket,
  onKeepOpen,
  onCloseTicket,
}: DiscrepancyClosePromptModalProps) {
  return (
    <Modal
      title="¿Deseas cerrar este ticket ahora?"
      eyebrow="PF-FOR-291 · Resolución de Caso"
      onClose={onKeepOpen}
      maxWidth="max-w-md"
      closeOnBackdropClick={false}
      footer={
        <div className="flex items-center justify-end gap-2 w-full">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={onKeepOpen}
          >
            Mantener ticket abierto
          </Button>
          <Button
            type="button"
            variant="primary"
            size="sm"
            disabled={closingTicket}
            onClick={onCloseTicket}
          >
            <CheckCircle2 className="size-3.5 mr-1" />
            {closingTicket ? "Cerrando..." : "Sí, cerrar ticket"}
          </Button>
        </div>
      }
    >
      <div className="space-y-3.5 py-1 text-left">
        <div className="rounded-xl border border-zinc-200 bg-zinc-50/80 p-3.5">
          <p className="text-xs text-zinc-700 leading-relaxed">
            La investigación de discrepancia <strong className="font-semibold text-zinc-900 font-mono">{completedDiscrepancy.discrepancy.number}</strong> ha sido registrada exitosamente.
          </p>
          <p className="mt-1.5 text-xs text-zinc-500 leading-relaxed">
            Puedes dar por resuelto y cerrar este ticket indicando el veredicto oficial.
          </p>
        </div>

        {verdicts.length > 0 && (
          <SelectField
            size="sm"
            label="Veredicto de resolución"
            required
            value={selectedVerdictId}
            onChange={setSelectedVerdictId}
            options={verdicts.map((v) => ({
              value: String(v.id),
              label: v.name,
            }))}
          />
        )}

        <TextField
          size="sm"
          label="Comentario de cierre"
          required
          value={closeReason}
          onChange={(e) => setCloseReason(e.target.value)}
          placeholder="Motivo o comentario de resolución..."
        />

        {completedDiscrepancy.discrepancy.hasSecurityFinding && (
          <div className="rounded-lg border border-amber-200 bg-amber-50/70 p-3 text-xs text-amber-900 flex items-start gap-2">
            <AlertTriangle className="size-4 text-amber-600 shrink-0 mt-0.5" />
            <span>
              <strong>Atención:</strong> Esta discrepancia contiene un hallazgo de seguridad positivo reportado al área de Seguridad y Logística.
            </span>
          </div>
        )}
      </div>
    </Modal>
  );
}
