import { Modal } from "../../../components/ui/Modal";
import type { AvailableForm } from "./ticketForms";

interface NewFormPickerModalProps {
  availableForms: AvailableForm[];
  suggestedFormRaw?: string | null;
  ticketNumber: string;
  onClose: () => void;
}

/** Elegir otro formulario oficial para iniciarlo en el ticket. */
export function NewFormPickerModal({ availableForms, suggestedFormRaw, ticketNumber, onClose }: NewFormPickerModalProps) {
  return (
    <Modal
      title="Seleccionar Formulario Oficial"
      onClose={onClose}
      size="lg"
    >
      <div className="space-y-3 py-1">
        <p className="text-xs text-zinc-500">
          Selecciona el formato empresarial de Plastifar que deseas iniciar para el ticket #{ticketNumber}:
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          {availableForms.map((form) => {
            const isRecommended = form.key === suggestedFormRaw;
            const Icon = form.icon;
            return (
              <button
                key={form.key}
                type="button"
                disabled={form.disabled}
                onClick={() => {
                  onClose();
                  form.action();
                }}
                className={`flex flex-col text-left p-3.5 rounded-xl border transition-all ${
                  isRecommended
                    ? "border-brand-red/40 bg-brand-red/5 ring-1 ring-brand-red/20 hover:bg-brand-red/10 cursor-pointer"
                    : "border-zinc-200 bg-white hover:border-zinc-300 hover:bg-zinc-50 cursor-pointer"
                } ${form.disabled ? "opacity-50 cursor-not-allowed" : ""}`}
              >
                <div className="flex items-center justify-between">
                  <span className={`font-heading text-[10px] font-bold uppercase tracking-wider ${form.codeColor}`}>
                    {form.code}
                  </span>
                  {isRecommended && (
                    <span className="text-[10px] font-bold text-brand-red bg-brand-red/10 px-1.5 py-0.5 rounded">
                      Recomendado
                    </span>
                  )}
                </div>
                <span className="mt-1 text-xs font-semibold text-zinc-900">{form.title}</span>
                <span className="mt-0.5 text-[11px] text-zinc-500 line-clamp-2 leading-relaxed">{form.description}</span>
                <div className="mt-2.5 pt-2 border-t border-zinc-100 flex items-center justify-between text-[10.5px] text-zinc-400">
                  <span>{form.dept}</span>
                  <span className="inline-flex items-center text-xs font-semibold text-zinc-700">
                    Iniciar <Icon className="size-3 ml-1" />
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </Modal>
  );
}
