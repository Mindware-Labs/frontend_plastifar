import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { ApiError } from "../../api/client";
import { ticketsApi } from "../../api/tickets";
import { Alert } from "../../components/ui/Alert";
import { Button } from "../../components/ui/Button";
import { SelectField, TextField, type FieldState } from "../../components/ui/Field";
import { Modal } from "../../components/ui/Modal";
import { Spinner } from "../../components/ui/Spinner";
import { useModalAnimation } from "../../hooks/useModalAnimation";
import type {
  TicketContactOption,
  TicketCreateOptionsResponse,
  TicketSummaryResponse,
} from "../../types/api";

const schema = z
  .object({
    clientId: z.string().min(1, "Selecciona el cliente"),
    contactId: z.string().optional(),
    topicId: z.string().min(1, "Selecciona el motivo"),
    productLineId: z.string().optional(),
    subject: z
      .string()
      .trim()
      .min(3, "El asunto debe tener al menos 3 caracteres")
      .max(200, "El asunto no puede superar los 200 caracteres"),
    priority: z.string().min(1, "Selecciona la prioridad"),
    departmentId: z.string().min(1, "Selecciona el departamento"),
    assignedStaffId: z.string().optional(),
    initialMessage: z.string().optional(),
  });

type FormValues = z.infer<typeof schema>;

interface CreateTicketModalProps {
  onClose: () => void;
  onCreated: (ticket: TicketSummaryResponse) => void;
}

