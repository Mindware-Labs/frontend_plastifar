import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "../../components/ui/Button";
import { TextAreaField } from "../../components/ui/Field";
import { Modal } from "../../components/ui/Modal";
import type { ActionPlanItem } from "../../types/quality";

const schema = z.object({
  cancelReason: z
    .string()
    .trim()
    .min(15, "Explica por qué se anula: al menos 15 caracteres")
    .max(500, "Máximo 500 caracteres"),
});

type FormValues = z.infer<typeof schema>;

interface CancelPlanItemModalProps {
  item: ActionPlanItem;
  onClose: () => void;
  onSave: (item: ActionPlanItem) => void;
}

/**
 * RF-Q4: una accion del plan no se borra. O se cumple, o se anula con
 * justificacion — y la justificacion queda escrita en la hoja, porque es lo que
 * explica a un auditor por que el plan se cerro sin ella.
 */
export function CancelPlanItemModal({ item, onClose, onSave }: CancelPlanItemModalProps) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    mode: "onTouched",
    defaultValues: { cancelReason: item.cancelReason ?? "" },
  });

  function onSubmit(values: FormValues) {
    onSave({
      ...item,
      status: "Anulada",
      completedAt: null,
      cancelReason: values.cancelReason.trim(),
    });
    onClose();
  }

  return (
    <Modal
      title="Anular acción del plan"
      description="La acción deja de bloquear el cierre, pero se conserva con el motivo a la vista."
      onClose={onClose}
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" form="cancel-item-form" isLoading={isSubmitting}>
            Anular acción
          </Button>
        </>
      }
    >
      <form
        id="cancel-item-form"
        onSubmit={handleSubmit(onSubmit)}
        noValidate
        className="flex flex-col gap-4"
      >
        <p className="rounded-edge bg-canvas px-3 py-2.5 text-[13px] leading-relaxed text-brand-gray">
          {item.description}
        </p>

        <TextAreaField
          label="Justificación"
          required
          rows={3}
          placeholder="Por qué esta acción ya no procede, y qué cubre el riesgo en su lugar"
          error={errors.cancelReason?.message}
          {...register("cancelReason")}
        />
      </form>
    </Modal>
  );
}
