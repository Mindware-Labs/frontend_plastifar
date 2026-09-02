import { AlertTriangle } from "lucide-react";
import { useState, type ComponentType, type ReactNode } from "react";
import { Alert } from "./Alert";
import { Button } from "./Button";
import { Modal } from "./Modal";

export type ConfirmTone = "danger" | "warn";

export interface ConfirmDialogProps {
  /** danger = destructivo e irreversible; warn = reversible pero con consecuencia. */
  tone?: ConfirmTone;
  icon?: ComponentType<{ className?: string }>;
  eyebrow?: string;
  title: string;
  description: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  /** Si falla, el error se muestra aqui dentro y el dialogo no se cierra. */
  onConfirm: () => Promise<void> | void;
  onClose: () => void;
}

const toneClasses: Record<ConfirmTone, string> = {
  danger: "bg-brand-red/8 text-brand-red",
  warn: "bg-warn/10 text-warn",
};


export function ConfirmDialog({
  tone = "danger",
  icon: Icon = AlertTriangle,
  eyebrow,
  title,
  description,
  confirmLabel,
  cancelLabel = "Cancelar",
  onConfirm,
  onClose,
}: ConfirmDialogProps) {
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleConfirm() {
    setError(null);
    setIsRunning(true);
    try {
      await onConfirm();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo completar la acción");
    } finally {
      setIsRunning(false);
    }
  }

  
  function requestClose() {
    if (!isRunning) onClose();
  }

  return (
    <Modal eyebrow={eyebrow} title={title} onClose={requestClose}>
      <div className="flex gap-4">
        <span
          aria-hidden
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-edge ${toneClasses[tone]}`}
        >
          <Icon className="h-5 w-5" />
        </span>

        <div className="flex flex-col gap-3">
          <div className="text-[13.5px] leading-relaxed text-brand-gray">{description}</div>
          {error && <Alert variant="error">{error}</Alert>}
        </div>
      </div>

      <div className="mt-6 flex justify-end gap-2 border-t border-line pt-4">
        <Button type="button" variant="secondary" onClick={requestClose} disabled={isRunning}>
          {cancelLabel}
        </Button>
        <Button type="button" onClick={handleConfirm} isLoading={isRunning}>
          {confirmLabel}
        </Button>
      </div>
    </Modal>
  );
}
