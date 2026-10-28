import { zodResolver } from "@hookform/resolvers/zod";
import { AlertCircle, AlertOctagon, AlertTriangle, Flag } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Controller, useForm, useWatch, type UseFormRegisterReturn } from "react-hook-form";
import { ApiError } from "../../api/client";
import { clientsApi } from "../../api/clients";
import { departmentsApi } from "../../api/departments";
import { staffApi } from "../../api/staff";
import { tasksApi } from "../../api/tasks";
import { TaskEvidenceUpload } from "../../components/app/TaskEvidenceUpload";
import { Alert } from "../../components/ui/Alert";
import { Button } from "../../components/ui/Button";
import {
  DateField,
  LookupField,
  SelectField,
  TextAreaField,
  TextField,
  type FieldState,
} from "../../components/ui/Field";
import { Modal } from "../../components/ui/Modal";
import type { SelectOption } from "../../components/ui/Select";
import { useModalAnimation } from "../../hooks/useModalAnimation";
import { usePermissions } from "../../hooks/usePermissions";
import { autoResizeTextarea } from "../../lib/autoResizeTextarea";
import { getDepartmentIcon } from "../../lib/departmentFilterOptions";
import { buildDepartmentTree } from "../../lib/departments";
import { resolveClientLabel, resolveStaffLabel, searchActiveStaff, searchClients } from "../../lib/lookups";
import type { DepartmentResponse } from "../../types/api";
import type { Contact } from "../../types/clients";
import type { EmailTaskPrefill, TaskDetail, TaskPriority, UpdateTaskRequest } from "../../types/tasks";
import { TASK_STATUS_EDIT_OPTIONS } from "./taskCells";
import {
  dueDateToApi,
  parseDueDateFromApi,
  taskFormSchema,
  type TaskFormValues,
} from "./taskSchema";

interface TaskFormModalProps {
  task?: TaskDetail;
  prefill?: EmailTaskPrefill;
  onClose: () => void;
  onSaved: (task: TaskDetail) => void;
}

const PRIORITY_ITEMS: {
  value: TaskPriority;
  label: string;
  icon: typeof Flag;
  activeColor: string;
}[] = [
  { value: "Emergencia", label: "Emergencia", icon: AlertOctagon, activeColor: "text-brand-red" },
  { value: "Alta", label: "Alta", icon: AlertTriangle, activeColor: "text-amber-500" },
  { value: "Normal", label: "Normal", icon: Flag, activeColor: "text-blue-500" },
  { value: "Baja", label: "Baja", icon: Flag, activeColor: "text-zinc-400" },
];

function optionalId(value: string): number | null {
  return value === "" ? null : Number(value);
}

function FormDivider({ title }: { title: string }) {
  return (
    <div className="flex items-center gap-2 pt-2 border-t border-zinc-100 first:border-0 first:pt-0">
      <span className="font-heading text-[10px] font-bold uppercase tracking-[0.08em] text-zinc-400 select-none">
        {title}
      </span>
      <div className="h-px flex-1 bg-zinc-100" />
    </div>
  );
}

function bindAutoResizeTextarea(
  field: UseFormRegisterReturn,
  minHeightPx: number,
  storeRef?: (element: HTMLTextAreaElement | null) => void,
) {
  return {
    name: field.name,
    onBlur: field.onBlur,
    onChange: (event: React.ChangeEvent<HTMLTextAreaElement>) => {
      field.onChange(event);
      autoResizeTextarea(event.target, minHeightPx);
    },
    ref: (element: HTMLTextAreaElement | null) => {
      field.ref(element);
      storeRef?.(element);
      autoResizeTextarea(element, minHeightPx);
    },
  };
}