export function CreateTicketModal({ onClose, onCreated }: CreateTicketModalProps) {
  const [catalogs, setCatalogs] = useState<TicketCreateOptionsResponse | null>(null);
  const [loadingCatalogs, setLoadingCatalogs] = useState(true);
  const [catalogsError, setCatalogsError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const { isExiting, requestClose } = useModalAnimation(onClose);

  const {
    register,
    control,
    handleSubmit,
    setValue,
    watch,
    setError,
    formState: { errors, touchedFields, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    mode: "onTouched",
    defaultValues: {
      clientId: "",
      contactId: "",
      topicId: "",
      productLineId: "",
      subject: "",
      priority: "Normal",
      departmentId: "",
      assignedStaffId: "",
      initialMessage: "",
    },
  });

  const selectedClientId = watch("clientId");
  const selectedTopicId = watch("topicId");

  useEffect(() => {
    ticketsApi
      .createOptions()
      .then((data) => {
        setCatalogs(data);
        if (data.departments.length > 0) {
          setValue("departmentId", String(data.departments[0].id));
        }
      })
      .catch((err) => {
        setCatalogsError(err instanceof Error ? err.message : "Error al cargar catálogos");
      })
      .finally(() => setLoadingCatalogs(false));
  }, [setValue]);

  // Al cambiar de cliente, poblar y autoseleccionar contacto principal
  const selectedClient = catalogs?.clients.find((c) => String(c.id) === selectedClientId);
  const contactOptions: TicketContactOption[] = useMemo(
    () => selectedClient?.contacts ?? [],
    [selectedClient],
  );

  useEffect(() => {
    if (selectedClient && contactOptions.length > 0) {
      const primary = contactOptions.find((k) => k.isPrimary);
      setValue("contactId", primary ? String(primary.id) : String(contactOptions[0].id));
    } else {
      setValue("contactId", "");
    }
  }, [selectedClientId, selectedClient, contactOptions, setValue]);

  // Al cambiar de motivo, autoseleccionar departamento por defecto y prioridad
  const selectedTopic = catalogs?.topics.find((t) => String(t.id) === selectedTopicId);
  useEffect(() => {
    if (selectedTopic) {
      if (selectedTopic.defaultDepartmentId) {
        setValue("departmentId", String(selectedTopic.defaultDepartmentId));
      }
      if (selectedTopic.defaultPriority) {
        setValue("priority", selectedTopic.defaultPriority);
      }
    }
  }, [selectedTopic, setValue]);

  const requiresProductLine = Boolean(selectedTopic?.requiresProductLine);

  function stateOf(field: keyof FormValues): FieldState {
    if (errors[field]) return "error";
    return touchedFields[field] ? "valid" : "idle";
  }

  async function onSubmit(values: FormValues) {
    setFormError(null);

    if (requiresProductLine && !values.productLineId) {
      setError("productLineId", {
        message: `El motivo '${selectedTopic?.name}' exige indicar una línea de producto`,
      });
      return;
    }

    try {
      const created = await ticketsApi.create({
        clientId: Number(values.clientId),
        contactId: values.contactId ? Number(values.contactId) : null,
        topicId: Number(values.topicId),
        productLineId: values.productLineId ? Number(values.productLineId) : null,
        subject: values.subject.trim(),
        priority: values.priority,
        departmentId: Number(values.departmentId),
        assignedStaffId: values.assignedStaffId ? Number(values.assignedStaffId) : null,
        initialMessage: values.initialMessage?.trim() || null,
      });

      onCreated(created);
      requestClose();
    } catch (err) {
      if (err instanceof ApiError) {
        setFormError(err.message);
      } else {
        setFormError("Ocurrió un error inesperado al crear el ticket.");
      }
    }
  }

  return (
    <Modal
      isExiting={isExiting}
      onClose={requestClose}
      eyebrow="Bandeja de tickets"
      title="Nuevo ticket"
      description="Alta manual de ticket para dar seguimiento a una solicitud, consulta o reclamación."
    >
      {loadingCatalogs ? (
        <div className="flex justify-center py-12">
          <Spinner />
        </div>
      ) : catalogsError ? (
        <div className="py-4">
          <Alert variant="error">{catalogsError}</Alert>
        </div>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          {formError && <Alert variant="error">{formError}</Alert>}

          {/* Fila 1: Cliente y Contacto */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Controller
              control={control}
              name="clientId"
              render={({ field }) => (
                <SelectField
                  label="Cliente"
                  required
                  value={field.value}
                  onChange={field.onChange}
                  state={stateOf("clientId")}
                  error={errors.clientId?.message}
                  placeholder="Seleccionar cliente…"
                  options={(catalogs?.clients ?? []).map((c) => ({
                    value: String(c.id),
                    label: `${c.name} (${c.code})`,
                  }))}
                />
              )}
            />

            <Controller
              control={control}
              name="contactId"
              render={({ field }) => (
                <SelectField
                  label="Contacto del cliente"
                  value={field.value ?? ""}
                  onChange={field.onChange}
                  placeholder={
                    contactOptions.length === 0
                      ? "Sin contactos registrados"
                      : "Seleccionar persona de contacto…"
                  }
                  disabled={contactOptions.length === 0}
                  options={contactOptions.map((k) => ({
                    value: String(k.id),
                    label: `${k.fullName}${k.isPrimary ? " (Principal)" : ""}${
                      k.email ? ` · ${k.email}` : ""
                    }`,
                  }))}
                />
              )}
            />
          </div>

          {/* Fila 2: Motivo y Línea de Producto */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Controller
              control={control}
              name="topicId"
              render={({ field }) => (
                <SelectField
                  label="Motivo del ticket"
                  required
                  value={field.value}
                  onChange={field.onChange}
                  state={stateOf("topicId")}
                  error={errors.topicId?.message}
                  placeholder="Seleccionar motivo…"
                  options={(catalogs?.topics ?? []).map((t) => ({
                    value: String(t.id),
                    label: t.name,
                  }))}
                />
              )}
            />

            <Controller
              control={control}
              name="productLineId"
              render={({ field }) => (
                <SelectField
                  label="Línea de producto"
                  required={requiresProductLine}
                  value={field.value ?? ""}
                  onChange={field.onChange}
                  state={requiresProductLine && !field.value ? stateOf("productLineId") : "idle"}
                  error={errors.productLineId?.message}
                  placeholder="Seleccionar línea (opcional)…"
                  options={(catalogs?.productLines ?? []).map((pl) => ({
                    value: String(pl.id),
                    label: `${pl.name} (${pl.code})`,
                  }))}
                />
              )}
            />
          </div>

          {/* Fila 3: Asunto */}
          <TextField
            label="Asunto"
            required
            maxLength={200}
            placeholder="Resumen claro y conciso de la solicitud…"
            state={stateOf("subject")}
            error={errors.subject?.message}
            {...register("subject")}
          />

          {/* Fila 4: Prioridad, Departamento y Asignado */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Controller
              control={control}
              name="priority"
              render={({ field }) => (
                <SelectField
                  label="Prioridad"
                  required
                  value={field.value}
                  onChange={field.onChange}
                  options={[
                    { value: "Emergencia", label: "Emergencia" },
                    { value: "Alta", label: "Alta" },
                    { value: "Normal", label: "Normal" },
                    { value: "Baja", label: "Baja" },
                  ]}
                />
              )}
            />

            <Controller
              control={control}
              name="departmentId"
              render={({ field }) => (
                <SelectField
                  label="Departamento"
                  required
                  value={field.value}
                  onChange={field.onChange}
                  options={(catalogs?.departments ?? []).map((d) => ({
                    value: String(d.id),
                    label: d.name,
                  }))}
                />
              )}
            />

            <Controller
              control={control}
              name="assignedStaffId"
              render={({ field }) => (
                <SelectField
                  label="Asignar a"
                  value={field.value ?? ""}
                  onChange={field.onChange}
                  placeholder="Sin asignar (en cola)"
                  options={(catalogs?.assignableStaff ?? []).map((s) => ({
                    value: String(s.id),
                    label: s.fullName,
                  }))}
                />
              )}
            />
          </div>

          {/* Fila 5: Mensaje inicial o descripción */}
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="ticket-initial-message"
              className="font-heading text-[10.5px] font-semibold uppercase tracking-[0.08em] text-faint"
            >
              Mensaje inicial o descripción de la incidencia
            </label>
            <textarea
              id="ticket-initial-message"
              rows={3}
              placeholder="Detalles proporcionados por el cliente, notas de la llamada o antecedentes del caso…"
              className="w-full rounded-[2px] border border-line bg-surface px-3 py-2 text-[13px] text-ink placeholder:text-zinc-400 focus:border-brand-red focus:outline-none"
              {...register("initialMessage")}
            />
          </div>

          {/* Pie de diálogo con acciones */}
          <div className="mt-2 flex items-center justify-end gap-2.5 border-t border-line pt-3">
            <Button type="button" variant="secondary" onClick={requestClose} disabled={isSubmitting}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Spinner size="sm" />
                  <span>Creando…</span>
                </>
              ) : (
                "Crear ticket"
              )}
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}
