import { zodResolver } from "@hookform/resolvers/zod";
import { useMemo, useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { SubmitValidationButton } from "../../components/app/SubmitValidationButton";
import { ApiError } from "../../api/client";
import { clientsApi } from "../../api/clients";
import { Alert } from "../../components/ui/Alert";
import { CheckboxField, TextField, type FieldState } from "../../components/ui/Field";
import { Modal } from "../../components/ui/Modal";
import { FormModalFooter } from "../../components/ui/FormModalFooter";
import { useModalAnimation } from "../../hooks/useModalAnimation";
import { formatPhoneNumber } from "../../lib/format";
import { fieldForServerError, type FieldRule } from "../../lib/serverFieldErrors";
import { buildValidationItems, focusFormField } from "../../lib/validationItems";
import type { Contact } from "../../types/clients";
import { FormDivider } from "../../components/ui/FormDivider";

/**
 * Espejo de la validacion del servidor en POST/PUT /api/clients/{id}/contacts:
 * nombre y apellido de 2 a 80 caracteres, correo valido de hasta 120 y unico
 * dentro del mismo cliente — es la llave de la futura ingesta por correo
 * (seccion 7.3) —, telefono hasta 30 y cargo hasta 80.
 */
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/;
const PHONE_CHARS_REGEX = /^[0-9+\s\-().extx]+$/i;

const schema = z.object({
  firstName: z.string().trim().min(2, "Al menos 2 caracteres").max(80, "Máximo 80 caracteres"),
  lastName: z.string().trim().min(2, "Al menos 2 caracteres").max(80, "Máximo 80 caracteres"),
  email: z
    .string()
    .trim()
    .max(120, "Máximo 120 caracteres")
    .refine(
      (val) => !val || EMAIL_REGEX.test(val),
      "Correo electrónico inválido",
    ),
  phone: z
    .string()
    .trim()
    .max(30, "Máximo 30 caracteres")
    .refine((val) => {
      if (!val) return true;
      if (!PHONE_CHARS_REGEX.test(val)) return false;
      const digits = val.replace(/\D/g, "");
      return digits.length >= 10 && digits.length <= 15;
    }, "Teléfono inválido (mín. 10 dígitos)"),
  position: z.string().trim().max(80, "Máximo 80 caracteres"),
  isPrimary: z.boolean(),
  isActive: z.boolean(),
});

type FormValues = z.infer<typeof schema>;

/**
 * A que campo pertenece cada 400 o 409 de ContactsController. «apellido» va
 * antes que «nombre» porque el mensaje del apellido tambien lleva la palabra
 * nombre en algunas redacciones. Ver lib/serverFieldErrors por que se hace asi.
 */
const fieldRules: FieldRule<keyof FormValues>[] = [
  { field: "email", matches: ["correo"] },
  { field: "lastName", matches: ["apellido"] },
  { field: "phone", matches: ["telefono", "teléfono"] },
  { field: "position", matches: ["cargo"] },
  { field: "firstName", matches: ["nombre"] },
];

interface ContactModalProps {
  clientId: number;
  contact?: Contact;
  isFirst: boolean;
  onClose: () => void;
  onSaved: (contact: Contact) => void;
}

export function ContactModal({ clientId, contact, isFirst, onClose, onSaved }: ContactModalProps) {
  const isEdit = contact !== undefined;
  const [formError, setFormError] = useState<string | null>(null);
  const { isExiting, requestClose } = useModalAnimation();

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
      firstName: contact?.firstName ?? "",
      lastName: contact?.lastName ?? "",
      email: contact?.email ?? "",
      phone: contact?.phone ? formatPhoneNumber(contact.phone) : "",
      position: contact?.position ?? "",
      isPrimary: contact?.isPrimary ?? isFirst,
      isActive: contact?.isActive ?? true,
    },
  });

  const firstName = useWatch({ control, name: "firstName" }) ?? "";
  const lastName = useWatch({ control, name: "lastName" }) ?? "";
  const contactFormMissing = useMemo(
    () =>
      buildValidationItems([
        {
          id: "firstName",
          label: "Falta el nombre",
          short: "el nombre",
          valid: firstName.trim().length >= 2,
        },
        {
          id: "lastName",
          label: "Falta el apellido",
          short: "el apellido",
          valid: lastName.trim().length >= 2,
        },
      ]),
    [firstName, lastName],
  );

  function stateOf(field: keyof FormValues): FieldState {
    if (errors[field]) return "error";
    return touchedFields[field] ? "valid" : "idle";
  }

  async function onSubmit(values: FormValues) {
    setFormError(null);
    const email = values.email.trim();

    const request = {
      firstName: values.firstName.trim(),
      lastName: values.lastName.trim(),
      email: email === "" ? null : email,
      phone: values.phone.trim() === "" ? null : values.phone.trim(),
      position: values.position.trim() === "" ? null : values.position.trim(),
      isPrimary: values.isPrimary,
      isActive: values.isActive,
    };

    try {
      const saved = isEdit
        ? await clientsApi.contacts.update(contact.id, request)
        : await clientsApi.contacts.create(clientId, request);
      onSaved(saved);
      requestClose();
    } catch (err) {
      const field = fieldForServerError(err, fieldRules);
      if (field) {
        setError(field.field, { message: field.message });
        setFocus(field.field);
        return;
      }

      const fallback = isEdit ? "No se pudo guardar el contacto" : "No se pudo agregar el contacto";
      setFormError(err instanceof ApiError ? err.message : fallback);
    }
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLFormElement>) {
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
      event.preventDefault();
      void handleSubmit(onSubmit)();
    }
  }

  return (
    <Modal
      maxWidth="max-w-xl"
      eyebrow={isEdit ? `Contacto #${contact.id}` : "Persona de contacto del cliente"}
      title={isEdit ? `Editar ${contact.firstName} ${contact.lastName}` : "Nuevo contacto"}
      description="La persona dentro del cliente con la que se coordina cada ticket."
      onClose={onClose}
      isExiting={isExiting}
      onRequestClose={requestClose}
      footer={
        <FormModalFooter
          formId="contact-form"
          isEdit={isEdit}
          createLabel="Agregar contacto"
          isSubmitting={isSubmitting}
          onCancel={requestClose}
          size="sm"
          submit={
            <SubmitValidationButton
              formId="contact-form"
              ready={contactFormMissing.length === 0}
              busy={isSubmitting}
              missingItems={contactFormMissing}
              onFocusField={focusFormField}
              hintText="Para guardar el contacto, completa lo siguiente:"
            >
              {isEdit ? "Guardar cambios" : "Agregar contacto"}
            </SubmitValidationButton>
          }
        />
      }
    >
      <form
        id="contact-form"
        onSubmit={handleSubmit(onSubmit)}
        onKeyDown={handleKeyDown}
        noValidate
        className="flex flex-col gap-3 text-left"
      >
        {formError && <Alert variant="error">{formError}</Alert>}

        <FormDivider title="Identificación" />

        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          <TextField
            size="sm"
            label="Nombre"
            placeholder="Nombre de pila"
            required
            state={stateOf("firstName")}
            error={errors.firstName?.message}
            {...register("firstName")}
          />
          <TextField
            size="sm"
            label="Apellido"
            placeholder="Apellido"
            required
            state={stateOf("lastName")}
            error={errors.lastName?.message}
            {...register("lastName")}
          />
        </div>

        <TextField
          size="sm"
          label="Cargo"
          placeholder="Opcional"
          state={stateOf("position")}
          error={errors.position?.message}
          {...register("position")}
        />

        <FormDivider title="Canales" />

        <TextField
          size="sm"
          label="Correo electrónico"
          type="email"
          placeholder="contacto@empresa.com"
          state={stateOf("email")}
          error={errors.email?.message}
          hint="Opcional, pero único dentro de este cliente. Con la ingesta por correo, reconoce al remitente."
          {...register("email")}
        />

        <Controller
          name="phone"
          control={control}
          render={({ field }) => (
            <TextField
              size="sm"
              type="tel"
              label="Teléfono"
              placeholder="Ej. 809-555-0123"
              name={field.name}
              value={field.value}
              onChange={(e) => field.onChange(formatPhoneNumber(e.target.value))}
              onBlur={field.onBlur}
              state={stateOf("phone")}
              error={errors.phone?.message}
            />
          )}
        />

        <FormDivider title="Preferencias" />

        <div className="flex flex-col gap-2">
          <CheckboxField
            label="Contacto principal"
            description="Solo puede haber uno por cliente: marcar este desmarca al anterior."
            {...register("isPrimary")}
          />

          {isEdit && (
            <CheckboxField
              label="Activo"
              description="Si se desmarca, deja de ofrecerse al abrir o asignar un ticket."
              {...register("isActive")}
            />
          )}
        </div>
      </form>
    </Modal>
  );
}
