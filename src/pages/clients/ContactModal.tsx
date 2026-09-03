import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "../../components/ui/Button";
import { CheckboxField, TextField, type FieldState } from "../../components/ui/Field";
import { Modal } from "../../components/ui/Modal";
import { NEW_ID } from "../../lib/catalog";
import type { Contact } from "../../types/clients";

/**
 * Espejo de la validacion del servidor en POST/PUT /api/clients/{id}/contacts:
 * nombre y apellido obligatorios, correo unico dentro del mismo cliente — es la
 * llave de la futura ingesta por correo (seccion 7.3).
 */
const schema = z.object({
  firstName: z.string().trim().min(1, "Obligatorio").max(80, "Máximo 80 caracteres"),
  lastName: z.string().trim().min(1, "Obligatorio").max(80, "Máximo 80 caracteres"),
  email: z.string().trim().max(120, "Máximo 120 caracteres").email("Correo inválido").or(z.literal("")),
  phone: z.string().trim().max(30, "Máximo 30 caracteres"),
  position: z.string().trim().max(80, "Máximo 80 caracteres"),
  isPrimary: z.boolean(),
  isActive: z.boolean(),
});

type FormValues = z.infer<typeof schema>;

interface ContactModalProps {
  clientId: number;
  contact?: Contact;
  existing: Contact[];
  onClose: () => void;
  onSave: (contact: Contact) => void;
}

export function ContactModal({ clientId, contact, existing, onClose, onSave }: ContactModalProps) {
  const isEdit = contact !== undefined;

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
      isPrimary: contact?.isPrimary ?? existing.length === 0,
      isActive: contact?.isActive ?? true,
    },
  });

  function stateOf(field: keyof FormValues): FieldState {
    if (errors[field]) return "error";
    return touchedFields[field] ? "valid" : "idle";
  }

  function onSubmit(values: FormValues) {
    const email = values.email.trim();
    if (email !== "") {
      const clash = existing.find(
        (candidate) =>
          candidate.email?.toLowerCase() === email.toLowerCase() && candidate.id !== contact?.id,
      );
      if (clash) {
        setError("email", {
          message: `Ese correo ya lo usa ${clash.firstName} ${clash.lastName} en este cliente`,
        });
        setFocus("email");
        return;
      }
    }

    onSave({
      id: contact?.id ?? NEW_ID,
      clientId,
      firstName: values.firstName.trim(),
      lastName: values.lastName.trim(),
      email: email === "" ? null : email,
      phone: values.phone.trim() === "" ? null : values.phone.trim(),
      position: values.position.trim() === "" ? null : values.position.trim(),
      isPrimary: values.isPrimary,
      isActive: values.isActive,
    });
    onClose();
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
