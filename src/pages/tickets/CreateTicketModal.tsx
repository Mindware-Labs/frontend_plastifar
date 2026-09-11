import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useId, useMemo, useRef, useState, type ComponentType, type ReactNode } from "react";
import { Controller, useForm } from "react-hook-form";
import { createPortal } from "react-dom";
import { z } from "zod";
import { Building2, Check, Flag, Info, Mail, MessageSquareText, RotateCcw, Tag, X } from "lucide-react";
import { ApiError } from "../../api/client";
import { ticketsApi } from "../../api/tickets";
import { Alert } from "../../components/ui/Alert";
import { Button } from "../../components/ui/Button";
import { SelectField, TextField, type FieldState } from "../../components/ui/Field";
import { controlBase, stateClasses } from "../../components/ui/fieldStyles";
import { Spinner } from "../../components/ui/Spinner";
import { useDialogBehavior } from "../../hooks/useDialogBehavior";
import { useDialogMotion } from "../../hooks/useDialogMotion";
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

/** Como en la tabla de tickets: solo Alta y Emergencia llevan color, lo demás va en neutro. */
const PRIORITIES = [
  {
    value: "Baja",
    label: "Baja",
    desc: "Rutinario",
    dot: "bg-zinc-300",
  },
  {
    value: "Normal",
    label: "Normal",
    desc: "SLA estándar",
    dot: "bg-zinc-500",
  },
  {
    value: "Alta",
    label: "Alta",
    desc: "Prioritario",
    dot: "bg-amber-500",
  },
  {
    value: "Emergencia",
    label: "Emergencia",
    desc: "Inmediato",
    dot: "bg-brand-red",
  },
] as const;

const FORM_ID = "create-ticket-form";

/**
 * Los correos en texto plano suelen venir con saltos de linea forzados cada
 * ~70-80 caracteres (formato clasico de cliente de correo). Si se pegan tal
 * cual en el textarea, cada salto corta el parrafo aunque sobre ancho: el
 * cuadro nunca aprovecha su ancho real. Se reconstruyen los parrafos uniendo
 * lineas sueltas con espacio y conservando solo los saltos entre parrafos
 * (linea en blanco), para que el textarea vuelva a ajustar el texto solo.
 */
function reflowPlainText(text: string): string {
  return text
    .replace(/\r\n/g, "\n")
    .split(/\n{2,}/)
    .map((paragraph) =>
      paragraph
        .split("\n")
        .map((line) => line.trim())
        .join(" ")
        .trim(),
    )
    .join("\n\n");
}

/** Crece o encoge con el contenido: nunca queda con scroll propio. */
function autoResizeTextarea(textarea: HTMLTextAreaElement | null) {
  if (!textarea) return;
  textarea.style.height = "auto";
  const borderOffset = textarea.offsetHeight - textarea.clientHeight;
  textarea.style.height = `${Math.max(textarea.scrollHeight + borderOffset, 96)}px`;
}

interface SectionHeadingProps {
  icon: ComponentType<{ className?: string; strokeWidth?: number }>;
  title: string;
  /** Nota o acción a la derecha: "Opcional", "Quitar cliente", "Restaurar". */
  aside?: ReactNode;
  htmlFor?: string;
}

