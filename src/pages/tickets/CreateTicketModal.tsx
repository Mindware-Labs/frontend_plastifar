import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { createPortal } from "react-dom";
import { z } from "zod";
import {
  Building2,
  CheckCircle2,
  Info,
  Mail,
  RotateCcw,
  Tag,
  Ticket as TicketIcon,
  X,
} from "lucide-react";
import { ApiError } from "../../api/client";
import { ticketsApi } from "../../api/tickets";
import { Alert } from "../../components/ui/Alert";
import { Button } from "../../components/ui/Button";
import { SelectField, TextField, type FieldState } from "../../components/ui/Field";
import { Spinner } from "../../components/ui/Spinner";
import { useDialogBehavior } from "../../hooks/useDialogBehavior";
import { useModalAnimation } from "../../hooks/useModalAnimation";
import type {
  TicketContactOption,
  TicketCreateOptionsResponse,
  TicketSummaryResponse,
} from "../../types/api";

const schema = z.object({
  clientId: z.string().optional(),
  contactId: z.string().optional(),
  topicId: z.string().optional(),
  productLineId: z.string().optional(),
  subject: z
    .string()
    .trim()
    .min(3, "El asunto debe tener al menos 3 caracteres")
    .max(200, "El asunto no puede superar los 200 caracteres"),
  priority: z.string().optional(),
  departmentId: z.string().optional(),
  assignedStaffId: z.string().optional(),
  initialMessage: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

interface CreateTicketModalProps {
  onClose: () => void;
  onCreated: (ticket: TicketSummaryResponse) => void;
  emailId?: number;
  initialSubject?: string;
  initialMessage?: string;
  initialClientId?: number;
  senderEmail?: string;
  senderName?: string;
  initialAssignedStaffId?: number | null;
}

const PRIORITIES = [
  {
    value: "Baja",
    label: "Baja",
    desc: "Rutinario",
    dot: "bg-zinc-400",
    activeClass: "border-zinc-400 bg-zinc-100 text-zinc-800 shadow-2xs font-semibold ring-1 ring-zinc-400/40",
  },
  {
    value: "Normal",
    label: "Normal",
    desc: "SLA Estándar",
    dot: "bg-blue-500",
    activeClass: "border-blue-500 bg-blue-50 text-blue-900 shadow-2xs font-semibold ring-1 ring-blue-500/40",
  },
  {
    value: "Alta",
    label: "Alta",
    desc: "Prioritario",
    dot: "bg-amber-500",
    activeClass: "border-amber-500 bg-amber-50 text-amber-950 shadow-2xs font-semibold ring-1 ring-amber-500/40",
  },
  {
    value: "Emergencia",
    label: "Emergencia",
    desc: "Inmediato",
    dot: "bg-brand-red",
    activeClass: "border-brand-red bg-rose-50 text-brand-red shadow-2xs font-semibold ring-1 ring-brand-red/40",
  },
] as const;

const FORM_ID = "create-ticket-form";

export function CreateTicketModal({
  onClose,
  onCreated,
  emailId,
  initialSubject,
  initialMessage,
  initialClientId,
  senderEmail,
  senderName,
  initialAssignedStaffId,
}: CreateTicketModalProps) {
  const [catalogs, setCatalogs] = useState<TicketCreateOptionsResponse | null>(null);
  const [loadingCatalogs, setLoadingCatalogs] = useState(true);
  const [catalogsError, setCatalogsError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [detectedMatch, setDetectedMatch] = useState<{ clientName: string; contactName: string } | null>(null);
  const { isExiting, requestClose } = useModalAnimation(onClose, 220);

  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  useDialogBehavior(panelRef, requestClose);

  const {
    register,
    control,
    handleSubmit,
    setValue,
    getValues,
    watch,
    setError,
    formState: { errors, touchedFields, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    mode: "onTouched",
    defaultValues: {
      clientId: initialClientId ? String(initialClientId) : "",
      contactId: "",
      topicId: "",
      productLineId: "",
      subject: initialSubject ?? "",
      priority: "Normal",
      departmentId: "",
      assignedStaffId: initialAssignedStaffId ? String(initialAssignedStaffId) : "",
      initialMessage: initialMessage ?? "",
    },
  });

  const selectedClientId = watch("clientId");
  const selectedTopicId = watch("topicId");
  const selectedPriority = watch("priority") || "Normal";
  const currentSubject = watch("subject") || "";
  const currentMessage = watch("initialMessage") || "";

  useEffect(() => {
    ticketsApi
      .createOptions()
      .then((data) => {
        setCatalogs(data);

        // Si viene de un correo y no se especificó un cliente explícito,
        // intentamos identificar si el remitente coincide con un contacto existente
        if (senderEmail && !initialClientId && data.clients.length > 0) {
          const searchEmail = senderEmail.toLowerCase().trim();
          for (const client of data.clients) {
            const matchedContact = client.contacts.find(
              (c) => c.email?.toLowerCase().trim() === searchEmail
            );
            if (matchedContact) {
              setValue("clientId", String(client.id));
              setValue("contactId", String(matchedContact.id));
              setDetectedMatch({
                clientName: `${client.name} (${client.code})`,
                contactName: matchedContact.fullName,
              });
              break;
            }
          }
        }
      })
      .catch((err) => {
        setCatalogsError(err instanceof Error ? err.message : "Error al cargar catálogos");
      })
      .finally(() => setLoadingCatalogs(false));
  }, [senderEmail, initialClientId, setValue]);

  // Al cambiar de cliente, poblar contactos
  const selectedClient = catalogs?.clients.find((c) => String(c.id) === selectedClientId);
  const contactOptions: TicketContactOption[] = useMemo(
    () => selectedClient?.contacts ?? [],
    [selectedClient],
  );

  useEffect(() => {
    if (selectedClient && contactOptions.length > 0) {
      // Si el contacto ya pertenece al nuevo cliente, mantenerlo; sino autoseleccionar
      const currentContactId = getValues("contactId");
      const exists = contactOptions.some((k) => String(k.id) === currentContactId);
      if (!exists) {
        const primary = contactOptions.find((k) => k.isPrimary);
        setValue("contactId", primary ? String(primary.id) : String(contactOptions[0].id));
      }
    } else if (!selectedClientId) {
      setValue("contactId", "");
    }
  }, [selectedClientId, selectedClient, contactOptions, setValue, getValues]);

  // Al cambiar de motivo, sugerir departamento por defecto y prioridad si están definidos
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

  function handleClearClient() {
    setValue("clientId", "");
    setValue("contactId", "");
    setDetectedMatch(null);
  }

  function handleResetMessage() {
    setValue("initialMessage", initialMessage ?? "");
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
        clientId: values.clientId ? Number(values.clientId) : null,
        contactId: values.contactId ? Number(values.contactId) : null,
        topicId: values.topicId ? Number(values.topicId) : null,
        productLineId: values.productLineId ? Number(values.productLineId) : null,
        subject: values.subject.trim(),
        priority: values.priority || "Normal",
        departmentId: values.departmentId ? Number(values.departmentId) : null,
        assignedStaffId: values.assignedStaffId ? Number(values.assignedStaffId) : null,
        initialMessage: values.initialMessage?.trim() || null,
        emailId: emailId ?? null,
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

  return createPortal(
    <div
      inert={isExiting ? true : undefined}
      className={`fixed inset-0 z-50 flex justify-end bg-ink/45 backdrop-blur-[2px] transition-opacity ${
        isExiting ? "animate-plf-scrim-out pointer-events-none" : "animate-plf-scrim-in"
      }`}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !isExiting) requestClose();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        className={`relative flex h-full w-full flex-col bg-white shadow-[0_4px_32px_rgba(27,27,29,0.22)]
          sm:w-[620px] md:w-[700px] lg:w-[760px]
          ${isExiting ? "animate-plf-drawer-out pointer-events-none" : "animate-plf-drawer-in"}`}
      >
        {/* Cabecera del Sheet */}
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-line bg-canvas/80 px-6 py-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-edge bg-brand-red/10 text-brand-red">
              <TicketIcon className="h-5 w-5" />
            </div>
            <div>
              <h2 id={titleId} className="font-heading text-[16px] font-bold tracking-[-0.01em] text-ink">
                {emailId ? "Convertir correo a ticket" : "Nuevo ticket"}
              </h2>
              <p id={descriptionId} className="mt-0.5 max-w-[48ch] text-[12px] leading-relaxed text-subtle">
                {emailId
                  ? "Se creará un ticket oficial vinculado a esta conversación de correo. Todos los campos de clasificación son opcionales."
                  : "Alta manual de ticket para dar seguimiento a una solicitud, consulta o incidencia."}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={requestClose}
            aria-label="Cerrar"
            title="Cerrar (Esc)"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-edge text-brand-gray outline-none
              transition-colors hover:bg-fill hover:text-ink focus-visible:ring-3 focus-visible:ring-brand-red/20"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Cuerpo del Sheet */}
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
          {loadingCatalogs ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 py-16 text-center">
              <Spinner size="md" />
              <p className="text-xs font-medium text-subtle">Cargando catálogos del sistema…</p>
            </div>
          ) : catalogsError ? (
            <div className="p-6">
              <Alert variant="error">{catalogsError}</Alert>
            </div>
          ) : (
            <form
              id={FORM_ID}
              onSubmit={handleSubmit(onSubmit)}
              onKeyDown={(e) => {
                if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                  e.preventDefault();
                  void handleSubmit(onSubmit)();
                }
              }}
              className="flex flex-1 flex-col gap-5 px-6 py-5"
            >
              {formError && <Alert variant="error">{formError}</Alert>}

              {/* Contexto del Correo (cuando se invoca desde la bandeja) */}
              {emailId && (
                <div className="rounded-edge border border-line bg-canvas/70 p-3.5">
                  <div className="flex items-start gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-edge bg-brand-red/10 text-brand-red">
                      <Mail className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="truncate text-xs font-semibold text-ink">
                          {senderName || senderEmail || "Correo entrante"}
                        </span>
                        <span className="inline-flex items-center rounded-edge border border-line-soft bg-white px-1.5 py-0.5 text-[10.5px] font-medium text-subtle shadow-2xs">
                          Canal: Correo
                        </span>
                      </div>
                      {senderEmail && (
                        <p className="truncate text-[11.5px] text-subtle">
                          Remitente: <span className="font-mono text-ink">{senderEmail}</span>
                        </p>
                      )}
                      <p className="text-[11px] text-faint">
                        Toda respuesta futura de esta conversación quedará vinculada automáticamente a este caso.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Asunto: campo protagonista, en su propia línea */}
              <TextField
                id="ticket-subject"
                label="Asunto del ticket"
                required
                maxLength={200}
                hint={
                  <span className="flex items-center justify-between text-[11px] text-faint">
                    <span>Resumen claro y conciso de la solicitud.</span>
                    <span className="font-mono">{currentSubject.length}/200</span>
                  </span>
                }
                placeholder="Ej: Solicitud de cotización de empaques biodegradables…"
                state={stateOf("subject")}
                error={errors.subject?.message}
                {...register("subject")}
              />

              {/* Prioridad, debajo del asunto */}
              <div className="flex flex-col gap-1.5">
                <label className="font-heading text-[11.5px] font-semibold text-faint">
                  Nivel de prioridad
                </label>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {PRIORITIES.map((p) => {
                    const isSelected = selectedPriority === p.value;
                    return (
                      <button
                        key={p.value}
                        type="button"
                        onClick={() => setValue("priority", p.value, { shouldValidate: true })}
                        className={`flex flex-col items-start gap-0.5 rounded-edge border p-2.5 text-left transition-all cursor-pointer ${
                          isSelected
                            ? p.activeClass
                            : "border-line bg-white text-subtle hover:border-line-strong hover:bg-canvas"
                        }`}
                      >
                        <span className="flex items-center gap-1.5">
                          <span className={`h-2 w-2 shrink-0 rounded-full ${p.dot}`} />
                          <span className="text-xs font-semibold">{p.label}</span>
                        </span>
                        <span className="text-[10.5px] text-faint">{p.desc}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Clasificación: Motivo, Departamento y Responsable */}
              <div className="space-y-3.5 rounded-edge border border-line-soft bg-canvas/40 p-4">
                <div className="flex items-center justify-between">
                  <h4 className="flex items-center gap-1.5 font-heading text-[11px] font-bold uppercase tracking-[0.08em] text-ink">
                    <Tag className="h-3.5 w-3.5 text-brand-red" />
                    Clasificación y enrutamiento
                  </h4>
                  <span className="text-[10.5px] text-faint">Opcional</span>
                </div>

                <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
                  <Controller
                    control={control}
                    name="topicId"
                    render={({ field }) => (
                      <SelectField
                        label="Motivo del ticket"
                        size="sm"
                        value={field.value ?? ""}
                        onChange={field.onChange}
                        state={stateOf("topicId")}
                        error={errors.topicId?.message}
                        placeholder="— Sin motivo asignado —"
                        options={[
                          { value: "", label: "— Sin motivo (opcional) —" },
                          ...(catalogs?.topics ?? []).map((t) => ({
                            value: String(t.id),
                            label: t.name,
                          })),
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
                        size="sm"
                        value={field.value ?? ""}
                        onChange={field.onChange}
                        placeholder="— Sin departamento asignado —"
                        options={[
                          { value: "", label: "— Sin departamento (opcional) —" },
                          ...(catalogs?.departments ?? []).map((d) => ({
                            value: String(d.id),
                            label: d.name,
                          })),
                        ]}
                      />
                    )}
                  />
                </div>

                <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
                  <Controller
                    control={control}
                    name="assignedStaffId"
                    render={({ field }) => (
                      <SelectField
                        label="Asignar a colaborador"
                        size="sm"
                        value={field.value ?? ""}
                        onChange={field.onChange}
                        placeholder="— Sin asignar (en cola general) —"
                        options={[
                          { value: "", label: "— Sin asignar (en cola) —" },
                          ...(catalogs?.assignableStaff ?? []).map((s) => ({
                            value: String(s.id),
                            label: s.fullName,
                          })),
                        ]}
                      />
                    )}
                  />

                  <Controller
                    control={control}
                    name="productLineId"
                    render={({ field }) => (
                      <SelectField
                        label={requiresProductLine ? "Línea de producto *" : "Línea de producto"}
                        size="sm"
                        required={requiresProductLine}
                        value={field.value ?? ""}
                        onChange={field.onChange}
                        state={requiresProductLine && !field.value ? stateOf("productLineId") : "idle"}
                        error={errors.productLineId?.message}
                        placeholder="— Seleccionar línea —"
                        options={[
                          { value: "", label: "— Ninguna línea —" },
                          ...(catalogs?.productLines ?? []).map((pl) => ({
                            value: String(pl.id),
                            label: `${pl.name} (${pl.code})`,
                          })),
                        ]}
                      />
                    )}
                  />
                </div>
              </div>

              {/* Vinculación de Cliente & Contacto */}
              <div className="space-y-3 rounded-edge border border-line-soft bg-canvas/40 p-4">
                <div className="flex items-center justify-between">
                  <h4 className="flex items-center gap-1.5 font-heading text-[11px] font-bold uppercase tracking-[0.08em] text-ink">
                    <Building2 className="h-3.5 w-3.5 text-brand-red" />
                    Cliente y contacto comercial
                  </h4>
                  {selectedClientId ? (
                    <button
                      type="button"
                      onClick={handleClearClient}
                      className="text-[11px] font-medium text-brand-red hover:underline cursor-pointer"
                    >
                      Quitar cliente
                    </button>
                  ) : (
                    <span className="text-[10.5px] text-faint">Opcional</span>
                  )}
                </div>

                {detectedMatch && (
                  <div className="flex items-center justify-between gap-2 rounded-edge border border-emerald-200 bg-emerald-50/60 px-3 py-1.5 text-xs text-emerald-900">
                    <div className="flex min-w-0 items-center gap-2">
                      <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
                      <span className="truncate">
                        Identificado por remitente: <strong>{detectedMatch.clientName}</strong> · {detectedMatch.contactName}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={handleClearClient}
                      className="shrink-0 text-[10.5px] font-semibold text-emerald-700 hover:underline cursor-pointer"
                    >
                      Desvincular
                    </button>
                  </div>
                )}

                <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
                  <Controller
                    control={control}
                    name="clientId"
                    render={({ field }) => (
                      <SelectField
                        label="Cliente registrado"
                        size="sm"
                        value={field.value ?? ""}
                        onChange={field.onChange}
                        state={stateOf("clientId")}
                        error={errors.clientId?.message}
                        placeholder="— Sin cliente asociado —"
                        options={[
                          { value: "", label: "— Sin cliente asociado —" },
                          ...(catalogs?.clients ?? []).map((c) => ({
                            value: String(c.id),
                            label: `${c.name} (${c.code})`,
                          })),
                        ]}
                      />
                    )}
                  />

                  <Controller
                    control={control}
                    name="contactId"
                    render={({ field }) => (
                      <SelectField
                        label="Contacto del cliente"
                        size="sm"
                        value={field.value ?? ""}
                        onChange={field.onChange}
                        placeholder={
                          contactOptions.length === 0
                            ? "Sin contactos registrados"
                            : "— Sin contacto específico —"
                        }
                        disabled={contactOptions.length === 0}
                        options={[
                          { value: "", label: "— Sin contacto específico —" },
                          ...contactOptions.map((k) => ({
                            value: String(k.id),
                            label: `${k.fullName}${k.isPrimary ? " (Principal)" : ""}${
                              k.email ? ` · ${k.email}` : ""
                            }`,
                          })),
                        ]}
                      />
                    )}
                  />
                </div>

                {!selectedClientId && (
                  <p className="flex items-center gap-1.5 text-[11px] text-faint">
                    <Info className="h-3 w-3 shrink-0" />
                    Si no seleccionas un cliente registrado, el ticket se tramitará con los datos de contacto del solicitante {senderEmail ? `(${senderEmail})` : ""}.
                  </p>
                )}
              </div>

              {/* Mensaje Inicial / Descripción */}
              <div className="flex flex-1 flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <label
                    htmlFor="ticket-initial-message"
                    className="font-heading text-[11.5px] font-semibold text-ink"
                  >
                    Mensaje inicial / Descripción de la incidencia
                    <span className="ml-1 font-normal text-faint">(Opcional)</span>
                  </label>
                  {initialMessage && currentMessage !== initialMessage && (
                    <button
                      type="button"
                      onClick={handleResetMessage}
                      className="inline-flex items-center gap-1 text-[11px] text-brand-red hover:underline cursor-pointer"
                    >
                      <RotateCcw className="h-3 w-3" />
                      Restaurar texto original
                    </button>
                  )}
                </div>
                <textarea
                  id="ticket-initial-message"
                  rows={6}
                  placeholder="Detalles de la incidencia, antecedentes o instrucciones para el equipo que atenderá el caso…"
                  className="w-full min-h-[140px] flex-1 resize-none rounded-edge border border-line bg-white px-3 py-2.5 text-[12.5px] leading-relaxed text-ink placeholder:text-zinc-400 focus:border-brand-red focus:ring-2 focus:ring-brand-red/15 focus:outline-none transition-all"
                  {...register("initialMessage")}
                />
                <p className="text-[11px] text-faint">
                  Este texto quedará registrado como el primer mensaje del historial del ticket.
                </p>
              </div>
            </form>
          )}
        </div>

        {/* Pie de Acciones del Sheet */}
        <div className="flex shrink-0 items-center justify-between gap-3 border-t border-line bg-canvas/90 px-6 py-3.5">
          <span className="hidden items-center gap-1.5 text-[11.5px] text-faint sm:flex">
            <kbd className="rounded-edge border border-line bg-white px-1.5 py-0.5 font-mono text-[10px] text-brand-gray shadow-2xs">
              Ctrl
            </kbd>
            +
            <kbd className="rounded-edge border border-line bg-white px-1.5 py-0.5 font-mono text-[10px] text-brand-gray shadow-2xs">
              Enter
            </kbd>
            <span>para crear</span>
          </span>
          <div className="ml-auto flex items-center gap-2.5">
            <Button type="button" variant="secondary" onClick={requestClose} disabled={isSubmitting}>
              Cancelar
            </Button>
            <Button
              type="submit"
              form={FORM_ID}
              isLoading={isSubmitting}
              disabled={isSubmitting || loadingCatalogs || Boolean(catalogsError)}
            >
              {isSubmitting ? "Creando ticket…" : "Crear ticket"}
            </Button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
