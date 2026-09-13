import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { ApiError } from "../../api/client";
import { settingsApi } from "../../api/settings";
import { Alert } from "../../components/ui/Alert";
import { Button } from "../../components/ui/Button";
import {
  CheckboxField,
  TextAreaField,
  TextField,
  type FieldState,
} from "../../components/ui/Field";
import { Modal } from "../../components/ui/Modal";
import { renderPreview, unknownVariables } from "../../lib/templates";
import { TEMPLATE_VARIABLES, type EmailTemplate } from "../../types/settings";

/**
 * Espejo de la validacion del servidor en POST/PUT /api/settings/templates:
 * clave, nombre, asunto y cuerpo obligatorios, y ninguna variable fuera del
 * catalogo permitido, comprobado al guardar.
 */
const schema = z.object({
  key: z
    .string()
    .trim()
    .min(3, "Al menos 3 caracteres")
    .regex(/^[a-z0-9]+(\.[a-z0-9]+)*$/, "Solo minúsculas y puntos, sin espacios"),
  name: z.string().trim().min(2, "Al menos 2 caracteres").max(80, "Máximo 80 caracteres"),
  subject: z.string().trim().min(3, "Al menos 3 caracteres").max(160, "Máximo 160 caracteres"),
  body: z.string().trim().min(10, "El cuerpo no puede quedar casi vacío"),
  isActive: z.boolean(),
});

type FormValues = z.infer<typeof schema>;

interface TemplateModalProps {
  template?: EmailTemplate;
  onClose: () => void;
  onSaved: (template: EmailTemplate) => void;
}

export function TemplateModal({ template, onClose, onSaved }: TemplateModalProps) {
  const isEdit = template !== undefined;
  const [showPreview, setShowPreview] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const {
    control,
    register,
    handleSubmit,
    setError,
    setFocus,
    formState: { errors, touchedFields, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    mode: "onTouched",
    defaultValues: {
      key: template?.key ?? "",
      name: template?.name ?? "",
      subject: template?.subject ?? "",
      body: template?.body ?? "",
      isActive: template?.isActive ?? true,
    },
  });

  function stateOf(field: keyof FormValues): FieldState {
    if (errors[field]) return "error";
    return touchedFields[field] ? "valid" : "idle";
  }

  const subject = useWatch({ control, name: "subject" });
  const body = useWatch({ control, name: "body" });
  const unknown = unknownVariables(`${subject} ${body}`);

  async function onSubmit(values: FormValues) {
    setFormError(null);

    // La variable desconocida se rechaza aqui, no al enviar el correo — el
    // servidor valida lo mismo, esto solo evita el viaje de ida y vuelta.
    const invalid = unknownVariables(`${values.subject} ${values.body}`);
    if (invalid.length > 0) {
      const field = unknownVariables(values.subject).length > 0 ? "subject" : "body";
      setError(field, {
        message: `Variable desconocida: ${invalid.map((name) => `{{${name}}}`).join(", ")}`,
      });
      setFocus(field);
      return;
    }

    const request = {
      key: values.key.trim(),
      name: values.name.trim(),
      subject: values.subject.trim(),
      body: values.body.trim(),
      isActive: values.isActive,
    };

    try {
      const saved = isEdit
        ? await settingsApi.templates.update(template.id, request)
        : await settingsApi.templates.create(request);
      onSaved(saved);
      onClose();
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setError("key", { message: err.message });
        setFocus("key");
        return;
      }
      setFormError(err instanceof ApiError ? err.message : "No se pudo guardar la plantilla");
    }
  }

  return (
    <Modal
      title={isEdit ? "Editar plantilla" : "Nueva plantilla"}
      description="El texto que se ofrece al responder al cliente. Las variables se sustituyen al enviar."
      onClose={onClose}
      footer={
        <>
          <Button type="button" variant="ghost" onClick={() => setShowPreview((value) => !value)}>
            {showPreview ? "Ocultar vista previa" : "Vista previa"}
          </Button>
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" form="template-form" isLoading={isSubmitting}>
            {isEdit ? "Guardar cambios" : "Crear plantilla"}
          </Button>
        </>
      }
    >
      <form
        id="template-form"
        onSubmit={handleSubmit(onSubmit)}
        noValidate
        className="flex flex-col gap-4"
      >
        {formError && <Alert variant="error">{formError}</Alert>}

        <div className="grid grid-cols-2 gap-3">
          <TextField
            label="Nombre"
            placeholder="Ej. Acuse de recibo"
            required
            state={stateOf("name")}
            error={errors.name?.message}
            {...register("name")}
          />
          <TextField
            label="Clave"
            placeholder="Ej. ticket.recibido"
            required
            disabled={isEdit}
            state={stateOf("key")}
            error={errors.key?.message}
            hint={isEdit ? "La clave no cambia: el sistema la invoca por ella." : undefined}
            {...register("key")}
          />
        </div>

        <TextField
          label="Asunto"
          placeholder="Recibimos su solicitud · Ticket {{ticket}}"
          required
          state={stateOf("subject")}
          error={errors.subject?.message}
          {...register("subject")}
        />

        <TextAreaField
          label="Cuerpo"
          rows={9}
          required
          error={errors.body?.message}
          {...register("body")}
        />

        <div className="flex flex-col gap-1.5">
          <span className="font-heading text-[10.5px] font-semibold uppercase tracking-[0.08em] text-faint">
            Variables permitidas
          </span>
          {/* Que significa cada variable se lee, no se descubre pasando el
              mouse: un `title` no existe para el teclado ni para el tactil. */}
          <div className="flex flex-wrap gap-1.5">
            {TEMPLATE_VARIABLES.map((variable) => (
              <span
                key={variable.key}
                className="inline-flex flex-col gap-0.5 rounded-edge border border-line px-2 py-1"
              >
                <span className="font-mono text-[11px] leading-tight text-brand-gray">
                  {`{{${variable.key}}}`}
                </span>
                <span className="text-[10.5px] leading-tight text-faint">{variable.label}</span>
              </span>
            ))}
          </div>
        </div>

        {unknown.length > 0 && (
          <Alert variant="error">
            {unknown.length === 1 ? "Variable desconocida" : "Variables desconocidas"}:{" "}
            {unknown.map((name) => `{{${name}}}`).join(", ")}. Solo se admiten las{" "}
            {TEMPLATE_VARIABLES.length} variables de arriba.
          </Alert>
        )}

        {/* RF-K3: vista previa con datos de ejemplo antes de guardar. */}
        {showPreview && (
          <div className="rounded-edge border border-line px-3.5 py-3">
            <p className="font-heading text-[10px] font-semibold uppercase tracking-[0.08em] text-faint">
              Así lo recibe el cliente
            </p>
            <p className="mt-2 text-[13px] font-semibold text-ink">{renderPreview(subject)}</p>
            <p className="mt-1.5 whitespace-pre-wrap text-[12.5px] leading-relaxed text-brand-gray">
              {renderPreview(body)}
            </p>
          </div>
        )}

        {isEdit && (
          <CheckboxField
            label="Activa"
            description="Si se desmarca, deja de ofrecerse al redactar una respuesta."
            {...register("isActive")}
          />
        )}
      </form>
    </Modal>
  );
}
