import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { ApiError } from "../../api/client";
import { clientsApi } from "../../api/clients";
import { Alert } from "../../components/ui/Alert";
import { Button } from "../../components/ui/Button";
import {
  CheckboxField,
  SelectField,
  TextAreaField,
  TextField,
  type FieldState,
} from "../../components/ui/Field";
import { Modal } from "../../components/ui/Modal";
import { CLIENT_TYPES, type Client } from "../../types/clients";

/**
 * Espejo de la validacion del servidor en POST/PUT /api/clients
 * (ClientsController.ValidateAsync): codigo 2-20, nombre 2-160, correo valido
 * si viene, RNC hasta 20 caracteres, territorio existente y vendedor activo.
 */
const schema = z.object({
  code: z.string().trim().min(2, "Al menos 2 caracteres").max(20, "Máximo 20 caracteres"),
  name: z.string().trim().min(2, "Al menos 2 caracteres").max(160, "Máximo 160 caracteres"),
  taxId: z.string().trim().max(20, "Máximo 20 caracteres"),
  type: z.string().min(1, "Elige el tipo de cliente"),
  territoryId: z.string().min(1, "Elige el territorio"),
  salesRepStaffId: z.string(),
  phone: z.string().trim().max(30, "Máximo 30 caracteres"),
  email: z.string().trim().max(120, "Máximo 120 caracteres").email("Formato de correo inválido, revisa el @ y el dominio").or(z.literal("")),
  address: z.string().trim().max(200, "Máximo 200 caracteres"),
  notes: z.string().trim().max(1000, "Máximo 1000 caracteres"),
  isActive: z.boolean(),
});

type FormValues = z.infer<typeof schema>;

interface ClientModalProps {
  client?: Client;
  territories: { id: number; name: string; isActive: boolean }[];
  salesReps: { id: number; name: string }[];
  onClose: () => void;
  onSaved: (client: Client) => void;
}

