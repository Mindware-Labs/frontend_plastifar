import { zodResolver } from "@hookform/resolvers/zod";
import { Lock, Users } from "lucide-react";
import { useMemo, useState, type KeyboardEvent } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { SubmitValidationButton } from "../../components/app/SubmitValidationButton";
import { departmentsApi } from "../../api/departments";
import { sedesApi } from "../../api/sedes";
import { catalogs, fetchCatalog } from "../../lib/catalogQueries";
import { Alert } from "../../components/ui/Alert";
import {
  CheckboxField,
  LookupField,
  SelectField,
  TextField,
  type FieldState,
} from "../../components/ui/Field";
import { FormDivider } from "../../components/ui/FormDivider";
import { FormModalFooter } from "../../components/ui/FormModalFooter";
import { Modal } from "../../components/ui/Modal";
import { SegmentedChoice } from "../../components/ui/SegmentedChoice";
import { useModalAnimation } from "../../hooks/useModalAnimation";
import { applyServerError, type ServerErrorRule } from "../../lib/formErrors";
import { resolveStaffLabel, searchActiveStaff } from "../../lib/lookups";
import { buildValidationItems, focusFormField } from "../../lib/validationItems";
import type { DepartmentResponse, RoleResponse } from "../../types/api";
import type { Sede } from "../../types/sedes";
import { useReferenceData } from "../settings/catalogState";

const schema = z.object({
  name: z.string().trim().min(2, "Al menos 2 caracteres").max(60, "Máximo 60 caracteres"),
  sedeId: z.string(),
  type: z.enum(["Publico", "Privado"], { message: "Elige si es público o privado" }),
  defaultRoleId: z.string(),
  managerStaffId: z.string(),
  isActive: z.boolean(),
});

type FormValues = z.infer<typeof schema>;

const SIN_SEDE = "";
const NINGUNO = "";

const CAMPO_POR_MENSAJE: ServerErrorRule<keyof FormValues>[] = [
  { field: "name", startsWith: "el nombre debe" },
  { field: "name", startsWith: "ya existe un departamento" },
  { field: "type", startsWith: "el tipo debe" },
  { field: "sedeId", startsWith: "la sede" },
  { field: "defaultRoleId", startsWith: "el rol no existe" },
  { field: "managerStaffId", startsWith: "el responsable no existe" },
];

const DEPARTMENT_TYPE_ITEMS = [
  { value: "Publico" as const, label: "Público", icon: Users },
  { value: "Privado" as const, label: "Privado", icon: Lock },
];

interface DepartmentModalProps {
  department?: DepartmentResponse;
  onClose: () => void;
  onSaved: (name: string) => void;
}

