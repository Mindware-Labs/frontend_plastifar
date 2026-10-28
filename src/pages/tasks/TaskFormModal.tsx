import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useMemo, useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { ApiError } from "../../api/client";
import { clientsApi } from "../../api/clients";
import { departmentsApi } from "../../api/departments";
import { staffApi } from "../../api/staff";
import { tasksApi } from "../../api/tasks";
import { TaskEvidenceUpload } from "../../components/app/TaskEvidenceUpload";
import { Alert } from "../../components/ui/Alert";
import { Button } from "../../components/ui/Button";
import { DateField, LookupField, SelectField, TextAreaField, TextField } from "../../components/ui/Field";
import { Modal } from "../../components/ui/Modal";
import type { SelectOption } from "../../components/ui/Select";
import { useModalAnimation } from "../../hooks/useModalAnimation";
import { usePermissions } from "../../hooks/usePermissions";
import { getDepartmentIcon } from "../../lib/departmentFilterOptions";
import { buildDepartmentTree } from "../../lib/departments";
import { resolveClientLabel, resolveStaffLabel, searchActiveStaff, searchClients } from "../../lib/lookups";
import type { DepartmentResponse } from "../../types/api";
import type { Contact } from "../../types/clients";
import type { EmailTaskPrefill, TaskDetail, TaskPriority, UpdateTaskRequest } from "../../types/tasks";
import { TASK_STATUS_EDIT_OPTIONS } from "./taskCells";
import { dueDateFromApi, dueDateToApi, taskFormSchema, type TaskFormValues } from "./taskSchema";

interface TaskFormModalProps {
  task?: TaskDetail;
  prefill?: EmailTaskPrefill;
  onClose: () => void;
  onSaved: (task: TaskDetail) => void;
}

