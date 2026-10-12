import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { ApiError } from "../../api/client";
import { qualityApi } from "../../api/quality";
import { Alert } from "../../components/ui/Alert";
import { Button } from "../../components/ui/Button";
import { LookupField, SelectField, TextField } from "../../components/ui/Field";
import { Modal } from "../../components/ui/Modal";
import { resolveStaffLabel, searchActiveStaff } from "../../lib/lookups";
import type { HcaParticipant } from "../../types/quality";

// Espejo de HcaSheetPartsController.AddParticipant.
const schema = z
  .object({
    kind: z.enum(["personal", "manual"]),
    staffId: z.string(),
    name: z.string().trim().max(160, "Máximo 160 caracteres"),
  })
  .superRefine((values, ctx) => {
    if (values.kind === "personal" && values.staffId === "") {
      ctx.addIssue({ code: "custom", path: ["staffId"], message: "Elige a la persona" });
    }
    if (values.kind === "manual" && values.name.length < 3) {
      ctx.addIssue({ code: "custom", path: ["name"], message: "Escribe el nombre: al menos 3 caracteres" });
    }
  });

type FormValues = z.infer<typeof schema>;

interface HcaParticipantModalProps {
  sheetId: number;
  sheetNumber: string;
  onClose: () => void;
  onSaved: (participant: HcaParticipant) => void;
}

/**
 * RF-H5: un participante del análisis. Personal del sistema, que después
 * confirma su participación con un sello de fecha, o un nombre escrito a mano
 * para quien no tiene usuario; la firma autógrafa se hace sobre la impresión.
 */
export function HcaParticipantModal({ sheetId, sheetNumber, onClose, onSaved }: HcaParticipantModalProps) {
  const [formError, setFormError] = useState<string | null>(null);

  const {
    control,
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    mode: "onTouched",
    defaultValues: { kind: "personal", staffId: "", name: "" },
  });

  const kind = useWatch({ control, name: "kind" });

  async function onSubmit(values: FormValues) {
    setFormError(null);
    try {
      const saved = await qualityApi.participants.add(sheetId, {
        staffId: values.kind === "personal" ? Number(values.staffId) : null,
        name: values.kind === "manual" ? values.name.trim() : null,
      });
      onSaved(saved);
      onClose();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "No se pudo agregar el participante");
    }
  }

  return (
    <Modal
      title="Agregar participante"
      description={`Quién participó en el análisis de ${sheetNumber}. El personal del sistema puede confirmar su participación; quien no tiene usuario firma sobre la impresión.`}
      onClose={onClose}
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" form="participant-form" isLoading={isSubmitting}>
            Agregar
          </Button>
        </>
      }
    >
      <form id="participant-form" onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
        {formError && <Alert variant="error">{formError}</Alert>}

        <Controller
          name="kind"
          control={control}
          render={({ field }) => (
            <SelectField
              label="Tipo"
              name={field.name}
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
              options={[
                { value: "personal", label: "Personal del sistema" },
                { value: "manual", label: "Nombre escrito a mano" },
              ]}
            />
          )}
        />

        {kind === "personal" ? (
          <Controller
            name="staffId"
            control={control}
            render={({ field }) => (
              <LookupField
                label="Persona"
                required
                name={field.name}
                value={field.value}
                onChange={(value) => field.onChange(value)}
                onBlur={field.onBlur}
                placeholder="Elige a alguien"
                searchPlaceholder="Buscar en el personal…"
                search={searchActiveStaff}
                resolveSelectedLabel={resolveStaffLabel}
                error={errors.staffId?.message}
              />
            )}
          />
        ) : (
          <TextField
            label="Nombre"
            required
            placeholder="Nombre y apellido, como firmará"
            error={errors.name?.message}
            {...register("name")}
          />
        )}
      </form>
    </Modal>
  );
}
