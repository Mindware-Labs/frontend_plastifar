import { qualityApi } from "../../api/quality";
import { ReasonModal } from "../../components/app/ReasonModal";
import type { ActionPlanItem } from "../../types/quality";

interface CancelPlanItemModalProps {
  item: ActionPlanItem;
  onClose: () => void;
  onSaved: (item: ActionPlanItem) => void;
}

/**
 * RF-Q4: una accion del plan no se borra. O se cumple, o se anula con
 * justificacion — y la justificacion queda escrita en la hoja, porque es lo que
 * explica a un auditor por que el plan se cerro sin ella.
 */
export function CancelPlanItemModal({ item, onClose, onSaved }: CancelPlanItemModalProps) {
  return (
    <ReasonModal
      title="Anular acción del plan"
      description="La acción deja de bloquear el cierre, pero se conserva con el motivo a la vista."
      field={{
        label: "Justificación",
        placeholder: "Por qué esta acción ya no procede, y qué cubre el riesgo en su lugar",
        min: 15,
        minMessage: "Explica por qué se anula: al menos 15 caracteres",
        max: 500,
        defaultValue: item.cancelReason ?? "",
      }}
      submitLabel="Anular acción"
      // Lo destructivo va delineado en rojo sobre blanco: el rojo pleno es la
      // primaria afirmativa, y anular no lo es.
      submitVariant="danger"
      fallbackError="No se pudo anular la acción"
      onSubmit={async (reason) => onSaved(await qualityApi.planItems.cancel(item.id, reason ?? ""))}
      onClose={onClose}
    >
      {/* Sin caja teñida: el panel señala una sección con un filete, no con un
          bloque de color. */}
      <div className="flex flex-col gap-1 border-y border-line-soft py-2.5">
        <span className="font-heading text-[10px] font-semibold uppercase tracking-[0.08em] text-faint">Acción</span>
        <p className="text-[13px] leading-relaxed text-brand-gray">{item.description}</p>
      </div>
    </ReasonModal>
  );
}