function optionalId(value: string): number | null {
  return value === "" ? null : Number(value);
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
  const { isExiting, requestClose } = useModalAnimation();

  const writable = useMemo(
    () => departments.filter((department) => isAdmin || can("tasks.write", department.id)),
    [departments, isAdmin, can],
  );

  const {
    control,
    register,
    handleSubmit,
    setValue,
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
      dueDate: dueDateFromApi(task?.dueDate ?? null),
    },
  });

  const clientId = useWatch({ control, name: "clientId" }) ?? "";
  const instructions = useWatch({ control, name: "instructions" }) ?? "";

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
        if (!cancelled) setContacts(page.items);
      })
      .catch(() => {
        if (!cancelled) setContacts([]);
      });
    return () => {
      cancelled = true;
    };
  }, [clientId]);

  function stateOf(field: keyof TaskFormValues): "error" | "valid" | "idle" {
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
      dueDate: dueDateToApi(values.dueDate),
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
    const due = dueDateToApi(values.dueDate);
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
      eyebrow={isEdit ? task.number : prefill ? "Desde el correo" : "Tarea independiente"}
      title={isEdit ? "Editar tarea" : "Nueva tarea"}
      description={
        prefill
          ? "El asunto, el texto y los adjuntos del correo ya vienen cargados. Ajusta lo que haga falta antes de asignarla."
          : "Una gestión puntual, con responsable, seguimiento y cierre."
      }
      onClose={onClose}
      isExiting={isExiting}
      onRequestClose={requestClose}
      footer={
        <div className="flex w-full items-center justify-end gap-2">
          <Button type="button" variant="secondary" size="sm" onClick={requestClose}>
            Cancelar
          </Button>
          <Button type="submit" form="task-form" size="sm" isLoading={isSubmitting}>
            {isEdit ? "Guardar cambios" : "Crear tarea"}
          </Button>
        </div>
      }
    >
      <form id="task-form" onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-3 text-left">
        {formError && <Alert variant="error">{formError}</Alert>}

        <TextField
          label="Título"
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
          rows={5}
          maxLength={8000}
          placeholder="Qué debe ejecutarse, con el detalle necesario para quien la reciba"
          error={errors.instructions?.message}
          {...register("instructions")}
        />
        <p className="-mt-1 text-right text-[11px] text-zinc-400">{instructions.length}/8000</p>

        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          <Controller
            control={control}
            name="assignedStaffId"
            render={({ field }) => (
              <LookupField
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
                label="Departamento / área"
                required
                value={field.value}
                onChange={(value) => {
                  setDepartmentTouched(true);
                  field.onChange(value);
                }}
                onBlur={field.onBlur}
                options={departmentOptions}
                placeholder="Elige el área"
                searchable
                state={stateOf("departmentId")}
                error={errors.departmentId?.message}
                hint="Si eliges un responsable, se propone su departamento. Puedes cambiarlo."
              />
            )}
          />
        </div>

        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          <Controller
            control={control}
            name="priority"
            render={({ field }) => (
              <SelectField
                label="Prioridad"
                required
                value={field.value}
                onChange={(value) => field.onChange(value as TaskPriority)}
                onBlur={field.onBlur}
                options={[
                  { value: "Emergencia", label: "Emergencia" },
                  { value: "Alta", label: "Alta" },
                  { value: "Normal", label: "Normal" },
                  { value: "Baja", label: "Baja" },
                ]}
                state={stateOf("priority")}
                error={errors.priority?.message}
              />
            )}
          />

          {isEdit ? (
            <Controller
              control={control}
              name="status"
              render={({ field }) => (
                <SelectField
                  label="Estado"
                  required
                  value={field.value}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  options={TASK_STATUS_EDIT_OPTIONS}
                  hint="Completar o cancelar se hace desde la ficha."
                  state={stateOf("status")}
                  error={errors.status?.message}
                />
              )}
            />
          ) : (
            <Controller
              control={control}
              name="dueDate"
              render={({ field }) => (
                <DateField
                  label="Fecha límite"
                  value={field.value}
                  onChange={field.onChange}
                  state={stateOf("dueDate")}
                  error={errors.dueDate?.message}
                  hint="Opcional. El cálculo automático por SLA de tareas todavía no está activo."
                />
              )}
            />
          )}
        </div>

        {isEdit && (
          <Controller
            control={control}
            name="dueDate"
            render={({ field }) => (
              <DateField
                label="Fecha límite"
                value={field.value}
                onChange={field.onChange}
                state={stateOf("dueDate")}
                error={errors.dueDate?.message}
                hint="Opcional. El cálculo automático por SLA de tareas todavía no está activo."
              />
            )}
          />
        )}

        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          <Controller
            control={control}
            name="clientId"
            render={({ field }) => (
              <LookupField
                label="Cliente"
                value={field.value}
                onChange={(value) => {
                  field.onChange(value);
                  setValue("contactId", "");
                }}
                onBlur={field.onBlur}
                search={searchClients}
                resolveSelectedLabel={resolveClientLabel}
                placeholder="Sin cliente"
                searchPlaceholder="Buscar cliente…"
                clearLabel="Sin cliente"
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
                label="Contacto"
                value={field.value}
                onChange={field.onChange}
                onBlur={field.onBlur}
                disabled={clientId === ""}
                placeholder={clientId === "" ? "Primero elige el cliente" : "Sin contacto"}
                options={[
                  { value: "", label: "Sin contacto" },
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

        {prefill && prefill.attachments.length > 0 && (
          <fieldset className="flex flex-col gap-1.5">
            <legend className="font-heading text-[11.5px] font-semibold text-faint">Adjuntos del correo</legend>
            <ul className="flex flex-col gap-1">
              {prefill.attachments.map((file) => {
                const blocked = !file.available || file.dangerous;
                return (
                  <li key={file.id}>
                    <label className="flex items-center gap-2 text-[12.5px] text-zinc-700">
                      <input
                        type="checkbox"
                        className="accent-brand-red"
                        checked={!blocked && inherited.includes(file.id)}
                        disabled={blocked}
                        onChange={() => toggleInherited(file.id)}
                      />
                      <span className={blocked ? "text-zinc-400" : ""}>
                        {file.fileName}
                        {blocked ? " · no se puede copiar" : ""}
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
            label="Adjuntos iniciales"
            dropzoneTitle="Haz clic para adjuntar archivos"
            dropzoneHint="Guías, documentos o lo que la persona asignada necesite para empezar."
          />
        )}
      </form>
    </Modal>
  );
}
