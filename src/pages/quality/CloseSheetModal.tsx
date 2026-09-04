import { zodResolver } from "@hookform/resolvers/zod";
import { Check } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "../../components/ui/Button";
import { TextAreaField } from "../../components/ui/Field";
import { Modal } from "../../components/ui/Modal";
import { closureConditions } from "../../lib/quality";
import type { ActionPlanItem, CorrectiveActionSheet } from "../../types/quality";

const schema = z.object({
  closingNote: z.string().trim().max(1000, "Máximo 1000 caracteres"),
});

type FormValues = z.infer<typeof schema>;

interface CloseSheetModalProps {
  sheet: CorrectiveActionSheet;
  items: ActionPlanItem[];
  /** Quien cierra: queda sellado en la hoja. */
  closedByStaffId: number | null;
  onClose: () => void;
  onSave: (sheet: CorrectiveActionSheet) => void;
}

/** RF-Q5: el cierre. Solo se llega aquí con las tres condiciones cumplidas; el
 *  diálogo las repite para que el sello no sea un acto a ciegas. */
export function CloseSheetModal({
  sheet,
  items,
  closedByStaffId,
  onClose,
  onSave,
}: CloseSheetModalProps) {
  const conditions = closureConditions(sheet, items);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    mode: "onTouched",
    defaultValues: { closingNote: sheet.closingNote ?? "" },
  });

  function onSubmit(values: FormValues) {
    const closingNote = values.closingNote.trim();
    onSave({
      ...sheet,
      status: "Cerrada",
      closedAt: new Date().toISOString(),
      closedByStaffId,
      closingNote: closingNote === "" ? null : closingNote,
    });
    onClose();
  }

  return (
    <Modal
      title={`Cerrar ${sheet.number}`}
      description="Una hoja cerrada conserva todo su historial; el cierre no borra nada."
      onClose={onClose}
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" form="close-sheet-form" isLoading={isSubmitting}>
            Cerrar HCA
          </Button>
        </>
      }
    >
      <form
        id="close-sheet-form"
        onSubmit={handleSubmit(onSubmit)}
        noValidate
        className="flex flex-col gap-4"
      >
        <ul className="flex flex-col gap-1.5">
          {conditions.map((condition) => (
            <li
              key={condition.id}
              className="flex items-center gap-2 text-[13px] leading-relaxed text-brand-gray"
            >
              <Check aria-hidden className="h-3.5 w-3.5 shrink-0 text-brand-green" />
              {condition.label}
            </li>
          ))}
        </ul>

        <TextAreaField
          label="Nota de cierre"
          rows={3}
          placeholder="Opcional. Obligada en la práctica si la hoja se abrió por error: explica por qué se cierra."
          hint="Una HCA nunca se elimina; si se abrió por error, se cierra con nota explicativa."
          error={errors.closingNote?.message}
          {...register("closingNote")}
        />
      </form>
    </Modal>
  );
}