export function TaskFormModal({ task, prefill, onClose, onSaved }: TaskFormModalProps) {
  const isEdit = task !== undefined;
  const { can, isAdmin } = usePermissions();
  const [formError, setFormError] = useState<string | null>(null);
  const [departments, setDepartments] = useState<DepartmentResponse[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [files, setFiles] = useState<File[]>([]);
  const [inherited, setInherited] = useState<number[]>(() =>
    (prefill?.attachments ?? []).filter((file) => file.available && !file.dangerous).map((file) => file.id),
  );
  const [departmentTouched, setDepartmentTouched] = useState(isEdit);
  const [contactTouched, setContactTouched] = useState(isEdit);
  const { isExiting, requestClose } = useModalAnimation();
  const instructionsTextareaRef = useRef<HTMLTextAreaElement | null>(null);

  const initialDue = useMemo(
    () => parseDueDateFromApi(task?.dueDate ?? null),
    [task?.dueDate],
  );

  const writable = useMemo(
    () => departments.filter((department) => isAdmin || can("tasks.write", department.id)),
    [departments, isAdmin, can],
  );

  const {
    control,
    register,
    handleSubmit,
    setValue,
    getValues,
    formState: { errors, touchedFields, isSubmitting },
  } = useForm<TaskFormValues>({
    resolver: zodResolver(taskFormSchema),
    mode: "onTouched",
    defaultValues: {
      title: task?.title ?? prefill?.title ?? "",
      instructions: task?.instructions ?? prefill?.instructions ?? "",
      departmentId: task ? String(task.departmentId) : "",
      assignedStaffId: task?.assignedStaffId ? String(task.assignedStaffId) : "",
      priority: task?.priority ?? "Normal",
      status: task?.status === "EnProgreso" ? "EnProgreso" : "Pendiente",
      clientId: task?.clientId ? String(task.clientId) : "",
      contactId: task?.contactId ? String(task.contactId) : "",
      dueDate: initialDue.date,
      dueTime: initialDue.time,
    },
  });

  const clientId = useWatch({ control, name: "clientId" }) ?? "";
  const instructions = useWatch({ control, name: "instructions" }) ?? "";
  const dueTimeValue = useWatch({ control, name: "dueTime" }) ?? "";

  const instructionsField = register("instructions");

  useEffect(() => {
    autoResizeTextarea(instructionsTextareaRef.current, 38);
  }, [instructions]);

  useEffect(() => {
    let cancelled = false;
    departmentsApi
      .list()
      .then((rows) => {
        if (cancelled) return;
        setDepartments(rows.filter((row) => row.isActive));
      })
      .catch(() => {
        if (!cancelled) setFormError("No se pudieron cargar los departamentos.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (isEdit || departmentTouched || writable.length !== 1) return;
    setValue("departmentId", String(writable[0].id));
  }, [departmentTouched, isEdit, setValue, writable]);

  useEffect(() => {
    if (!prefill?.senderEmail || isEdit) return;
    let cancelled = false;
    tasksApi
      .senderMatch(prefill.senderEmail)
      .then((match) => {
        if (cancelled || match.clientId == null) return;
        setValue("clientId", String(match.clientId));
        if (match.contactId != null) setValue("contactId", String(match.contactId));
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [isEdit, prefill?.senderEmail, setValue]);

  useEffect(() => {
    if (clientId === "") {
      setContacts([]);
      return;
    }
    let cancelled = false;
    clientsApi.contacts
      .list(Number(clientId), { page: 1, pageSize: 100, status: "activos" })
      .then((page) => {
        if (cancelled) return;
        setContacts(page.items);
        if (contactTouched || getValues("contactId") !== "") return;
        const primary = page.items.find((contact) => contact.isPrimary);
        const suggested = primary ?? (page.items.length === 1 ? page.items[0] : undefined);
        if (suggested) {
          setValue("contactId", String(suggested.id), { shouldValidate: true });
        }
      })
      .catch(() => {
        if (!cancelled) setContacts([]);
      });
    return () => {
      cancelled = true;
    };
  }, [clientId, contactTouched, getValues, setValue]);

  function stateOf(field: keyof TaskFormValues): FieldState {
    if (errors[field]) return "error";
    return touchedFields[field] ? "valid" : "idle";
  }

  async function suggestDepartment(staffId: string) {
    if (staffId === "" || departmentTouched) return;
    try {
      const person = await staffApi.getById(Number(staffId));
      const allowed = writable.some((department) => department.id === person.primaryDepartmentId);
      if (allowed) setValue("departmentId", String(person.primaryDepartmentId), { shouldValidate: true });
    } catch {
      // La sugerencia es una ayuda: si la ficha no carga, el departamento se elige a mano.
    }
  }

  async function onSubmit(values: TaskFormValues) {
    setFormError(null);
    try {
      const saved = isEdit ? await tasksApi.update(task.id, toUpdate(values)) : await tasksApi.create(toCreate(values));
      onSaved(saved);
      requestClose();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "No se pudo guardar la tarea");
    }
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLFormElement>) {
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
      event.preventDefault();
      void handleSubmit(onSubmit)();
    }
  }

  function toUpdate(values: TaskFormValues): UpdateTaskRequest {
    return {
      title: values.title.trim(),
      instructions: values.instructions.trim(),
      departmentId: Number(values.departmentId),
      assignedStaffId: optionalId(values.assignedStaffId),
      priority: values.priority,
      status: values.status,
      clientId: optionalId(values.clientId),
      contactId: optionalId(values.clientId) == null ? null : optionalId(values.contactId),
      dueDate: dueDateToApi(values.dueDate, values.dueTime),
    };
  }

  function toCreate(values: TaskFormValues) {
    const form = new FormData();
    form.set("Title", values.title.trim());
    form.set("Instructions", values.instructions.trim());
    form.set("DepartmentId", values.departmentId);
    form.set("Priority", values.priority);
    const assignee = optionalId(values.assignedStaffId);
    const client = optionalId(values.clientId);
    const contact = client == null ? null : optionalId(values.contactId);
    if (assignee != null) form.set("AssignedStaffId", String(assignee));
    if (client != null) form.set("ClientId", String(client));
    if (contact != null) form.set("ContactId", String(contact));
    const due = dueDateToApi(values.dueDate, values.dueTime);
    if (due) form.set("DueDate", due);
    if (prefill) {
      form.set("EmailId", String(prefill.emailId));
      for (const id of inherited) form.append("EmailAttachmentIds", String(id));
    }
    for (const file of files) form.append("Files", file);
    return form;
  }

  function toggleInherited(id: number) {
    setInherited((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  }

  const departmentOptions: SelectOption[] = useMemo(() => {
    const options: SelectOption[] = buildDepartmentTree(writable).map((d) => ({
      value: String(d.id),
      label: d.path,
      hint: d.sedeName ?? undefined,
      icon: getDepartmentIcon(d.name),
    }));
    if (task && !options.some((option) => option.value === String(task.departmentId))) {
      options.unshift({
        value: String(task.departmentId),
        label: task.departmentName,
        icon: getDepartmentIcon(task.departmentName),
      });
    }
    return options;
  }, [writable, task]);

  return (
    <Modal
      maxWidth="max-w-xl"
      eyebrow={isEdit ? `Tarea #${task.id} · ${task.number}` : prefill ? "Desde bandeja de entrada" : "Gestión operativa"}
      title={isEdit ? `Editar ${task.title}` : "Nueva tarea"}
      description={
        isEdit
          ? "Actualiza las instrucciones, prioridad, responsable o estado de la tarea."
          : prefill
          ? "El asunto, texto y adjuntos del correo se han precompletado. Ajusta los detalles antes de asignarla."
          : "Crea una gestión puntual con responsable, departamento y fecha compromiso."
      }
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
            <span className="ml-0.5">para guardar</span>
          </span>
          <div className="flex items-center gap-2 ml-auto">
            <Button type="button" variant="secondary" size="sm" onClick={requestClose}>
              Cancelar
            </Button>
            <Button type="submit" form="task-form" size="sm" isLoading={isSubmitting}>
              {isEdit ? "Guardar cambios" : "Crear tarea"}
            </Button>
          </div>
        </div>
      }
    >
      <form
        id="task-form"
        onSubmit={handleSubmit(onSubmit)}
        onKeyDown={handleKeyDown}
        noValidate
        className="flex flex-col gap-3 text-left"
      >
        {formError && <Alert variant="error">{formError}</Alert>}

        {/* 1. INFORMACIÓN BÁSICA */}
        <FormDivider title="Información general" />

        <TextField
          size="sm"
          label="Título de la tarea"
          required
          maxLength={200}
          placeholder="Qué hay que hacer"
          state={stateOf("title")}
          error={errors.title?.message}
          {...register("title")}
        />

        <TextAreaField
          label="Instrucciones"
          required
          rows={1}
          maxLength={8000}
          className="min-h-0 resize-none overflow-hidden text-[12.5px] py-2 leading-relaxed"
          placeholder="Detalla qué debe ejecutarse, pasos específicos o criterios de aceptación…"
          hint={
            <span className="flex items-center justify-between text-[11px] text-zinc-400">
              <span>Instrucciones y alcance para quien reciba la tarea</span>
              <span className={`tabular-nums ${instructions.length > 7500 ? "text-brand-red font-medium" : ""}`}>
                {instructions.length} / 8000
              </span>
            </span>
          }
          error={errors.instructions?.message}
          {...bindAutoResizeTextarea(instructionsField, 38, (el) => {
            instructionsTextareaRef.current = el;
          })}
        />

        {/* 2. PRIORIDAD */}
        <FormDivider title="Prioridad" />

        <Controller
          name="priority"
          control={control}
          render={({ field }) => (
            <div className="flex flex-col gap-1">
              <label className="font-heading text-[11.5px] font-semibold text-faint">
                Nivel de prioridad <span className="text-brand-red">*</span>
              </label>
              <div
                role="radiogroup"
                aria-label="Nivel de prioridad"
                className="grid grid-cols-2 sm:grid-cols-4 gap-1 rounded-lg border border-zinc-200 bg-zinc-50/70 p-0.5"
              >
                {PRIORITY_ITEMS.map((item) => {
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
                        className={`h-3 w-3 shrink-0 ${isSelected ? item.activeColor : "text-zinc-400"}`}
                      />
                      <span className="truncate">{item.label}</span>
                    </button>
                  );
                })}
              </div>
              {errors.priority?.message && (
                <p className="animate-plf-shake flex items-center gap-1 text-[11px] font-medium text-brand-red-dark leading-none truncate">
                  <AlertCircle className="h-3 w-3 shrink-0" />
                  <span className="truncate">{errors.priority.message}</span>
                </p>
              )}
            </div>
          )}
        />

        {/* 3. ASIGNACIÓN */}
        <FormDivider title="Asignación y área" />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <Controller
            control={control}
            name="assignedStaffId"
            render={({ field }) => (
              <LookupField
                size="sm"
                label="Asignado a"
                value={field.value}
                onChange={(value) => {
                  field.onChange(value);
                  void suggestDepartment(value);
                }}
                onBlur={field.onBlur}
                search={searchActiveStaff}
                resolveSelectedLabel={resolveStaffLabel}
                placeholder="Sin asignar"
                searchPlaceholder="Buscar colaborador…"
                clearLabel="Sin asignar"
                state={stateOf("assignedStaffId")}
                error={errors.assignedStaffId?.message}
              />
            )}
          />

          <Controller
            control={control}
            name="departmentId"
            render={({ field }) => (
              <SelectField
                size="sm"
                label="Departamento"
                required
                value={field.value}
                onChange={(value) => {
                  setDepartmentTouched(true);
                  field.onChange(value);
                }}
                onBlur={field.onBlur}
                options={departmentOptions}
                placeholder="Elige departamento"
                searchable
                state={stateOf("departmentId")}
                error={errors.departmentId?.message}
              />
            )}
          />
        </div>

        {/* 4. PLANIFICACIÓN */}
        <FormDivider title="Planificación" />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <Controller
            control={control}
            name="dueDate"
            render={({ field }) => (
              <DateField
                label="Fecha y hora límite"
                placeholder="Sin fecha límite"
                value={field.value}
                onChange={(date) => {
                  field.onChange(date);
                  if (!date) setValue("dueTime", "");
                }}
                showTime
                timeValue={dueTimeValue}
                onTimeChange={(time) => setValue("dueTime", time, { shouldValidate: true })}
                error={errors.dueDate?.message ?? errors.dueTime?.message}
                state={errors.dueDate || errors.dueTime ? "error" : stateOf("dueDate")}
                hint={<span className="block whitespace-nowrap">Opcional. Fecha y hora compromiso.</span>}
              />
            )}
          />

          {isEdit ? (
            <Controller
              control={control}
              name="status"
              render={({ field }) => (
                <SelectField
                  size="sm"
                  label="Estado de la tarea"
                  required
                  value={field.value}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  options={TASK_STATUS_EDIT_OPTIONS}
                  hint={<span className="block whitespace-nowrap">Completar o cancelar se hace desde la ficha</span>}
                  state={stateOf("status")}
                  error={errors.status?.message}
                />
              )}
            />
          ) : (
            <div className="flex flex-col justify-center rounded-lg border border-dashed border-zinc-200/90 bg-zinc-50/50 p-2.5 text-[11px] text-zinc-500 leading-relaxed">
              Al crear la tarea, se inicia en estado <strong className="font-semibold text-zinc-700">Pendiente</strong> y se notifica al responsable.
            </div>
          )}
        </div>

        {/* 5. VINCULACIÓN COMERCIAL */}
        <FormDivider title="Cliente y contacto" />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <Controller
            control={control}
            name="clientId"
            render={({ field }) => (
              <LookupField
                size="sm"
                label="Cliente vinculado"
                value={field.value}
                onChange={(value) => {
                  field.onChange(value);
                  setContactTouched(false);
                  setValue("contactId", "");
                }}
                onBlur={field.onBlur}
                search={searchClients}
                resolveSelectedLabel={resolveClientLabel}
                placeholder="Sin cliente vinculado"
                searchPlaceholder="Buscar cliente…"
                clearLabel="Sin cliente vinculado"
                state={stateOf("clientId")}
                error={errors.clientId?.message}
              />
            )}
          />

          <Controller
            control={control}
            name="contactId"
            render={({ field }) => (
              <SelectField
                size="sm"
                label="Contacto del cliente"
                value={field.value}
                onChange={(value) => {
                  setContactTouched(true);
                  field.onChange(value);
                }}
                onBlur={field.onBlur}
                disabled={clientId === ""}
                placeholder={clientId === "" ? "Primero elige el cliente" : "Sin contacto seleccionado"}
                options={[
                  { value: "", label: "Sin contacto seleccionado" },
                  ...contacts.map((contact) => ({
                    value: String(contact.id),
                    label: `${contact.firstName} ${contact.lastName}`,
                  })),
                ]}
                state={stateOf("contactId")}
                error={errors.contactId?.message}
              />
            )}
          />
        </div>

        {/* 6. ADJUNTOS */}
        {((prefill && prefill.attachments.length > 0) || !isEdit) && (
          <>
            <FormDivider title="Documentos y adjuntos" />

            {prefill && prefill.attachments.length > 0 && (
              <fieldset className="flex flex-col gap-1.5">
                <legend className="font-heading text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
                  Adjuntos del correo original
                </legend>
                <ul className="flex flex-col gap-1.5 rounded-lg border border-zinc-200 bg-zinc-50/50 p-2.5">
                  {prefill.attachments.map((file) => {
                    const blocked = !file.available || file.dangerous;
                    return (
                      <li key={file.id}>
                        <label className="flex items-center gap-2 text-[12px] text-zinc-700 cursor-pointer">
                          <input
                            type="checkbox"
                            className="rounded border-zinc-300 text-brand-red focus:ring-brand-red/20 accent-brand-red"
                            checked={!blocked && inherited.includes(file.id)}
                            disabled={blocked}
                            onChange={() => toggleInherited(file.id)}
                          />
                          <span className={blocked ? "text-zinc-400 line-through" : "font-medium"}>
                            {file.fileName}
                            {blocked ? " · no disponible" : ""}
                          </span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              </fieldset>
            )}

            {!isEdit && (
              <TaskEvidenceUpload
                files={files}
                onFilesChange={setFiles}
                onReportError={setFormError}
                label="Archivos adjuntos iniciales"
                dropzoneTitle="Haz clic para adjuntar archivos"
                dropzoneHint="Documentos, imágenes o guías para quien reciba la tarea."
              />
            )}
          </>
        )}
      </form>
    </Modal>
  );
}
