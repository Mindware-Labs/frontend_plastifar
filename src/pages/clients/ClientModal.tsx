import { zodResolver } from "@hookform/resolvers/zod";
import {
  AlertCircle,
  Boxes,
  Landmark,
  Store,
  Truck,
} from "lucide-react";
import { useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { ApiError } from "../../api/client";
import { clientsApi } from "../../api/clients";
import { Alert } from "../../components/ui/Alert";
import {
  CheckboxField,
  LookupField,
  SelectField,
  TextAreaField,
  TextField,
  type FieldState,
} from "../../components/ui/Field";
import { FormDivider } from "../../components/ui/FormDivider";
import { Modal } from "../../components/ui/Modal";
import { ShortcutModalFooter } from "../../components/ui/ShortcutModalFooter";
import { useModalAnimation } from "../../hooks/useModalAnimation";
import { formatPhoneNumber } from "../../lib/format";
import { resolveStaffLabel, searchActiveStaff } from "../../lib/lookups";
import { fieldForServerError, type FieldRule } from "../../lib/serverFieldErrors";
import type { Client, ClientType, SaveClientRequest } from "../../types/clients";

/**
 * 4 tipos de cliente con micro-ícono y etiqueta compacta.
 */
const CLIENT_TYPES_ITEMS: { value: ClientType; label: string; icon: typeof Truck }[] = [
  { value: "Distribuidor", label: "Distribuidor", icon: Truck },
  { value: "Mayorista", label: "Mayorista", icon: Boxes },
  { value: "Detallista", label: "Detallista", icon: Store },
  { value: "Institucional", label: "Institucional", icon: Landmark },
];

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/;
const PHONE_CHARS_REGEX = /^[0-9+\s\-().extx]+$/i;

/**
 * Validación del cliente: el código ya no lo introduce el usuario,
 * se asigna automáticamente de forma secuencial.
 */
const schema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Al menos 2 caracteres")
    .max(160, "Máximo 160 caracteres"),
  taxId: z.string().trim().max(20, "Máximo 20 caracteres"),
  type: z.string().min(1, "Elige el tipo de cliente"),
  territoryId: z.string().min(1, "Elige el territorio"),
  salesRepStaffId: z.string(),
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
  email: z
    .string()
    .trim()
    .max(120, "Máximo 120 caracteres")
    .refine(
      (val) => !val || EMAIL_REGEX.test(val),
      "Correo electrónico inválido",
    ),
  address: z.string().trim().max(200, "Máximo 200 caracteres"),
  notes: z.string().trim().max(1000, "Máximo 1000 caracteres"),
  isActive: z.boolean(),
});

type FormValues = z.infer<typeof schema>;

const fieldRules: FieldRule<keyof FormValues>[] = [
  { field: "taxId", matches: ["rnc", "registro nacional"] },
  { field: "territoryId", matches: ["territorio"] },
  { field: "salesRepStaffId", matches: ["vendedor"] },
  { field: "email", matches: ["correo"] },
  { field: "phone", matches: ["telefono", "teléfono"] },
  { field: "address", matches: ["direccion", "dirección"] },
  { field: "notes", matches: ["nota", "observacion", "observación"] },
  { field: "type", matches: ["tipo"] },
  { field: "name", matches: ["nombre"] },
];

interface ClientModalProps {
  client?: Client;
  territories: { id: number; name: string; isActive: boolean }[];
  onClose: () => void;
  onSaved: (client: Client) => void;
}

