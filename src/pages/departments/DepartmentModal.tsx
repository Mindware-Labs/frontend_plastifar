import { zodResolver } from "@hookform/resolvers/zod";
import { Lock, Users } from "lucide-react";
import React, { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { departmentsApi } from "../../api/departments";
import { fetchAllPages } from "../../api/paging";
import { rolesApi } from "../../api/roles";
import { sedesApi } from "../../api/sedes";
import { Alert } from "../../components/ui/Alert";
import {
  CheckboxField,
  LookupField,
  SelectField,
  TextField,
  type FieldState,
} from "../../components/ui/Field";
import { Modal } from "../../components/ui/Modal";
import { FormModalFooter } from "../../components/ui/FormModalFooter";
import { useModalAnimation } from "../../hooks/useModalAnimation";
import { applyServerError, type ServerErrorRule } from "../../lib/formErrors";
import { resolveStaffLabel, searchActiveStaff } from "../../lib/lookups";
import type { DepartmentResponse, RoleResponse } from "../../types/api";
import type { Sede } from "../../types/sedes";
import { useReferenceData } from "../settings/catalogState";
import { FormDivider } from "../../components/ui/FormDivider";

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

interface DepartmentModalProps {
  department?: DepartmentResponse;
  all?: DepartmentResponse[];
  onClose: () => void;
  onSaved: () => void;
}

export function DepartmentModal({ department, onClose, onSaved }: DepartmentModalProps) {
  const isEdit = department !== undefined;
  const [formError, setFormError] = useState<string | null>(null);
  const { isExiting, requestClose } = useModalAnimation();

  const sedesRef = useReferenceData<Sede[]>(
    async () => {
      const res = await sedesApi.list({ includeInactive: true, pageSize: 100 });
      return res.items;
    },
    [],
  );

  const rolesRef = useReferenceData<RoleResponse[]>(
    () => fetchAllPages((page, pageSize) => rolesApi.list({ page, pageSize, dir: "asc" })),
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

  function handleKeyDown(event: React.KeyboardEvent<HTMLFormElement>) {
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
      onSaved();
      requestClose();
    } catch (err) {
      setFormError(
        applyServerError(err, {
          setError,
          setFocus,
          rules: CAMPO_POR_MENSAJE,
          focusable: ["name"],
          fallback: "No se pudo guardar el departamento",
        }),
      );
    }
  }

  return (
    <Modal
      size="lg"
      title={isEdit ? `Editar ${department.name}` : "Nuevo departamento"}
      description={
        isEdit
          ? "Actualiza los datos y asignaciones del departamento."
          : "Define la sede, denominación y configuración de acceso."
      }
      onClose={onClose}
      isExiting={isExiting}
      onRequestClose={requestClose}
      footer={
        <FormModalFooter
          shortcut
          formId="department-form"
          isEdit={isEdit}
          createLabel="Crear departamento"
          isSubmitting={isSubmitting}
          onCancel={requestClose}
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

        {/* 1. GENERAL */}
        <FormDivider title="General" tight />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
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
            label="Nombre"
            placeholder="Ej. Almacén, Ventas"
            required
            state={stateOf("name")}
            error={errors.name?.message}
            {...register("name")}
          />
        </div>

        {/* 2. CONFIGURACIÓN */}
        <FormDivider title="Configuración" tight />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
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

        <Controller
          name="type"
          control={control}
          render={({ field }) => (
            <div className="flex flex-col gap-1">
              <label className="font-heading text-[11.5px] font-semibold text-faint">
                Tipo <span className="text-brand-red">*</span>
              </label>
              <div
                role="radiogroup"
                aria-label="Tipo de departamento"
                className="grid grid-cols-2 gap-1 rounded-lg border border-zinc-200 bg-zinc-50/70 p-0.5"
              >
                {[
                  { value: "Publico", label: "Público", icon: Users },
                  { value: "Privado", label: "Privado", icon: Lock },
                ].map((item) => {
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
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        />

        {/* 3. ESTADO (EN EDICIÓN) */}
        {isEdit && (
          <>
            <FormDivider title="Estado" tight />
            <CheckboxField
              label="Departamento activo"
              {...register("isActive")}
            />
          </>
        )}
      </form>
    </Modal>
  );
}
