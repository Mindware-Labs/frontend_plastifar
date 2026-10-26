import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useMemo, useRef, useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { Building2, Check, Flag, Info, Mail, MessageSquareText, RotateCcw, Tag, X } from "lucide-react";
import { ApiError } from "../../api/client";
import { departmentsApi } from "../../api/departments";
import { ticketsApi } from "../../api/tickets";
import { Alert } from "../../components/ui/Alert";
import { Button } from "../../components/ui/Button";
import { Drawer } from "../../components/ui/Drawer";
import { SelectField, TextField, type FieldState } from "../../components/ui/Field";
import { controlBase, stateClasses } from "../../components/ui/fieldStyles";
import { Spinner } from "../../components/ui/Spinner";
import { useModalAnimation } from "../../hooks/useModalAnimation";
import { autoResizeTextarea } from "../../lib/autoResizeTextarea";
import { departmentPathOptions } from "../../lib/departments";
import type {
  DepartmentResponse,
  TicketContactOption,
  TicketCreateOptionsResponse,
  TicketSummaryResponse,
} from "../../types/api";
import { SectionHeading } from "./CreateTicketSectionHeading";
import { reflowPlainText } from "./reflowPlainText";

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
  onCreated: (ticket: TicketSummaryResponse, targetUrl?: string) => void;
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
  const [departmentTree, setDepartmentTree] = useState<DepartmentResponse[] | undefined>(undefined);
  const [formError, setFormError] = useState<string | null>(null);
  const [detectedMatch, setDetectedMatch] = useState<{ clientName: string; contactName: string } | null>(null);
  const { isExiting, requestClose } = useModalAnimation();

  const normalizedInitialMessage = useMemo(
    () => (initialMessage ? reflowPlainText(initialMessage) : ""),
    [initialMessage],
  );

  const messageTextareaRef = useRef<HTMLTextAreaElement | null>(null);

  const {
    register,
    control,
    handleSubmit,
    setValue,
    getValues,
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

  const selectedClientId = useWatch({ control, name: "clientId" });
  const selectedTopicId = useWatch({ control, name: "topicId" });
  const selectedPriority = useWatch({ control, name: "priority" }) || "Normal";
  const currentSubject = useWatch({ control, name: "subject" }) || "";
  const currentMessage = useWatch({ control, name: "initialMessage" }) || "";
  const initialMessageField = register("initialMessage");

  // Recalcula altura ante cambios manuales o programáticos del texto.
  useEffect(() => {
    autoResizeTextarea(messageTextareaRef.current, 96);
  }, [currentMessage]);

  useEffect(() => {
    ticketsApi
      .createOptions()
      .then((data) => {
        setCatalogs(data);

        // Coincidencia automática de cliente a partir del remitente del correo.
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

  /* El catálogo trae sólo los departamentos a los que la persona tiene alcance,
     con id y nombre. El nombre ya no es único —hay un «ALMACEN» de primer nivel
     y otro bajo PLASTIFAR CENTROAMERICA—, así que el camino se resuelve contra
     el árbol entero, inactivos incluidos para no cortar la cadena de padres.
     Si esta lectura falla, las opciones siguen saliendo con su nombre. */
  useEffect(() => {
    departmentsApi
      .list({ includeInactive: true })
      .then(setDepartmentTree)
      .catch(() => setDepartmentTree(undefined));
  }, []);

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

  return (
    <Drawer
      title="Crear ticket"
      onClose={onClose}
      isExiting={isExiting}
      onRequestClose={requestClose}
      panelClassName="relative h-full w-full bg-white shadow-[0_4px_32px_rgba(27,27,29,0.22)] sm:w-[620px] md:w-[700px] lg:w-[760px]"
      bodyClassName="flex min-h-0 flex-1 flex-col overflow-y-auto"
      footerClassName="flex shrink-0 items-center justify-between gap-3 border-t border-line bg-white px-6 py-3.5"
      footer={
        <>
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
        </>
      }
      header={
        /* Cabecera: sin baldosa; el pie en versalitas situa la accion y el titulo manda. */
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-line px-6 py-4">
          <div className="min-w-0">
            <p className="font-heading text-[10px] font-bold uppercase tracking-[0.1em] text-zinc-400">
              {emailId ? "Bandeja · Nuevo ticket" : "Tickets · Alta manual"}
            </p>
            <h2 className="mt-1 font-heading text-[17px] font-bold tracking-[-0.01em] text-ink">
              Crear ticket
            </h2>
            <p className="mt-0.5 max-w-[52ch] text-[12px] leading-relaxed text-subtle">
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
      }
    >
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
                      ...departmentPathOptions(catalogs?.departments ?? [], departmentTree),
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
                    label="Línea de producto (Opcional)"
                    size="sm"
                    value={field.value ?? ""}
                    onChange={field.onChange}
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
                autoResizeTextarea(event.target, 96);
              }}
              onBlur={initialMessageField.onBlur}
              ref={(el) => {
                initialMessageField.ref(el);
                messageTextareaRef.current = el;
                // Ajuste de altura inicial tras carga diferida de catálogos.
                autoResizeTextarea(el, 96);
              }}
            />

            <p className="text-right text-[11px] tabular-nums text-zinc-400">{currentMessage.length} caracteres</p>
          </section>
        </form>
      )}
    </Drawer>
  );
}