export function ClientModal({ client, territories, onClose, onSaved }: ClientModalProps) {
  const isEdit = client !== undefined;
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
      name: client?.name ?? "",
      taxId: client?.taxId ?? "",
      type: client?.type ?? "Detallista",
      territoryId: client ? String(client.territoryId) : "",
      salesRepStaffId: client?.salesRepStaffId ? String(client.salesRepStaffId) : "",
      phone: client?.phone ? formatPhoneNumber(client.phone) : "",
      email: client?.email ?? "",
      address: client?.address ?? "",
      notes: client?.notes ?? "",
      isActive: client?.isActive ?? true,
    },
  });

  const notesValue = useWatch({ control, name: "notes" }) ?? "";

  function stateOf(field: keyof FormValues): FieldState {
    if (errors[field]) return "error";
    return touchedFields[field] ? "valid" : "idle";
  }

  async function onSubmit(values: FormValues) {
    setFormError(null);

    const taxId = values.taxId.trim();
    const request: SaveClientRequest = {
      code: isEdit ? client.code : undefined,
      name: values.name.trim(),
      taxId: taxId === "" ? null : taxId,
      type: values.type as ClientType,
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
      requestClose();
    } catch (err) {
      const field = fieldForServerError(err, fieldRules);
      if (field) {
        setError(field.field, { message: field.message });
        setFocus(field.field);
        return;
      }

      const fallback = isEdit ? "No se pudo guardar el cliente" : "No se pudo crear el cliente";
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
      eyebrow={isEdit ? `Cliente #${client.id} · ${client.code}` : "Código asignado automáticamente"}
      title={isEdit ? `Editar ${client.name}` : "Nuevo cliente"}
      description={
        isEdit
          ? "Actualiza los datos fiscales, comerciales o de contacto."
          : "El código se asignará de forma automática al guardar."
      }
      onClose={onClose}
      isExiting={isExiting}
      onRequestClose={requestClose}
      footer={
        <ShortcutModalFooter
          formId="client-form"
          isEdit={isEdit}
          createLabel="Crear cliente"
          isSubmitting={isSubmitting}
          onCancel={requestClose}
        />
      }
    >
      <form
        id="client-form"
        onSubmit={handleSubmit(onSubmit)}
        onKeyDown={handleKeyDown}
        noValidate
        className="flex flex-col gap-3 text-left"
      >
        {formError && <Alert variant="error">{formError}</Alert>}

        {/* 1. GENERAL */}
        <FormDivider title="Identificación" />

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          <div className="sm:col-span-2">
            <TextField
              size="sm"
              label="Nombre o razón social"
              placeholder="Nombre legal o comercial"
              required
              state={stateOf("name")}
              error={errors.name?.message}
              {...register("name")}
            />
          </div>
          <div>
            <TextField
              size="sm"
              label="RNC / Cédula"
              placeholder="Opcional"
              state={stateOf("taxId")}
              error={errors.taxId?.message}
              {...register("taxId")}
            />
          </div>
        </div>

        {/* 2. TIPO DE CLIENTE */}
        <Controller
          name="type"
          control={control}
          render={({ field }) => (
            <div className="flex flex-col gap-1">
              <label className="font-heading text-[11.5px] font-semibold text-faint">
                Tipo de cliente <span className="text-brand-red">*</span>
              </label>
              <div
                role="radiogroup"
                aria-label="Tipo de cliente"
                className="grid grid-cols-2 sm:grid-cols-4 gap-1 rounded-lg border border-zinc-200 bg-zinc-50/70 p-0.5"
              >
                {CLIENT_TYPES_ITEMS.map((item) => {
                  const isSelected = field.value === item.value;
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.value}
                      type="button"
                      role="radio"
                      aria-checked={isSelected}
                      onClick={() => field.onChange(item.value)}
                      className={`inline-flex h-7 items-center justify-center gap-1.5 rounded-md px-2 text-[12px] transition-all cursor-pointer select-none ${
                        isSelected
                          ? "border border-zinc-200 bg-white font-semibold text-zinc-900 shadow-2xs"
                          : "border border-transparent font-medium text-zinc-600 hover:text-zinc-900 hover:bg-white/50"
                      }`}
                    >
                      <Icon
                        className={`h-3 w-3 shrink-0 ${isSelected ? "text-brand-red" : "text-zinc-400"}`}
                      />
                      <span className="truncate">{item.label}</span>
                    </button>
                  );
                })}
              </div>
              {errors.type?.message && (
                <p
                  title={errors.type.message}
                  className="animate-plf-shake flex items-center gap-1 text-[11px] font-medium text-brand-red-dark leading-none truncate"
                >
                  <AlertCircle className="h-3 w-3 shrink-0" />
                  <span className="truncate">{errors.type.message}</span>
                </p>
              )}
            </div>
          )}
        />

        {/* 3. ASIGNACIÓN COMERCIAL */}
        <FormDivider title="Comercial" />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <Controller
            name="territoryId"
            control={control}
            render={({ field }) => (
              <SelectField
                size="sm"
                label="Territorio"
                required
                searchable
                name={field.name}
                value={field.value}
                onChange={field.onChange}
                onBlur={field.onBlur}
                placeholder="Elige un territorio…"
                options={territories
                  .filter((territory) => territory.isActive || String(territory.id) === field.value)
                  .map((territory) => ({ value: String(territory.id), label: territory.name }))}
                state={stateOf("territoryId")}
                error={errors.territoryId?.message}
              />
            )}
          />

          <Controller
            name="salesRepStaffId"
            control={control}
            render={({ field }) => (
              <LookupField
                size="sm"
                label="Vendedor asignado"
                name={field.name}
                value={field.value}
                onChange={(value) => field.onChange(value)}
                onBlur={field.onBlur}
                placeholder="Sin vendedor asignado"
                searchPlaceholder="Buscar vendedor…"
                clearLabel="Sin vendedor asignado"
                search={searchActiveStaff}
                resolveSelectedLabel={resolveStaffLabel}
                state={stateOf("salesRepStaffId")}
                error={errors.salesRepStaffId?.message}
              />
            )}
          />
        </div>

        {/* 4. CONTACTO Y UBICACIÓN */}
        <FormDivider title="Contacto" />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
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
          <TextField
            size="sm"
            label="Correo electrónico"
            type="email"
            placeholder="contacto@empresa.com"
            state={stateOf("email")}
            error={errors.email?.message}
            {...register("email")}
          />
        </div>

        <TextField
          size="sm"
          label="Dirección física"
          placeholder="Calle, número, sector o parque industrial"
          state={stateOf("address")}
          error={errors.address?.message}
          {...register("address")}
        />

        {/* 5. INTERNO */}
        <FormDivider title="Uso interno" />

        <TextAreaField
          id="client-notes"
          label="Notas internas"
          rows={2}
          className="text-[12.5px] py-1.5"
          placeholder="Observaciones de entrega, horarios de recepción, particularidades…"
          hint={
            <span className="flex items-center justify-between text-[11px] text-zinc-400">
              <span>Instrucciones operativas internas</span>
              <span
                className={`tabular-nums ${
                  notesValue.length > 900 ? "text-brand-red font-medium" : ""
                }`}
              >
                {notesValue.length} / 1000
              </span>
            </span>
          }
          error={errors.notes?.message}
          {...register("notes")}
        />

        {isEdit && (
          <CheckboxField
            label="Cliente activo"
            description="Si se desmarca, no se le pueden abrir nuevos tickets ni pedidos."
            {...register("isActive")}
          />
        )}
      </form>
    </Modal>
  );
}
