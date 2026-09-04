import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { ApiError } from "../../api/client";
import { settingsApi } from "../../api/settings";
import { Alert } from "../../components/ui/Alert";
import { Button } from "../../components/ui/Button";
import { CheckboxField, SelectField, TextField, type FieldState } from "../../components/ui/Field";
import { Modal } from "../../components/ui/Modal";
import { MAILBOX_PROVIDERS, type Mailbox } from "../../types/settings";

/**
 * Espejo de la validacion del servidor en POST/PUT /api/settings/mailboxes:
 * correo unico y valido, nombre visible y departamento obligatorios, y una
 * referencia al secreto en vez de la credencial en si — la credencial la
 * guarda quien tenga acceso a la configuracion protegida del servidor, no
 * este formulario.
 */
const schema = z.object({
  address: z.string().trim().min(1, "Indica el correo").email("Correo inválido"),
  displayName: z.string().trim().min(2, "Al menos 2 caracteres").max(80, "Máximo 80 caracteres"),
  provider: z.string().min(1, "Elige el proveedor"),
  departmentId: z.string().min(1, "Elige a qué departamento caen sus tickets"),
  secretRef: z
    .string()
    .trim()
    .min(2, "Al menos 2 caracteres")
    .regex(/^[a-z0-9/_-]+$/i, "Solo letras, números, guiones y barras"),
  isActive: z.boolean(),
});

type FormValues = z.infer<typeof schema>;

interface MailboxModalProps {
  mailbox?: Mailbox;
  departments: { id: number; name: string }[];
  onClose: () => void;
  onSaved: (mailbox: Mailbox) => void;
}

export function MailboxModal({ mailbox, departments, onClose, onSaved }: MailboxModalProps) {
  const isEdit = mailbox !== undefined;
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
      address: mailbox?.address ?? "",
      displayName: mailbox?.displayName ?? "",
      provider: mailbox?.provider ?? "IMAP",
      departmentId: mailbox ? String(mailbox.departmentId) : "",
      secretRef: mailbox?.secretRef ?? "",
      isActive: mailbox?.isActive ?? true,
    },
  });

  function stateOf(field: keyof FormValues): FieldState {
    if (errors[field]) return "error";
    return touchedFields[field] ? "valid" : "idle";
  }

  async function onSubmit(values: FormValues) {
    setFormError(null);
    const request = {
      address: values.address.trim().toLowerCase(),
      displayName: values.displayName.trim(),
      provider: values.provider as Mailbox["provider"],
      departmentId: Number(values.departmentId),
      secretRef: values.secretRef.trim(),
      isActive: values.isActive,
    };

    try {
      const saved = isEdit
        ? await settingsApi.mailboxes.update(mailbox.id, request)
        : await settingsApi.mailboxes.create(request);
      onSaved(saved);
      onClose();
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setError("address", { message: err.message });
        setFocus("address");
        return;
      }
      setFormError(err instanceof ApiError ? err.message : "No se pudo guardar el buzón");
    }
  }

  return (
    <Modal
      title={isEdit ? "Editar buzón" : "Nuevo buzón"}
      description="Solo la administración del buzón. La lectura del correo entrante llega con la ingesta por correo, todavía pendiente."
      onClose={onClose}
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" form="mailbox-form" isLoading={isSubmitting}>
            {isEdit ? "Guardar cambios" : "Crear buzón"}
          </Button>
        </>
      }
    >
      <form
        id="mailbox-form"
        onSubmit={handleSubmit(onSubmit)}
        noValidate
        className="flex flex-col gap-4"
      >
        {formError && <Alert variant="error">{formError}</Alert>}

        <div className="grid grid-cols-2 gap-3">
          <TextField
            label="Correo"
            type="email"
            placeholder="calidad@plastifar.com"
            required
            state={stateOf("address")}
            error={errors.address?.message}
            {...register("address")}
          />
          <Controller
            name="provider"
            control={control}
            render={({ field }) => (
              <SelectField
                label="Proveedor"
                required
                name={field.name}
                value={field.value}
                onChange={field.onChange}
                onBlur={field.onBlur}
                options={MAILBOX_PROVIDERS.map((value) => ({ value, label: value }))}
                state={stateOf("provider")}
                error={errors.provider?.message}
              />
            )}
          />
        </div>

        <TextField
          label="Nombre visible"
          placeholder="Ej. Calidad · reclamaciones"
          required
          state={stateOf("displayName")}
          error={errors.displayName?.message}
          hint="Cómo lo reconoce la operación en los listados, no el nombre técnico del proveedor."
          {...register("displayName")}
        />

        <Controller
          name="departmentId"
          control={control}
          render={({ field }) => (
            <SelectField
              label="Departamento"
              required
              name={field.name}
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
              placeholder="Elige uno"
              options={departments.map((department) => ({
                value: String(department.id),
                label: department.name,
              }))}
              state={stateOf("departmentId")}
              error={errors.departmentId?.message}
              hint="Los tickets que este buzón origine caen en la cola de este departamento."
            />
          )}
        />

        <TextField
          label="Referencia del secreto"
          placeholder="Ej. mailbox/calidad"
          required
          state={stateOf("secretRef")}
          error={errors.secretRef?.message}
          hint="Apunta a la credencial en la configuración protegida del servidor. La contraseña nunca se escribe aquí."
          {...register("secretRef")}
        />

        {isEdit && (
          <CheckboxField
            label="Activo"
            description="Si se desmarca, este buzón deja de sincronizarse."
            {...register("isActive")}
          />
        )}
      </form>
    </Modal>
  );
}