/** Cabecera de sección: sello con el glifo y título en versalitas, como el chip de ticket. */
function SectionHeading({ icon: Icon, title, aside, htmlFor }: SectionHeadingProps) {
  const content = (
    <>
      <span
        aria-hidden
        className="flex size-5 shrink-0 items-center justify-center rounded-md bg-brand-red/10 text-brand-red"
      >
        <Icon className="size-3" strokeWidth={2.25} />
      </span>
      <span className="font-heading text-[10.5px] font-bold uppercase tracking-[0.08em] text-ink">{title}</span>
    </>
  );

  return (
    <div className="flex h-5 items-center justify-between gap-3">
      {htmlFor ? (
        <label htmlFor={htmlFor} className="flex cursor-pointer items-center gap-2">
          {content}
        </label>
      ) : (
        <div className="flex items-center gap-2">{content}</div>
      )}
      {aside && <span className="text-[11px] text-zinc-400">{aside}</span>}
    </div>
  );
}

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
  const { isExiting, requestClose, scrimRef, panelRef } = useDialogMotion(onClose, { variant: "drawer" });

  const normalizedInitialMessage = useMemo(
    () => (initialMessage ? reflowPlainText(initialMessage) : ""),
    [initialMessage],
  );

  const messageTextareaRef = useRef<HTMLTextAreaElement | null>(null);
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
      initialMessage: normalizedInitialMessage,
    },
  });

  const selectedClientId = watch("clientId");
  const selectedTopicId = watch("topicId");
  const selectedPriority = watch("priority") || "Normal";
  const currentSubject = watch("subject") || "";
  const currentMessage = watch("initialMessage") || "";
  const initialMessageField = register("initialMessage");

  // Se recalcula con cada cambio, incluidos los programaticos (ej. "Restaurar
  // texto original"), que no disparan el evento nativo "input" del textarea.
  useEffect(() => {
    autoResizeTextarea(messageTextareaRef.current);
  }, [currentMessage]);

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
    setValue("initialMessage", normalizedInitialMessage);
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
      ref={scrimRef}
      inert={isExiting ? true : undefined}
      className={`fixed inset-0 z-50 flex justify-end bg-ink/45 backdrop-blur-[2px] transition-opacity ${
        isExiting ? "pointer-events-none" : ""
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
          ${isExiting ? "pointer-events-none" : ""}`}
      >
        {/* Cabecera: sin baldosa; el pie en versalitas sitúa la acción y el título manda. */}
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-line px-6 py-4">
          <div className="min-w-0">
            <p className="font-heading text-[10px] font-bold uppercase tracking-[0.1em] text-zinc-400">
              {emailId ? "Bandeja · Nuevo ticket" : "Tickets · Alta manual"}
            </p>
            <h2 id={titleId} className="mt-1 font-heading text-[17px] font-bold tracking-[-0.01em] text-ink">
              Crear ticket
            </h2>
            <p id={descriptionId} className="mt-0.5 max-w-[52ch] text-[12px] leading-relaxed text-subtle">
              {emailId
                ? "Quedará vinculado a esta conversación. Solo el asunto es obligatorio."
                : "Para dar seguimiento a una solicitud, consulta o incidencia. Solo el asunto es obligatorio."}
            </p>
          </div>

          <button
            type="button"
            onClick={requestClose}
            aria-label="Cerrar"
            title="Cerrar (Esc)"
            className="-mr-1.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-subtle outline-none
              transition-colors hover:bg-fill hover:text-ink focus-visible:ring-2 focus-visible:ring-brand-red/25"
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
              className="flex flex-1 flex-col"
            >
              {formError && (
                <div className="px-6 pt-5">
                  <Alert variant="error">{formError}</Alert>
                </div>
              )}

              {/* Asunto y procedencia: lo primero que se lee, sin caja alrededor. */}
              <section className="flex flex-col gap-4 px-6 py-5">
                {emailId && (
                  <div className="flex items-center gap-2.5 rounded-lg border border-zinc-200 bg-white py-1.5 pl-1.5 pr-2.5 shadow-2xs">
                    <span
                      aria-hidden
                      className="flex size-6 shrink-0 items-center justify-center rounded-md bg-brand-red/10 text-brand-red"
                    >
                      <Mail className="size-3.5" strokeWidth={2.25} />
                    </span>
                    <div className="flex min-w-0 flex-1 flex-col gap-[3px]">
                      <span className="font-heading text-[8.5px] font-bold uppercase leading-none tracking-[0.08em] text-zinc-400">
                        Correo entrante · las respuestas quedarán en el ticket
                      </span>
                      <span className="truncate text-[12px] leading-none text-ink">
                        <span className="font-semibold">{senderName || senderEmail || "Correo entrante"}</span>
                        {senderName && senderEmail && (
                          <span className="ml-1.5 font-mono text-[11px] text-subtle">{senderEmail}</span>
                        )}
                      </span>
                    </div>
                    <span className="shrink-0 rounded-md border border-zinc-200 bg-zinc-50 px-1.5 py-0.5 font-heading text-[9.5px] font-bold uppercase tracking-[0.06em] text-zinc-500">
                      Correo
                    </span>
                  </div>
                )}

                <TextField
                  id="ticket-subject"
                  label="Asunto del ticket"
                  required
                  maxLength={200}
                  hint={
                    <span className="flex items-center justify-between">
                      <span>Resumen claro y conciso de la solicitud.</span>
                      <span className="tabular-nums">{currentSubject.length}/200</span>
                    </span>
                  }
                  placeholder="Ej: Solicitud de cotización de empaques biodegradables…"
                  state={stateOf("subject")}
                  error={errors.subject?.message}
                  {...register("subject")}
                />
              </section>

              {/* Clasificación y enrutamiento */}
              <section className="flex flex-col gap-3.5 border-t border-line-soft px-6 py-5">
                <SectionHeading icon={Tag} title="Clasificación y enrutamiento" aside="Opcional" />

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
                        placeholder="Aún sin motivo"
                        options={[
                          { value: "", label: "Aún sin motivo" },
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
                        placeholder="Aún sin departamento"
                        options={[
                          { value: "", label: "Aún sin departamento" },
                          ...(catalogs?.departments ?? []).map((d) => ({
                            value: String(d.id),
                            label: d.name,
                          })),
                        ]}
                      />
                    )}
                  />

                  <Controller
                    control={control}
                    name="assignedStaffId"
                    render={({ field }) => (
                      <SelectField
                        label="Asignar a colaborador"
                        size="sm"
                        value={field.value ?? ""}
                        onChange={field.onChange}
                        placeholder="Sin asignar, en cola general"
                        options={[
                          { value: "", label: "Sin asignar, en cola general" },
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
                        label="Línea de producto"
                        size="sm"
                        required={requiresProductLine}
                        value={field.value ?? ""}
                        onChange={field.onChange}
                        state={requiresProductLine && !field.value ? stateOf("productLineId") : "idle"}
                        error={errors.productLineId?.message}
                        placeholder="Selecciona una línea"
                        options={[
                          { value: "", label: "Aún sin línea" },
                          ...(catalogs?.productLines ?? []).map((pl) => ({
                            value: String(pl.id),
                            label: `${pl.name} (${pl.code})`,
                          })),
                        ]}
                      />
                    )}
                  />
                </div>
              </section>

              {/* Prioridad: control segmentado; el color solo en el punto, la elección en papel. */}
              <section className="flex flex-col gap-3 border-t border-line-soft px-6 py-5">
                <SectionHeading icon={Flag} title="Nivel de prioridad" />
                <div
                  role="radiogroup"
                  aria-label="Nivel de prioridad"
                  className="grid grid-cols-2 gap-1 rounded-lg border border-zinc-200 bg-zinc-50 p-1 sm:grid-cols-4"
                >
                  {PRIORITIES.map((p) => {
                    const isSelected = selectedPriority === p.value;
                    return (
                      <button
                        key={p.value}
                        type="button"
                        role="radio"
                        aria-checked={isSelected}
                        onClick={() => setValue("priority", p.value, { shouldValidate: true })}
                        className={`flex cursor-pointer flex-col items-start gap-1 rounded-md border px-2.5 py-2 text-left outline-none
                          transition-[background-color,border-color,color,box-shadow,transform] duration-200 ease-out
                          focus-visible:ring-2 focus-visible:ring-brand-red/25 active:scale-[0.99] motion-reduce:transition-none motion-reduce:active:scale-100 ${
                            isSelected
                              ? "border-zinc-200 bg-white text-zinc-900 shadow-2xs"
                              : "border-transparent text-zinc-500 hover:bg-white/60 hover:text-zinc-800"
                          }`}
                      >
                        <span className="flex items-center gap-1.5">
                          <span
                            className={`size-2 shrink-0 rounded-full transition-transform duration-280 ease-plf-spring motion-reduce:transition-none ${p.dot} ${
                              isSelected ? "scale-100" : "scale-75"
                            }`}
                          />
                          <span className="font-heading text-[12px] font-semibold leading-none">{p.label}</span>
                        </span>
                        <span className="text-[10.5px] leading-none text-zinc-400">{p.desc}</span>
                      </button>
                    );
                  })}
                </div>
              </section>

              {/* Cliente y contacto */}
              <section className="flex flex-col gap-3.5 border-t border-line-soft px-6 py-5">
                <SectionHeading
                  icon={Building2}
                  title="Cliente y contacto comercial"
                  aside={
                    selectedClientId ? (
                      <button
                        type="button"
                        onClick={handleClearClient}
                        className="cursor-pointer rounded font-medium text-zinc-500 underline-offset-4 transition-colors hover:text-brand-red hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand-red"
                      >
                        Quitar cliente
                      </button>
                    ) : (
                      "Opcional"
                    )
                  }
                />

                {detectedMatch && (
                  <div className="flex items-center gap-2.5 rounded-lg border border-brand-green/30 bg-brand-green/[0.05] py-1.5 pl-1.5 pr-2.5">
                    <span
                      aria-hidden
                      className="animate-plf-seal-pop flex size-5 shrink-0 items-center justify-center rounded-md bg-brand-green text-white"
                    >
                      <Check className="size-3" strokeWidth={3} />
                    </span>
                    <span className="min-w-0 flex-1 truncate text-[12px] text-ink">
                      Identificado por remitente: <strong className="font-semibold">{detectedMatch.clientName}</strong>
                      <span className="text-subtle"> · {detectedMatch.contactName}</span>
                    </span>
                    <button
                      type="button"
                      onClick={handleClearClient}
                      className="shrink-0 cursor-pointer rounded text-[11px] font-medium text-zinc-500 underline-offset-4 transition-colors hover:text-ink hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand-red"
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
                        placeholder="Aún sin cliente asociado"
                        options={[
                          { value: "", label: "Aún sin cliente asociado" },
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
                            ? "Aún no hay contactos registrados"
                            : "Aún sin contacto específico"
                        }
                        disabled={contactOptions.length === 0}
                        options={[
                          { value: "", label: "Aún sin contacto específico" },
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
                  <p className="flex items-start gap-1.5 text-[11px] leading-relaxed text-zinc-400">
                    <Info className="mt-px size-3 shrink-0" />
                    <span>
                      Sin cliente registrado, el ticket se tramita con los datos del solicitante
                      {senderEmail ? ` (${senderEmail})` : ""}.
                    </span>
                  </p>
                )}
              </section>

              {/* Mensaje inicial */}
              <section className="flex flex-col gap-3 border-t border-line-soft px-6 py-5">
                <SectionHeading
                  icon={MessageSquareText}
                  title={emailId ? "Mensaje inicial del ticket" : "Descripción de la incidencia"}
                  htmlFor="ticket-initial-message"
                  aside={
                    normalizedInitialMessage && currentMessage !== normalizedInitialMessage ? (
                      <button
                        type="button"
                        onClick={handleResetMessage}
                        className="inline-flex cursor-pointer items-center gap-1 rounded font-medium text-zinc-500 underline-offset-4 transition-colors hover:text-brand-red hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand-red"
                      >
                        <RotateCcw className="size-3" />
                        Restaurar el texto del correo
                      </button>
                    ) : (
                      "Opcional"
                    )
                  }
                />
                <p className="-mt-1.5 text-[11.5px] leading-relaxed text-subtle">
                  {emailId
                    ? "Cuerpo del correo original. Será el primer mensaje del ticket y puedes editarlo."
                    : "Cuenta brevemente la solicitud o incidencia. Quedará como primer mensaje del historial."}
                </p>

                <textarea
                  id="ticket-initial-message"
                  placeholder="Detalles de la incidencia, antecedentes o instrucciones para el equipo que atenderá el caso…"
                  className={`${controlBase} ${stateClasses.idle} min-h-[96px] resize-none overflow-hidden px-3 py-2.5 text-[12.5px] leading-relaxed placeholder:text-zinc-400`}
                  name={initialMessageField.name}
                  onChange={(event) => {
                    initialMessageField.onChange(event);
                    autoResizeTextarea(event.target);
                  }}
                  onBlur={initialMessageField.onBlur}
                  ref={(el) => {
                    initialMessageField.ref(el);
                    messageTextareaRef.current = el;
                    // El textarea recien se monta cuando terminan de cargar los catalogos
                    // (antes hay un spinner): sin esto, un mensaje largo precargado desde
                    // el correo queda con la altura minima y el texto se corta sin aviso.
                    autoResizeTextarea(el);
                  }}
                />

                <p className="text-right text-[11px] tabular-nums text-zinc-400">{currentMessage.length} caracteres</p>
              </section>
            </form>
          )}
        </div>

        {/* Pie de acciones */}
        <div className="flex shrink-0 items-center justify-between gap-3 border-t border-line bg-white px-6 py-3.5">
          <span className="hidden items-center gap-1.5 text-[11.5px] text-zinc-400 sm:flex">
            <kbd className="rounded-md border border-zinc-200 bg-zinc-50 px-1.5 py-0.5 font-mono text-[10px] font-medium text-zinc-600">
              Ctrl
            </kbd>
            <span aria-hidden>+</span>
            <kbd className="rounded-md border border-zinc-200 bg-zinc-50 px-1.5 py-0.5 font-mono text-[10px] font-medium text-zinc-600">
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
