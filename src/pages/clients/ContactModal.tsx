import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { ApiError } from "../../api/client";
import { clientsApi } from "../../api/clients";
import { Alert } from "../../components/ui/Alert";
import { Button } from "../../components/ui/Button";
import { CheckboxField, TextField, type FieldState } from "../../components/ui/Field";
import { Modal } from "../../components/ui/Modal";
import type { Contact } from "../../types/clients";
import { fieldForServerError, type FieldRule } from "./serverFieldErrors";

/**
 * Espejo de la validacion del servidor en POST/PUT /api/clients/{id}/contacts:
 * nombre y apellido de 2 a 80 caracteres, correo valido de hasta 120 y unico
 * dentro del mismo cliente — es la llave de la futura ingesta por correo
 * (seccion 7.3) —, telefono hasta 30 y cargo hasta 80.
 */
const schema = z.object({
  firstName: z.string().trim().min(2, "Al menos 2 caracteres").max(80, "Máximo 80 caracteres"),
  lastName: z.string().trim().min(2, "Al menos 2 caracteres").max(80, "Máximo 80 caracteres"),
  email: z.string().trim().max(120, "Máximo 120 caracteres").email("Formato de correo inválido, revisa el @ y el dominio").or(z.literal("")),
  phone: z.string().trim().max(30, "Máximo 30 caracteres"),
  position: z.string().trim().max(80, "Máximo 80 caracteres"),
  isPrimary: z.boolean(),
  isActive: z.boolean(),
});

type FormValues = z.infer<typeof schema>;

/**
 * A que campo pertenece cada 400 o 409 de ContactsController. «apellido» va
 * antes que «nombre» porque el mensaje del apellido tambien lleva la palabra
 * nombre en algunas redacciones. Ver ./serverFieldErrors por que se hace asi.
 */
const fieldRules: FieldRule<keyof FormValues>[] = [
  { field: "email", matches: ["correo"] },
  { field: "lastName", matches: ["apellido"] },
  { field: "phone", matches: ["telefono"] },
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

  const {
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
      phone: contact?.phone ?? "",
      position: contact?.position ?? "",
      isPrimary: contact?.isPrimary ?? isFirst,
      isActive: contact?.isActive ?? true,
    },
  });

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
      onClose();
    } catch (err) {
      // Seccion 4.2: en su campo y con el foco de vuelta. Antes solo el 409 del
      // correo duplicado llegaba a su campo; los 400 de longitud o formato
      // acababan en el aviso general de arriba.
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

  return (
    <Modal
      title={isEdit ? "Editar contacto" : "Nuevo contacto"}
      description="La persona dentro del cliente con la que se coordina cada ticket."
      onClose={onClose}
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" form="contact-form" isLoading={isSubmitting}>
            {isEdit ? "Guardar cambios" : "Agregar contacto"}
          </Button>
        </>
      }
    >
      <form
        id="contact-form"
        onSubmit={handleSubmit(onSubmit)}
        noValidate
        className="flex flex-col gap-4"
      >
        {formError && <Alert variant="error">{formError}</Alert>}

        <div className="grid grid-cols-2 gap-3">
          <TextField
            label="Nombre"
            required
            state={stateOf("firstName")}
            error={errors.firstName?.message}
            {...register("firstName")}
          />
          <TextField
            label="Apellido"
            required
            state={stateOf("lastName")}
            error={errors.lastName?.message}
            {...register("lastName")}
          />
        </div>

        <TextField
          label="Correo"
          type="email"
          placeholder="Opcional, pero único dentro de este cliente"
          state={stateOf("email")}
          error={errors.email?.message}
          hint="Con la ingesta de tickets por correo, reconoce al remitente."
          {...register("email")}
        />

        <div className="grid grid-cols-2 gap-3">
          <TextField
            label="Teléfono"
            placeholder="Opcional"
            state={stateOf("phone")}
            error={errors.phone?.message}
            {...register("phone")}
          />
          <TextField
            label="Cargo"
            placeholder="Opcional"
            state={stateOf("position")}
            error={errors.position?.message}
            {...register("position")}
          />
        </div>

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
