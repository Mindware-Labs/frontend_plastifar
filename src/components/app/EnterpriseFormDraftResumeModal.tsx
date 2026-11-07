import { FilePenLine } from "lucide-react";
import { Button } from "../ui/Button";
import { Modal } from "../ui/Modal";

interface EnterpriseFormDraftResumeModalProps {
  open: boolean;
  formCode: string;
  formTitle: string;
  ticketNumber: string;
  hostKindLabel?: string;
  savedAtLabel?: string | null;
  stepLabel?: string | null;
  onResume: () => void;
  onCancel: () => void;
}

/** Antes de abrir un formulario: retomar el borrador local o volver atrás. */
export function EnterpriseFormDraftResumeModal({
  open,
  formCode,
  formTitle,
  ticketNumber,
  hostKindLabel = "Ticket",
  savedAtLabel,
  stepLabel,
  onResume,
  onCancel,
}: EnterpriseFormDraftResumeModalProps) {
  if (!open) return null;

  return (
    <Modal
      title="Borrador en progreso"
      eyebrow={`${formCode} · ${hostKindLabel} ${ticketNumber}`}
      onClose={onCancel}
      maxWidth="max-w-md"
      closeOnBackdropClick={false}
      footer={
        <div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end">
          <Button type="button" variant="secondary" size="sm" onClick={onCancel} className="sm:min-w-[7.5rem]">
            Cancelar
          </Button>
          <Button type="button" size="sm" onClick={onResume} className="sm:min-w-[9.5rem]">
            Retomar borrador
          </Button>
        </div>
      }
    >
      <div className="flex flex-col items-center text-center sm:flex-row sm:items-start sm:text-left sm:gap-4">
        <div className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-zinc-200/90 bg-zinc-50 text-brand-red shadow-2xs">
          <FilePenLine className="size-5" strokeWidth={2} />
        </div>
        <div className="mt-3 min-w-0 sm:mt-0">
          <p className="text-[13px] leading-relaxed text-zinc-700">
            Hay un borrador guardado de{" "}
            <span className="font-semibold text-zinc-900">{formTitle}</span> en este navegador. Puedes
            continuar donde lo dejaste o cancelar para seguir en la pestaña de formularios.
          </p>
          {(savedAtLabel || stepLabel) && (
            <dl className="mt-3 grid grid-cols-2 gap-2 rounded-lg border border-line-soft bg-zinc-50/80 px-3 py-2.5 text-left text-[11px]">
              {savedAtLabel ? (
                <div>
                  <dt className="font-heading text-[10px] font-bold uppercase tracking-[0.08em] text-faint">
                    Guardado
                  </dt>
                  <dd className="mt-0.5 font-medium tabular-nums text-zinc-800">{savedAtLabel}</dd>
                </div>
              ) : null}
              {stepLabel ? (
                <div>
                  <dt className="font-heading text-[10px] font-bold uppercase tracking-[0.08em] text-faint">
                    Paso
                  </dt>
                  <dd className="mt-0.5 font-medium text-zinc-800">{stepLabel}</dd>
                </div>
              ) : null}
            </dl>
          )}
        </div>
      </div>
    </Modal>
  );
}
