import { Button } from "../ui/Button";
import { Modal } from "../ui/Modal";

interface EnterpriseFormSaveDraftConfirmModalProps {
  open: boolean;
  formCode: string;
  ticketLabel?: string;
  onClose: () => void;
  onConfirm: () => void;
}

/** Confirmación dentro del asistente antes de persistir el borrador local. */
export function EnterpriseFormSaveDraftConfirmModal({
  open,
  formCode,
  ticketLabel,
  onClose,
  onConfirm,
}: EnterpriseFormSaveDraftConfirmModalProps) {
  if (!open) return null;

  return (
    <Modal
      title="¿Guardar borrador?"
      eyebrow={ticketLabel ? `${formCode} · ${ticketLabel}` : formCode}
      onClose={onClose}
      maxWidth="max-w-md"
      footer={
        <div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end">
          <Button type="button" variant="secondary" size="sm" onClick={onClose}>
            Seguir editando
          </Button>
          <Button type="button" size="sm" onClick={onConfirm}>
            Guardar borrador
          </Button>
        </div>
      }
    >
      <p className="text-[13px] leading-relaxed text-zinc-600">
        Los datos en progreso se guardarán en este navegador para retomarlos después desde la pestaña
        Formularios del ticket. No sustituye al registro oficial hasta que emitas el documento.
      </p>
    </Modal>
  );
}