export function ClientModal({ client, territories, salesReps, onClose, onSaved }: ClientModalProps) {
  const isEdit = client !== undefined;
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
      code: client?.code ?? "",
      name: client?.name ?? "",
      taxId: client?.taxId ?? "",
      type: client?.type ?? "Detallista",
      territoryId: client ? String(client.territoryId) : "",
      salesRepStaffId: client?.salesRepStaffId ? String(client.salesRepStaffId) : "",
      phone: client?.phone ?? "",
      email: client?.email ?? "",
      address: client?.address ?? "",
      notes: client?.notes ?? "",
      isActive: client?.isActive ?? true,
    },
  });

  function stateOf(field: keyof FormValues): FieldState {
    if (errors[field]) return "error";
    return touchedFields[field] ? "valid" : "idle";
  }

  async function onSubmit(values: FormValues) {
    setFormError(null);

    const taxId = values.taxId.trim();
    const request = {
      code: values.code.trim(),
      name: values.name.trim(),
      taxId: taxId === "" ? null : taxId,
      type: values.type as Client["type"],
      territoryId: Number(values.territoryId),
      salesRepStaffId: values.salesRepStaffId === "" ? null : Number(values.salesRepStaffId),
      phone: values.phone.trim() === "" ? null : values.phone.trim(),
      email: values.email.trim() === "" ? null : values.email.trim(),
      address: values.address.trim() === "" ? null : values.address.trim(),
      notes: values.notes.trim() === "" ? null : values.notes.trim(),
      isActive: values.isActive,
    };

    try {
      const saved = isEdit ? await clientsApi.update(client.id, request) : await clientsApi.create(request);
      onSaved(saved);
      onClose();
    } catch (err) {
      // 409 de codigo o RNC duplicado: se marca en su campo, no en un aviso
      // general que obliga a adivinar cual es (seccion 4.2).
      if (err instanceof ApiError && err.status === 409) {
        if (err.message.toLowerCase().includes("rnc")) {
          setError("taxId", { message: err.message });
          setFocus("taxId");
        } else {
          setError("code", { message: err.message });
          setFocus("code");
        }
        return;
      }

      const fallback = isEdit ? "No se pudo guardar el cliente" : "No se pudo crear el cliente";
      setFormError(err instanceof ApiError ? err.message : fallback);
    }
  }

  return (
    <Modal
      title={isEdit ? "Editar cliente" : "Nuevo cliente"}
      description="La organización a la que Plastifar factura, y la base de todo ticket que se le abra."
      onClose={onClose}
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" form="client-form" isLoading={isSubmitting}>
            {isEdit ? "Guardar cambios" : "Crear cliente"}
          </Button>
        </>
      }
    >
      <form id="client-form" onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
        {formError && <Alert variant="error">{formError}</Alert>}

        <div className="grid grid-cols-2 gap-3">
          <TextField
            label="Código"
            placeholder="Ej. CL-0006"
            required
            state={stateOf("code")}
            error={errors.code?.message}
            {...register("code")}
          />
          <TextField
            label="RNC"
            placeholder="Opcional"
            state={stateOf("taxId")}
            error={errors.taxId?.message}
            {...register("taxId")}
          />
        </div>

        <TextField
          label="Nombre"
          placeholder="Razón social o nombre comercial"
          required
          state={stateOf("name")}
          error={errors.name?.message}
          {...register("name")}
        />

        <div className="grid grid-cols-2 gap-3">
          <Controller
            name="type"
            control={control}
            render={({ field }) => (
              <SelectField
                label="Tipo"
                required
                name={field.name}
                value={field.value}
                onChange={field.onChange}
                onBlur={field.onBlur}
                options={CLIENT_TYPES.map((value) => ({ value, label: value }))}
                state={stateOf("type")}
                error={errors.type?.message}
              />
            )}
          />

          <Controller
            name="territoryId"
            control={control}
            render={({ field }) => (
              <SelectField
                label="Territorio"
                required
                name={field.name}
                value={field.value}
                onChange={field.onChange}
                onBlur={field.onBlur}
                placeholder="Elige uno"
                options={territories
                  .filter((territory) => territory.isActive || String(territory.id) === field.value)
                  .map((territory) => ({ value: String(territory.id), label: territory.name }))}
                state={stateOf("territoryId")}
                error={errors.territoryId?.message}
                hint="Alimenta el ranking comercial por zona."
              />
            )}
          />
        </div>

        <Controller
          name="salesRepStaffId"
          control={control}
          render={({ field }) => (
            <SelectField
              label="Vendedor"
              name={field.name}
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
              placeholder="Sin vendedor asignado"
              options={[
                { value: "", label: "Sin vendedor asignado" },
                ...salesReps.map((rep) => ({ value: String(rep.id), label: rep.name })),
              ]}
              state={stateOf("salesRepStaffId")}
              error={errors.salesRepStaffId?.message}
            />
          )}
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
            label="Correo"
            type="email"
            placeholder="Opcional"
            state={stateOf("email")}
            error={errors.email?.message}
            {...register("email")}
          />
        </div>

        <TextField
          label="Dirección"
          placeholder="Opcional"
          state={stateOf("address")}
          error={errors.address?.message}
          {...register("address")}
        />

        {/* Por el componente compartido, no a mano: es el que trae id,
            aria-describedby, aria-invalid y —sobre todo— el hueco donde se
            imprime el tope de 1000 caracteres que declara el esquema. */}
        <TextAreaField
          label="Notas internas"
          placeholder="Observaciones que no ve el cliente"
          error={errors.notes?.message}
          {...register("notes")}
        />

        {isEdit && (
          <CheckboxField
            label="Activo"
            description="Si se desmarca, no se le pueden abrir tickets nuevos."
            {...register("isActive")}
          />
        )}
      </form>
    </Modal>
  );
}
