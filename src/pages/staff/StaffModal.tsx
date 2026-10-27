import { zodResolver } from "@hookform/resolvers/zod";
import React, { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { ApiError } from "../../api/client";
import { rolesApi } from "../../api/roles";
import { staffApi } from "../../api/staff";
import { Alert } from "../../components/ui/Alert";
import { CheckboxField, SelectField, TextField, type FieldState } from "../../components/ui/Field";
import { FormDivider } from "../../components/ui/FormDivider";
import { Modal } from "../../components/ui/Modal";
import { FormModalFooter } from "../../components/ui/FormModalFooter";
import { useAuth } from "../../context/useAuth";
import { useModalAnimation } from "../../hooks/useModalAnimation";
import { departmentPathOptions } from "../../lib/departments";
import type { DepartmentResponse, RoleResponse, StaffResponse } from "../../types/api";

const schema = z.object({
  firstName: z
    .string()
    .trim()
    .min(2, "Al menos 2 caracteres")
    .max(60, "Máximo 60 caracteres"),
  lastName: z.string().trim().min(2, "Al menos 2 caracteres").max(60, "Máximo 60 caracteres"),
  email: z
    .string()
    .trim()
    .min(1, "El correo es obligatorio")
    .email("Formato de correo inválido, revisa el @ y el dominio")
    .max(120, "Máximo 120 caracteres"),
  primaryDepartmentId: z.string().min(1, "Elige el departamento al que pertenece"),
  primaryRoleId: z.string().min(1, "Elige el rol para el colaborador"),
  isActive: z.boolean(),
});

type FormValues = z.infer<typeof schema>;

const EMAIL_CONFLICT_PREFIX = "Ya existe un staff con ese correo";

function conflictField(message: string): "email" | null {
  if (message.startsWith(EMAIL_CONFLICT_PREFIX)) return "email";
  return null;
}

interface StaffModalProps {
  departments: DepartmentResponse[];
  /** Presente = edición; ausente = alta. */
  staff?: StaffResponse;
  onClose: () => void;
  onSaved: (staff: StaffResponse) => void;
}

/** Alta y edición de personal con diseño compacto siguiendo el estándar de ClientModal. */
export function StaffModal({ departments, staff, onClose, onSaved }: StaffModalProps) {
  const { user } = useAuth();
  const [formError, setFormError] = useState<string | null>(null);
  const [roles, setRoles] = useState<RoleResponse[]>([]);
  // Nace cargando: el catalogo se pide al montar
  const [loadingRoles, setLoadingRoles] = useState(true);
  const { isExiting, requestClose } = useModalAnimation();
  const isEdit = staff !== undefined;
  const isSelf = isEdit && staff.id === user?.staffId;

  const {
    register,
    control,
    handleSubmit,
    setError,
    setFocus,
    setValue,
    formState: { errors, touchedFields, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    mode: "onTouched",
    defaultValues: {
      firstName: staff?.firstName ?? "",
      lastName: staff?.lastName ?? "",
      email: staff?.email ?? "",
      primaryDepartmentId: staff ? String(staff.primaryDepartmentId) : "",
      primaryRoleId: staff?.primaryRoleId ? String(staff.primaryRoleId) : "",
      isActive: staff?.isActive ?? true,
    },
  });

  // Carga de catálogo de roles activos
  useEffect(() => {
    let mounted = true;
    rolesApi
      .list({ page: 1, pageSize: 100 })
      .then((res) => {
        if (mounted) setRoles(res.items);
      })
      .catch(() => {
        if (mounted) setRoles([]);
      })
      .finally(() => {
        if (mounted) setLoadingRoles(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  // En edición, si el objeto staff no traía primaryRoleId, se consulta su acceso principal
  useEffect(() => {
    if (!isEdit || !staff || staff.primaryRoleId) return;
    let mounted = true;
    staffApi
      .getDepartmentAccess(staff.id)
      .then((detail) => {
        if (!mounted) return;
        const primary = detail.accesses.find((a) => a.isPrimary) ?? detail.accesses[0];
        if (primary) {
          setValue("primaryRoleId", String(primary.roleId), { shouldValidate: true });
        }
      })
      .catch(() => {
        // En caso de fallo silencioso se conserva el estado actual
      });

    return () => {
      mounted = false;
    };
  }, [isEdit, staff, setValue]);

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
    const primaryDepartmentId = Number(values.primaryDepartmentId);
    const primaryRoleId = Number(values.primaryRoleId);

    try {
      if (isEdit) {
        const saved = await staffApi.update(staff.id, {
          firstName: values.firstName,
          lastName: values.lastName,
          email: values.email,
          primaryDepartmentId,
          primaryRoleId,
          isAdmin: staff.isAdmin,
          isActive: values.isActive,
          legacyUsername: staff.legacyUsername,
        });

        // Asegurar que el rol asignado al departamento principal quede sincronizado
        try {
          await staffApi.grantDepartmentAccess(staff.id, {
            departmentId: primaryDepartmentId,
            roleId: primaryRoleId,
            isPrimary: true,
          });
        } catch {
          try {
            await staffApi.updateDepartmentAccess(staff.id, primaryDepartmentId, {
              roleId: primaryRoleId,
              isPrimary: true,
            });
          } catch {
            // Ya sincronizado en la actualización principal
          }
        }

        onSaved(saved);
      } else {
        const saved = await staffApi.create({
          firstName: values.firstName,
          lastName: values.lastName,
          email: values.email,
          primaryDepartmentId,
          primaryRoleId,
          isAdmin: false,
        });
        onSaved(saved);
      }

      requestClose();
    } catch (err) {
      const field =
        err instanceof ApiError && err.status === 409 ? conflictField(err.message) : null;
      if (field !== null && err instanceof ApiError) {
        setError(field, { message: err.message });
        setFocus(field);
        return;
      }

      const fallback = isEdit ? "No se pudo guardar el colaborador" : "No se pudo registrar el colaborador";
      setFormError(err instanceof ApiError ? err.message : fallback);
    }
  }

  return (
    <Modal
      size="lg"
      title={isEdit ? `Editar ${staff.firstName} ${staff.lastName}` : "Nuevo colaborador"}
      description={
        isEdit
          ? "Actualiza los datos personales, adscripción departamental o rol asignado."
          : "El alta es interna: no existe registro público en el sistema."
      }
      onClose={onClose}
      isExiting={isExiting}
      onRequestClose={requestClose}
      footer={
        <FormModalFooter
          shortcut
          formId="staff-form"
          isEdit={isEdit}
          createLabel="Crear colaborador"
          isSubmitting={isSubmitting}
          onCancel={requestClose}
        />
      }
    >
      <form
        id="staff-form"
        onSubmit={handleSubmit(onSubmit)}
        onKeyDown={handleKeyDown}
        noValidate
        className="flex flex-col gap-3 text-left"
      >
        {formError && <Alert variant="error">{formError}</Alert>}

        {/* 1. IDENTIFICACIÓN */}
        <FormDivider title="Identificación" />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <TextField
            size="sm"
            label="Nombre"
            placeholder="Juan"
            autoComplete="given-name"
            required
            state={stateOf("firstName")}
            error={errors.firstName?.message}
            {...register("firstName")}
          />
          <TextField
            size="sm"
            label="Apellido"
            placeholder="Pérez"
            autoComplete="family-name"
            required
            state={stateOf("lastName")}
            error={errors.lastName?.message}
            {...register("lastName")}
          />
        </div>

        {/* 2. CUENTA Y CONTACTO */}
        <FormDivider title="Cuenta y acceso" />

        <TextField
          size="sm"
          label="Correo corporativo"
          type="email"
          inputMode="email"
          placeholder="correo@plastifar.com"
          autoComplete="off"
          required
          state={stateOf("email")}
          error={errors.email?.message}
          hint={
            isEdit
              ? "Dirección con la que inicia sesión."
              : "A esta dirección llegará el enlace de activación."
          }
          {...register("email")}
        />

        {/* 3. ORGANIZACIÓN Y ROL */}
        <FormDivider title="Organización" />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <Controller
            name="primaryDepartmentId"
            control={control}
            render={({ field }) => (
              <SelectField
                size="sm"
                searchable
                label="Departamento principal"
                required
                name={field.name}
                value={field.value}
                onChange={field.onChange}
                onBlur={field.onBlur}
                placeholder="Elige un departamento…"
                options={departmentPathOptions(departments)}
                state={stateOf("primaryDepartmentId")}
                error={errors.primaryDepartmentId?.message}
              />
            )}
          />

          <Controller
            name="primaryRoleId"
            control={control}
            render={({ field }) => (
              <SelectField
                size="sm"
                searchable
                label="Rol asignado"
                required
                name={field.name}
                value={field.value}
                onChange={field.onChange}
                onBlur={field.onBlur}
                placeholder={loadingRoles ? "Cargando roles…" : "Elige un rol…"}
                options={roles
                  .filter((r) => r.isActive || String(r.id) === field.value)
                  .map((r) => ({
                    value: String(r.id),
                    label: r.isActive ? r.name : `${r.name} (inactivo)`,
                  }))}
                state={stateOf("primaryRoleId")}
                error={errors.primaryRoleId?.message}
              />
            )}
          />
        </div>

        {/* 4. ESTADO (SOLO EN EDICIÓN) */}
        {isEdit && (
          <>
            <FormDivider title="Estado" />
            <CheckboxField
              label="Colaborador activo"
              description="Si se desmarca, la persona deja de poder iniciar sesión."
              disabled={isSelf}
              {...register("isActive")}
            />
          </>
        )}

        {isSelf && (
          <Alert variant="info">
            Estás editando tu propio usuario: no puedes desactivarte a ti mismo.
          </Alert>
        )}
      </form>
    </Modal>
  );
}
