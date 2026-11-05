import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { Mail, RotateCcw } from "lucide-react";
import { SlaPolicyField } from "../../components/app/SlaPolicyField";
import { pickDefaultSlaPolicyId } from "../../lib/slaPolicyUi";
import { useActiveSlaPolicies } from "../../lib/useActiveSlaPolicies";
import { SubmitValidationButton } from "../../components/app/SubmitValidationButton";
import { TaskEvidenceUpload } from "../../components/app/TaskEvidenceUpload";
import { TicketProductsField, type TicketProductDraft } from "../../components/app/TicketProductsField";
import { ApiError } from "../../api/client";
import { clientsApi } from "../../api/clients";
import { departmentsApi } from "../../api/departments";
import { ticketsApi } from "../../api/tickets";
import { Button } from "../../components/ui/Button";
import { SelectField, TextAreaField, TextField, type FieldState } from "../../components/ui/Field";
import { Modal } from "../../components/ui/Modal";
import { Toast } from "../../components/ui/Toast";
import { useModalAnimation } from "../../hooks/useModalAnimation";
import { departmentPathOptions } from "../../lib/departments";
import { buildValidationItems, focusFormField } from "../../lib/validationItems";
import type {
  DepartmentResponse,
  TicketContactOption,
  TicketCreateOptionsResponse,
  TicketSummaryResponse,
} from "../../types/api";

