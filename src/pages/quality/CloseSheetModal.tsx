import { zodResolver } from "@hookform/resolvers/zod";
import { AlertTriangle, Check } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { ApiError } from "../../api/client";
import { qualityApi, type ClosureCondition } from "../../api/quality";
import { Alert } from "../../components/ui/Alert";
import { Button } from "../../components/ui/Button";
import { TextAreaField } from "../../components/ui/Field";
import { Modal } from "../../components/ui/Modal";
import type { CorrectiveActionSheet } from "../../types/quality";

const schema = z.object({
  closingNote: z.string().trim().max(1000, "Máximo 1000 caracteres"),
});

type FormValues = z.infer<typeof schema>;

interface CloseSheetModalProps {
  sheet: CorrectiveActionSheet;
  /** Ya resueltas por el servidor (GET .../sheets/{id}), no se recalculan aquí. */
  conditions: ClosureCondition[];
  onClose: () => void;
  onSaved: (sheet: CorrectiveActionSheet) => void;
}

/** RF-Q5: el cierre. Solo se llega aquí con las tres condiciones cumplidas; el
 *  diálogo las repite para que el sello no sea un acto a ciegas. El servidor
 *  vuelve a comprobarlas: la del navegador es comodidad, esa es la barrera. */
export function CloseSheetModal({ sheet, conditions, onClose, onSaved }: CloseSheetModalProps) {
  const [formError, setFormError] = useState<string | null>(null);
  const allMet = conditions.every((condition) => condition.met);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    mode: "onTouched",
    defaultValues: { closingNote: sheet.closingNote ?? "" },
  });

  async function onSubmit(values: FormValues) {
    setFormError(null);
    const closingNote = values.closingNote.trim();
    try {
      const saved = await qualityApi.sheets.close(sheet.id, closingNote === "" ? null : closingNote);
      onSaved(saved);
      onClose();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "No se pudo cerrar la hoja");
    }
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
          <Button
            type="submit"
            form="close-sheet-form"
            disabled={!allMet}
            isLoading={isSubmitting}
          >
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
        {formError && <Alert variant="error">{formError}</Alert>}

        {/* Las condiciones se leen del servidor, no se dan por cumplidas: entre
            que se cargó la ficha y se abrió este diálogo el estado pudo cambiar,
            y pintar de verde algo que falta justo al sellar el registro es el
            peor momento posible para mentir. Mismo contrato que la ficha. */}
        <ul className="flex flex-col gap-1.5">
          {conditions.map((condition) => (
            <li
              key={condition.id}
              className={`flex items-start gap-2 text-[13px] leading-relaxed ${
                condition.met ? "text-brand-gray" : "text-warn"
              }`}
            >
              {condition.met ? (
                <Check aria-hidden className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-green" />
              ) : (
                <AlertTriangle aria-hidden className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warn" />
              )}
              <span className="flex flex-col gap-0.5">
                <span>
                  {condition.label}
                  <span className="sr-only">{condition.met ? ": cumplida" : ": falta"}</span>
                </span>
                {!condition.met && <span className="text-[12.5px]">{condition.missing}</span>}
              </span>
            </li>
          ))}
        </ul>

        {!allMet && (
          <Alert variant="error">
            Falta al menos una condición. El servidor rechazará el cierre: resuélvela y vuelve a
            intentarlo.
          </Alert>
        )}

        <TextAreaField
          label="Nota de cierre"
          rows={3}
          placeholder="Se cerró tras verificar la eficacia con el cliente el 12 de marzo"
          hint="Opcional, salvo que la hoja se abriera por error: una HCA nunca se elimina, se cierra explicando por qué."
          error={errors.closingNote?.message}
          {...register("closingNote")}
        />
      </form>
    </Modal>
  );
}