export function DepartmentModal({ department, onClose, onSaved }: DepartmentModalProps) {
  const isEdit = department !== undefined;
  const [formError, setFormError] = useState<string | null>(null);
  const { isExiting, requestClose } = useModalAnimation();

  const sedesRef = useReferenceData<Sede[]>(
    ["sedes", "all"],
    async () => {
      const res = await sedesApi.list({ includeInactive: true, pageSize: 100 });
      return res.items;
    },
    [],
  );

  const rolesRef = useReferenceData<RoleResponse[]>(
    catalogs.roles().queryKey,
    () => fetchCatalog(catalogs.roles()),
    [],
  );

  const {
    register,
    control,
    handleSubmit,
    setError,
    setFocus,
    formState: { errors, touchedFields, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    mode: "onTouched",
    defaultValues: {
      name: department?.name ?? "",
      sedeId: department?.sedeId != null ? String(department.sedeId) : SIN_SEDE,
      type: (department?.type as "Publico" | "Privado") ?? "Publico",
      defaultRoleId: department?.defaultRoleId != null ? String(department.defaultRoleId) : NINGUNO,
      managerStaffId:
        department?.managerStaffId != null ? String(department.managerStaffId) : NINGUNO,
      isActive: department?.isActive ?? true,
    },
  });

  const departmentName = useWatch({ control, name: "name" }) ?? "";
  const departmentFormMissing = useMemo(
    () =>
      buildValidationItems([
        {
          id: "name",
          label: "Falta el nombre del departamento",
          short: "el nombre",
          valid: departmentName.trim().length >= 2,
        },
      ]),
    [departmentName],
  );

  const opcionesSede = [
    { value: SIN_SEDE, label: "Sin sede" },
    ...sedesRef.data
      .filter((s) => s.isActive || s.id === department?.sedeId)
      .map((s) => ({
        value: String(s.id),
        label: s.isActive ? s.name : `${s.name} (inactiva)`,
      })),
  ];
  if (
    department?.sedeId != null &&
    !sedesRef.data.some((s) => s.id === department.sedeId)
  ) {
    opcionesSede.push({
      value: String(department.sedeId),
      label: department.sedeName ?? `Sede #${department.sedeId}`,
    });
  }

  const opcionesRol = [
    { value: NINGUNO, label: "Sin rol" },
    ...rolesRef.data
      .filter((role) => role.isActive || role.id === department?.defaultRoleId)
      .map((role) => ({
        value: String(role.id),
        label: role.isActive ? role.name : `${role.name} (inactivo)`,
      })),
  ];
  if (
    department?.defaultRoleId != null &&
    !rolesRef.data.some((role) => role.id === department.defaultRoleId)
  ) {
    opcionesRol.push({
      value: String(department.defaultRoleId),
      label: department.defaultRoleName ?? `Rol #${department.defaultRoleId}`,
    });
  }

  function stateOf(field: keyof FormValues): FieldState {
    if (errors[field]) return "error";
    return touchedFields[field] ? "valid" : "idle";
  }

  function handleKeyDown(event: KeyboardEvent<HTMLFormElement>) {
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
      event.preventDefault();
      void handleSubmit(onSubmit)();
    }
  }

  async function onSubmit(values: FormValues) {
    setFormError(null);
    const request = {
      name: values.name.trim(),
      parentId: department?.parentId ?? null,
      sedeId: values.sedeId === SIN_SEDE ? null : Number(values.sedeId),
      isActive: values.isActive,
      type: values.type,
      defaultRoleId: values.defaultRoleId === NINGUNO ? null : Number(values.defaultRoleId),
      mailboxId: null,
      managerStaffId: values.managerStaffId === NINGUNO ? null : Number(values.managerStaffId),
    };

    try {
      if (isEdit) await departmentsApi.update(department.id, request);
      else await departmentsApi.create(request);
      onSaved(request.name);
      requestClose();
    } catch (err) {
      setFormError(
        applyServerError(err, {
          setError,
          setFocus,
          rules: CAMPO_POR_MENSAJE,
          focusable: ["name"],
          fallback: isEdit ? "No se pudo guardar el departamento" : "No se pudo crear el departamento",
        }),
      );
    }
  }

  return (
    <Modal
      maxWidth="max-w-xl"
      eyebrow={
        isEdit
          ? `Departamento #${department.id} · ${department.sedeName ?? "Sin sede"}`
          : "Estructura organizacional"
      }
      title={isEdit ? `Editar ${department.name}` : "Nuevo departamento"}
      description={
        isEdit
          ? "Actualiza la sede, el nombre y las asignaciones del departamento."
          : "Define sede, nombre y quién administra el acceso."
      }
      onClose={onClose}
      isExiting={isExiting}
      onRequestClose={requestClose}
      footer={
        <FormModalFooter
          formId="department-form"
          isEdit={isEdit}
          createLabel="Crear departamento"
          isSubmitting={isSubmitting}
          onCancel={requestClose}
          size="sm"
          submit={
            <SubmitValidationButton
              formId="department-form"
              ready={departmentFormMissing.length === 0}
              busy={isSubmitting}
              missingItems={departmentFormMissing}
              onFocusField={focusFormField}
              hintText="Para guardar el departamento, completa lo siguiente:"
            >
              {isEdit ? "Guardar cambios" : "Crear departamento"}
            </SubmitValidationButton>
          }
        />
      }
    >
      <form
        id="department-form"
        onSubmit={handleSubmit(onSubmit)}
        onKeyDown={handleKeyDown}
        noValidate
        className="flex flex-col gap-3 text-left"
      >
        {formError && <Alert variant="error">{formError}</Alert>}

        <FormDivider title="Identificación" />

        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          <Controller
            name="sedeId"
            control={control}
            render={({ field }) => (
              <SelectField
                size="sm"
                searchable
                label="Sede"
                name={field.name}
                value={field.value}
                onChange={field.onChange}
                onBlur={field.onBlur}
                placeholder="Sin sede"
                options={opcionesSede}
                state={stateOf("sedeId")}
                error={errors.sedeId?.message}
              />
            )}
          />

          <TextField
            size="sm"
            label="Nombre del departamento"
            placeholder="Ej. Almacén, Ventas, Calidad"
            required
            autoFocus
            state={stateOf("name")}
            error={errors.name?.message}
            {...register("name")}
          />
        </div>

        <FormDivider title="Asignaciones" />

        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          <Controller
            name="managerStaffId"
            control={control}
            render={({ field }) => (
              <LookupField
                size="sm"
                label="Administrador"
                name={field.name}
                value={field.value}
                onChange={(value) => field.onChange(value)}
                onBlur={field.onBlur}
                placeholder="Sin administrador"
                searchPlaceholder="Buscar colaborador…"
                clearLabel="Sin administrador"
                search={searchActiveStaff}
                selectedLabel={
                  department?.managerStaffId != null &&
                  field.value === String(department.managerStaffId)
                    ? (department.managerName ?? null)
                    : null
                }
                resolveSelectedLabel={resolveStaffLabel}
                state={stateOf("managerStaffId")}
                error={errors.managerStaffId?.message}
              />
            )}
          />

          <Controller
            name="defaultRoleId"
            control={control}
            render={({ field }) => (
              <SelectField
                size="sm"
                searchable
                label="Rol predeterminado"
                name={field.name}
                value={field.value}
                onChange={field.onChange}
                onBlur={field.onBlur}
                placeholder="Sin rol"
                options={opcionesRol}
                state={stateOf("defaultRoleId")}
                error={errors.defaultRoleId?.message}
              />
            )}
          />
        </div>

        <FormDivider title="Visibilidad" />

        <Controller
          name="type"
          control={control}
          render={({ field }) => (
            <SegmentedChoice
              label="Tipo de departamento"
              required
              options={DEPARTMENT_TYPE_ITEMS}
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
              error={errors.type?.message}
            />
          )}
        />

        {isEdit && (
          <CheckboxField
            label="Departamento activo"
            description="Si se desmarca, deja de usarse en tickets y asignaciones nuevas."
            {...register("isActive")}
          />
        )}
      </form>
    </Modal>
  );
}