const schema = z.object({
  clientId: z.string().optional(),
  contactId: z.string().optional(),
  topicId: z.string().optional(),
  subject: z
    .string()
    .trim()
    .min(3, "El asunto debe tener al menos 3 caracteres")
    .max(200, "El asunto no puede superar los 200 caracteres"),
  slaPolicyId: z.string().trim().min(1, "Elige una política SLA"),
  departmentId: z.string().optional(),
  assignedStaffId: z.string().optional(),
  initialMessage: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

export interface CreateTicketModalProps {
  onClose: () => void;
  onCreated: (ticket: TicketSummaryResponse) => void;
  emailId?: number;
  initialSubject?: string;
  initialMessage?: string;
  initialClientId?: number;
  /** Correo del cliente en el hilo: remitente si entró; destinatario si salió Plastifar primero. */
  senderEmail?: string;
  senderName?: string;
  emailDirection?: "inbound" | "outbound";
  initialAssignedStaffId?: number | null;
}

const FORM_ID = "create-ticket-form";

// Caché en memoria para carga inmediata sin parpadeos ni bloqueos
let cachedCatalogs: TicketCreateOptionsResponse | null = null;
let cachedDepartmentTree: DepartmentResponse[] | null = null;
let inflightCatalogs: Promise<TicketCreateOptionsResponse> | null = null;
let inflightDepartmentTree: Promise<DepartmentResponse[]> | null = null;

function loadCatalogs(): Promise<TicketCreateOptionsResponse> {
  if (cachedCatalogs) return Promise.resolve(cachedCatalogs);
  if (!inflightCatalogs) {
    inflightCatalogs = ticketsApi
      .createOptions()
      .then((data) => {
        cachedCatalogs = data;
        return data;
      })
      .finally(() => {
        inflightCatalogs = null;
      });
  }
  return inflightCatalogs;
}

function loadDepartmentTree(): Promise<DepartmentResponse[]> {
  if (cachedDepartmentTree) return Promise.resolve(cachedDepartmentTree);
  if (!inflightDepartmentTree) {
    inflightDepartmentTree = departmentsApi
      .list({ includeInactive: true })
      .then((data) => {
        cachedDepartmentTree = data;
        return data;
      })
      .finally(() => {
        inflightDepartmentTree = null;
      });
  }
  return inflightDepartmentTree;
}

/** Normaliza saltos de línea suaves en correos pegados para aprovechar el ancho. */
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

function FormDivider({ title, aside }: { title: string; aside?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2 pt-2 border-t border-zinc-100 first:border-0 first:pt-0">
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <span className="shrink-0 font-heading text-[10px] font-bold uppercase tracking-[0.08em] text-zinc-400 select-none">
          {title}
        </span>
        <div className="h-px flex-1 bg-zinc-100" />
      </div>
      {aside && <span className="text-[11px] text-zinc-400 shrink-0">{aside}</span>}
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
  emailDirection = "inbound",
  initialAssignedStaffId,
}: CreateTicketModalProps) {
  const [catalogs, setCatalogs] = useState<TicketCreateOptionsResponse | null>(() => cachedCatalogs);
  const [loadingCatalogs, setLoadingCatalogs] = useState(() => !cachedCatalogs);
  const [departmentTree, setDepartmentTree] = useState<DepartmentResponse[] | undefined>(
    () => cachedDepartmentTree ?? undefined,
  );
  const [toastError, setToastError] = useState<string | null>(null);
  const [ticketProducts, setTicketProducts] = useState<TicketProductDraft[]>([]);
  const [createAttachments, setCreateAttachments] = useState<File[]>([]);
  const [fetchedContacts, setFetchedContacts] = useState<TicketContactOption[]>([]);
  const { isExiting, requestClose } = useModalAnimation();

  const normalizedInitialMessage = useMemo(
    () => (initialMessage ? reflowPlainText(initialMessage) : ""),
    [initialMessage],
  );

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
      subject: initialSubject ?? "",
      slaPolicyId: "",
      departmentId: "",
      assignedStaffId: initialAssignedStaffId ? String(initialAssignedStaffId) : "",
      initialMessage: normalizedInitialMessage,
    },
  });

  const { policies: slaPolicies, loading: slaPoliciesLoading } = useActiveSlaPolicies("Ticket");
  const sortedTicketPolicies = useMemo(() => slaPolicies ?? [], [slaPolicies]);

  const selectedClientId = useWatch({ control, name: "clientId" });
  const selectedTopicId = useWatch({ control, name: "topicId" });
  const currentSubject = useWatch({ control, name: "subject" }) || "";
  const currentSlaPolicyId = useWatch({ control, name: "slaPolicyId" }) || "";
  const currentMessage = useWatch({ control, name: "initialMessage" }) || "";

  const createTicketMissing = useMemo(
    () =>
      buildValidationItems([
        {
          id: "ticket-subject",
          label: "Falta el asunto (mínimo 3 caracteres)",
          short: "el asunto",
          valid: currentSubject.trim().length >= 3,
        },
        {
          id: "create-ticket-sla",
          label: "Falta elegir la política SLA",
          short: "la política SLA",
          valid: currentSlaPolicyId.trim().length > 0,
        },
      ]),
    [currentSubject, currentSlaPolicyId],
  );
  const createTicketReady =
    createTicketMissing.length === 0 && !loadingCatalogs;

  // Carga inmediata o en segundo plano de catálogos
  useEffect(() => {
    if (!cachedCatalogs) {
      loadCatalogs()
        .then((data) => {
          setCatalogs(data);
          setLoadingCatalogs(false);
        })
        .catch((err) => {
          setLoadingCatalogs(false);
          setToastError(err instanceof Error ? err.message : "Error al cargar catálogos");
        });
    } else {
      setLoadingCatalogs(false);
    }
  }, []);

  // Carga inmediata o en segundo plano del árbol de departamentos
  useEffect(() => {
    if (!cachedDepartmentTree) {
      loadDepartmentTree()
        .then((tree) => setDepartmentTree(tree))
        .catch(() => setDepartmentTree(undefined));
    }
  }, []);

  // Al cambiar de cliente, poblar contactos
  const selectedClient = catalogs?.clients.find((c) => String(c.id) === selectedClientId);
  const catalogContacts = selectedClient?.contacts ?? [];
  const contactOptions: TicketContactOption[] = useMemo(
    () => (catalogContacts.length > 0 ? catalogContacts : fetchedContacts),
    [catalogContacts, fetchedContacts],
  );

  useEffect(() => {
    if (!selectedClientId) {
      setFetchedContacts([]);
      return;
    }
    if (catalogContacts.length > 0) {
      setFetchedContacts([]);
      return;
    }
    let cancelled = false;
    clientsApi
      .get(Number(selectedClientId))
      .then(({ contacts }) => {
        if (cancelled) return;
        setFetchedContacts(
          contacts.map((c) => ({
            id: c.id,
            fullName: `${c.firstName} ${c.lastName}`.trim(),
            email: c.email,
            phone: c.phone,
            position: c.position,
            isPrimary: c.isPrimary,
          })),
        );
      })
      .catch(() => {
        if (!cancelled) setFetchedContacts([]);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedClientId, catalogContacts.length]);

  useEffect(() => {
    if (selectedClient && contactOptions.length > 0) {
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

  useEffect(() => {
    if (!slaPolicies?.length) return;
    const current = getValues("slaPolicyId");
    if (!current) {
      setValue("slaPolicyId", pickDefaultSlaPolicyId(slaPolicies), { shouldValidate: true });
    }
  }, [slaPolicies, getValues, setValue]);

  const selectedTopic = catalogs?.topics.find((t) => String(t.id) === selectedTopicId);
  useEffect(() => {
    if (!selectedTopic || sortedTicketPolicies.length === 0) return;
    if (selectedTopic.defaultDepartmentId) {
      setValue("departmentId", String(selectedTopic.defaultDepartmentId));
    }
    if (selectedTopic.slaPolicyId) {
      const linked = sortedTicketPolicies.some((p) => p.id === selectedTopic.slaPolicyId);
      if (linked) {
        setValue("slaPolicyId", String(selectedTopic.slaPolicyId), { shouldValidate: true });
        return;
      }
    }
    const byPriority = sortedTicketPolicies.find(
      (p) => p.priority === selectedTopic.defaultPriority && p.isDefault,
    );
    if (byPriority) {
      setValue("slaPolicyId", String(byPriority.id), { shouldValidate: true });
    }
  }, [selectedTopic, sortedTicketPolicies, setValue]);

  function stateOf(field: keyof FormValues): FieldState {
    if (errors[field]) return "error";
    return touchedFields[field] ? "valid" : "idle";
  }

  function handleClearClient() {
    setValue("clientId", "");
    setValue("contactId", "");
  }

  function handleResetMessage() {
    setValue("initialMessage", normalizedInitialMessage, { shouldValidate: true, shouldDirty: true });
  }

  async function onSubmit(values: FormValues) {
    setToastError(null);

    try {
      const payload = {
        clientId: values.clientId ? Number(values.clientId) : null,
        contactId: values.contactId ? Number(values.contactId) : null,
        topicId: values.topicId ? Number(values.topicId) : null,
        productIds: ticketProducts.length > 0 ? ticketProducts.map((p) => p.productId) : null,
        subject: values.subject.trim(),
        slaPolicyId: Number(values.slaPolicyId),
        departmentId: values.departmentId ? Number(values.departmentId) : null,
        assignedStaffId: values.assignedStaffId ? Number(values.assignedStaffId) : null,
        initialMessage: values.initialMessage?.trim() || null,
        emailId: emailId ?? null,
      };

      const created = await ticketsApi.create(
        payload,
        createAttachments.length > 0 ? createAttachments : undefined,
      );

      onCreated(created);
      requestClose();
    } catch (err) {
      if (err instanceof ApiError) {
        setToastError(err.message);
      } else if (err instanceof Error) {
        setToastError(err.message);
      } else {
        setToastError("Ocurrió un error inesperado al crear el ticket.");
      }
    }
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLFormElement>) {
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
      event.preventDefault();
      if (!createTicketReady) {
        if (createTicketMissing.length > 0) {
          setToastError(createTicketMissing.map((m) => m.label).join(". "));
        }
        return;
      }
      void handleSubmit(onSubmit)();
    }
  }

  return (
    <>
      <Toast message={toastError} variant="error" onDismiss={() => setToastError(null)} />
      <Modal
        maxWidth="max-w-2xl"
        eyebrow={emailId ? "Bandeja · Nuevo ticket" : "Tickets · Alta manual"}
        title="Crear ticket"
        description={emailId ? "Quedará vinculado a esta conversación." : undefined}
        onClose={onClose}
        isExiting={isExiting}
        onRequestClose={requestClose}
        footer={
          <div className="flex w-full items-center justify-between gap-3">
            <span className="hidden sm:inline-flex items-center gap-1 text-[11px] text-zinc-400 select-none">
              <kbd className="rounded border border-zinc-200 bg-zinc-100 px-1 py-0.5 text-[10px] font-mono text-zinc-500">
                Ctrl
              </kbd>
              <span>+</span>
              <kbd className="rounded border border-zinc-200 bg-zinc-100 px-1 py-0.5 text-[10px] font-mono text-zinc-500">
                Enter
              </kbd>
              <span className="ml-0.5">para crear</span>
            </span>
            <div className="flex items-center gap-2 ml-auto">
              <Button type="button" variant="secondary" size="sm" onClick={requestClose} disabled={isSubmitting}>
                Cancelar
              </Button>
              <SubmitValidationButton
                formId={FORM_ID}
                ready={createTicketReady}
                busy={isSubmitting || loadingCatalogs}
                missingItems={createTicketMissing}
                onFocusField={(id) => {
                  if (id === "create-ticket-sla") {
                    document.getElementById("create-ticket-sla")?.scrollIntoView({ block: "nearest", behavior: "smooth" });
                    return;
                  }
                  focusFormField(id);
                }}
                hintText="Para crear el ticket, completa lo siguiente:"
                blockTitle="No se puede crear"
              >
                {isSubmitting ? "Creando ticket…" : "Crear ticket"}
              </SubmitValidationButton>
            </div>
          </div>
        }
      >
        <form
          id={FORM_ID}
          onSubmit={handleSubmit(onSubmit)}
          onKeyDown={handleKeyDown}
          noValidate
          className="flex flex-col gap-3 text-left"
        >
          {/* Banner de correo si viene de bandeja */}
          {emailId && (
            <div className="flex items-center gap-2.5 rounded-lg border border-zinc-200 bg-zinc-50/70 py-1.5 pl-2 pr-2.5 shadow-2xs">
              <span
                aria-hidden
                className="flex size-6 shrink-0 items-center justify-center rounded-md bg-brand-red/10 text-brand-red"
              >
                <Mail className="size-3.5" strokeWidth={2.25} />
              </span>
              <div className="flex min-w-0 flex-1 flex-col gap-[2px]">
                <span className="font-heading text-[8.5px] font-bold uppercase leading-none tracking-[0.08em] text-zinc-400">
                  {emailDirection === "outbound"
                    ? "Correo enviado · referencia (Para)"
                    : "Correo recibido · referencia (De)"}
                </span>
                <span className="truncate text-[12px] leading-none text-ink">
                  {emailDirection === "inbound" && senderName ? (
                    <>
                      <span className="font-semibold">{senderName}</span>
                      {senderEmail && (
                        <span className="ml-1.5 font-mono text-[11px] text-subtle">{senderEmail}</span>
                      )}
                    </>
                  ) : (
                    <span className="font-mono font-semibold">{senderEmail ?? "—"}</span>
                  )}
                </span>
              </div>
              <span className="shrink-0 rounded-md border border-zinc-200 bg-white px-1.5 py-0.5 font-heading text-[9.5px] font-bold uppercase tracking-[0.06em] text-zinc-500">
                Correo
              </span>
            </div>
          )}

          {/* 1. INFORMACIÓN GENERAL */}
          <FormDivider title="Información general" />

          <TextField
            size="sm"
            id="ticket-subject"
            label="Asunto"
            required
            maxLength={200}
            placeholder="Ej. Solicitud de cotización de empaques biodegradables…"
            state={stateOf("subject")}
            error={errors.subject?.message}
            {...register("subject", {
              onChange: () => {
                if (toastError) setToastError(null);
              },
            })}
          />

          {/* 2. CLASIFICACIÓN Y ENRUTAMIENTO */}
          <FormDivider title="Clasificación" aside="Opcional" />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <Controller
              control={control}
              name="topicId"
              render={({ field }) => (
                <SelectField
                  id="ticket-topic"
                  label="Motivo del ticket"
                  size="sm"
                  searchable
                  value={field.value ?? ""}
                  onChange={(val) => {
                    field.onChange(val);
                    if (toastError) setToastError(null);
                  }}
                  disabled={loadingCatalogs}
                  state={stateOf("topicId")}
                  error={errors.topicId?.message}
                  placeholder={loadingCatalogs ? "Cargando motivos…" : "Aún sin motivo"}
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
              name="assignedStaffId"
              render={({ field }) => (
                <SelectField
                  id="ticket-assigned-staff"
                  label="Asignar a colaborador"
                  size="sm"
                  searchable
                  value={field.value ?? ""}
                  onChange={(val) => {
                    field.onChange(val);
                    if (toastError) setToastError(null);
                  }}
                  disabled={loadingCatalogs}
                  placeholder={loadingCatalogs ? "Cargando colaboradores…" : "Sin asignar, en cola general"}
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

            <div className="sm:col-span-2">
              <Controller
                control={control}
                name="departmentId"
                render={({ field }) => (
                  <SelectField
                    id="ticket-department"
                    label="Departamento"
                    size="sm"
                    searchable
                    value={field.value ?? ""}
                    onChange={(val) => {
                      field.onChange(val);
                      if (toastError) setToastError(null);
                    }}
                    disabled={loadingCatalogs}
                    placeholder={loadingCatalogs ? "Cargando departamentos…" : "Aún sin departamento"}
                    options={[
                      { value: "", label: "Aún sin departamento" },
                      ...departmentPathOptions(catalogs?.departments ?? [], departmentTree),
                    ]}
                  />
                )}
              />
            </div>
          </div>

          {/* 3. PRODUCTOS RELACIONADOS */}
          <FormDivider title="Productos relacionados" aside="Opcional" />

          <TicketProductsField
            value={ticketProducts}
            onChange={setTicketProducts}
          />

          {/* 4. COMPROMISO SLA */}
          <div id="create-ticket-sla">
            <Controller
              name="slaPolicyId"
              control={control}
              render={({ field }) => (
                <SlaPolicyField
                  embeddedSection
                  sectionBorder
                  required
                  policies={sortedTicketPolicies}
                  loading={slaPoliciesLoading}
                  value={field.value}
                  onChange={field.onChange}
                  error={errors.slaPolicyId?.message}
                  state={stateOf("slaPolicyId")}
                />
              )}
            />
          </div>

          {/* 5. CLIENTE Y CONTACTO */}
          <FormDivider
            title="Cliente y contacto"
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

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <Controller
              control={control}
              name="clientId"
              render={({ field }) => (
                <SelectField
                  id="ticket-client"
                  label="Cliente registrado"
                  size="sm"
                  value={field.value ?? ""}
                  onChange={field.onChange}
                  disabled={loadingCatalogs}
                  state={stateOf("clientId")}
                  error={errors.clientId?.message}
                  placeholder={loadingCatalogs ? "Cargando clientes…" : "Aún sin cliente asociado"}
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
                  id="ticket-contact"
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

          {/* 6. MENSAJE INICIAL / DETALLES */}
          <FormDivider
            title={emailId ? "Mensaje inicial del ticket" : "Detalles de la incidencia"}
            aside={
              normalizedInitialMessage && currentMessage !== normalizedInitialMessage ? (
                <button
                  type="button"
                  onClick={handleResetMessage}
                  className="inline-flex cursor-pointer items-center gap-1 rounded font-medium text-zinc-500 underline-offset-4 transition-colors hover:text-brand-red hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand-red"
                >
                  <RotateCcw className="size-3" />
                  Restaurar texto original
                </button>
              ) : (
                "Opcional"
              )
            }
          />

          <TextAreaField
            id="ticket-initial-message"
            label={emailId ? "Mensaje inicial" : "Descripción del caso"}
            rows={2}
            autoGrow
            minHeightPx={42}
            className="text-[12.5px] py-2 leading-relaxed"
            placeholder="Detalles de la incidencia, antecedentes o instrucciones para el equipo…"
            value={currentMessage}
            {...register("initialMessage")}
          />

          <TaskEvidenceUpload
            files={createAttachments}
            onFilesChange={setCreateAttachments}
            onReportError={setToastError}
            label="Archivos adjuntos (opcional)"
            dropzoneTitle="Haz clic o arrastra archivos al ticket"
            dropzoneHint="Imágenes, PDF u otros documentos · máx. 10 MB por archivo"
          />
        </form>
      </Modal>
    </>
  );
}
