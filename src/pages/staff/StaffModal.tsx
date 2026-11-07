import { zodResolver } from "@hookform/resolvers/zod";
import React, { useEffect, useMemo, useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { ApiError } from "../../api/client";
import { rolesApi } from "../../api/roles";
import { staffApi } from "../../api/staff";
import { Alert } from "../../components/ui/Alert";
import { Button } from "../../components/ui/Button";
import { CheckboxField, SelectField, TextField, type FieldState } from "../../components/ui/Field";
import { FormDivider } from "../../components/ui/FormDivider";
import { Modal } from "../../components/ui/Modal";
import { SubmitValidationButton } from "../../components/app/SubmitValidationButton";
import { useAuth } from "../../context/useAuth";
import { useReceipts } from "../../context/useReceipts";
import { useModalAnimation } from "../../hooks/useModalAnimation";
import { departmentPathOptions } from "../../lib/departments";
import { buildValidationItems, focusFormField } from "../../lib/validationItems";
import type { DepartmentResponse, RoleResponse, StaffResponse } from "../../types/api";
import { StaffSalesRepClientModal } from "./StaffSalesRepClientModal";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/;

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
  isAdmin: z.boolean(),
  isActive: z.boolean(),
  isSalesRep: z.boolean(),
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

/** Alta y edición de personal con diseño y validación siguiendo el estándar de ClientModal. */
export function StaffModal({ departments, staff, onClose, onSaved }: StaffModalProps) {
  const { user } = useAuth();
  const receipts = useReceipts();
  const [formError, setFormError] = useState<string | null>(null);
  const [clientModalOpen, setClientModalOpen] = useState(false);
  const [pendingValues, setPendingValues] = useState<FormValues | null>(null);
  const [roles, setRoles] = useState<RoleResponse[]>([]);
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
      isAdmin: staff?.isAdmin ?? false,
      isActive: staff?.isActive ?? true,
      isSalesRep: staff?.isSalesRep ?? false,
    },
  });

  const firstName = useWatch({ control, name: "firstName" }) ?? "";
  const lastName = useWatch({ control, name: "lastName" }) ?? "";
  const email = useWatch({ control, name: "email" }) ?? "";
  const primaryDepartmentId = useWatch({ control, name: "primaryDepartmentId" }) ?? "";
  const primaryRoleId = useWatch({ control, name: "primaryRoleId" }) ?? "";

  const staffFormMissing = useMemo(
    () =>
      buildValidationItems([
        {
          id: "firstName",
          label: "Falta el nombre (mínimo 2 caracteres)",
          short: "el nombre",
          valid: firstName.trim().length >= 2,
        },
        {
          id: "lastName",
          label: "Falta el apellido (mínimo 2 caracteres)",
          short: "el apellido",
          valid: lastName.trim().length >= 2,
        },
        {
          id: "email",
          label: "Falta un correo corporativo válido",
          short: "el correo",
          valid: email.trim().length > 0 && EMAIL_REGEX.test(email.trim()),
        },
        {
          id: "primaryDepartmentId",
          label: "Falta seleccionar el departamento principal",
          short: "el departamento",
          valid: primaryDepartmentId.trim().length > 0,
        },
        {
          id: "primaryRoleId",
          label: "Falta seleccionar el rol asignado",
          short: "el rol",
          valid: primaryRoleId.trim().length > 0,
        },
      ]),
    [firstName, lastName, email, primaryDepartmentId, primaryRoleId],
  );

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

  async function saveStaff(values: FormValues, assignClientId?: number) {
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
          isAdmin: values.isAdmin,
          isActive: values.isActive,
          isSalesRep: values.isSalesRep,
          assignClientId: assignClientId ?? null,
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

        receipts.done({
          action: "editar-colaborador",
          title: "Colaborador actualizado",
          detail: `${saved.firstName} ${saved.lastName}`,
        });
        onSaved(saved);
      } else {
        const saved = await staffApi.create({
          firstName: values.firstName,
          lastName: values.lastName,
          email: values.email,
          primaryDepartmentId,
          primaryRoleId,
          isAdmin: values.isAdmin,
          isSalesRep: values.isSalesRep,
          assignClientId: assignClientId ?? null,
        });
        receipts.done({
          action: "crear-colaborador",
          title: "Colaborador creado exitosamente",
          detail: `${saved.firstName} ${saved.lastName}`,
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

  async function onSubmit(values: FormValues) {
    const needsClient = values.isSalesRep && (!isEdit || !staff?.isSalesRep);
    if (needsClient) {
      setPendingValues(values);
      setClientModalOpen(true);
      return;
    }
    await saveStaff(values);
  }

  const displayName =
    pendingValues != null
      ? `${pendingValues.firstName} ${pendingValues.lastName}`.trim()
      : staff
        ? `${staff.firstName} ${staff.lastName}`
        : "Colaborador";

  return (
    <>
      <Modal
        maxWidth="max-w-xl"
        eyebrow={isEdit ? `Colaborador #${staff.id}` : "Alta interna de personal"}
        title={isEdit ? `Editar ${staff.firstName} ${staff.lastName}` : "Nuevo colaborador"}
        description={
          isEdit
            ? "Actualiza los datos personales, adscripción departamental o rol asignado."
            : "Completa los datos de acceso, departamento y rol del colaborador."
        }
        onClose={onClose}
        isExiting={isExiting}
        onRequestClose={requestClose}
        footer={
          <div className="flex w-full items-center justify-between gap-3">
            <span className="hidden sm:inline-flex items-center gap-1 text-[11px] text-faint select-none">
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
              <SubmitValidationButton
                formId="staff-form"
                ready={staffFormMissing.length === 0}
                busy={isSubmitting}
                missingItems={staffFormMissing}
                onFocusField={focusFormField}
                hintText={
                  isEdit
                    ? "Para guardar los cambios del colaborador, completa lo siguiente:"
                    : "Para registrar el colaborador, completa lo siguiente:"
                }
              >
                {isEdit ? "Guardar cambios" : "Crear colaborador"}
              </SubmitValidationButton>
            </div>
          </div>
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
              id="firstName"
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
              id="lastName"
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
            id="email"
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
                  id="primaryDepartmentId"
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
                  id="primaryRoleId"
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

          <div className="pt-0.5 flex flex-col gap-2">
            <CheckboxField
              label="Es vendedor"
              description="Aparece en selectores de vendedor y puede tener clientes en cartera."
              {...register("isSalesRep")}
            />
            <CheckboxField
              label="Perfil de administrador"
              description="Concede acceso total e irrestricto a todos los departamentos, módulos y configuraciones del panel."
              disabled={isSelf}
              {...register("isAdmin")}
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

      {clientModalOpen && pendingValues && (
        <StaffSalesRepClientModal
          staffName={displayName}
          onClose={() => {
            setClientModalOpen(false);
            setPendingValues(null);
          }}
          onConfirm={(clientId) => {
            setClientModalOpen(false);
            const values = pendingValues;
            setPendingValues(null);
            void saveStaff(values, clientId);
          }}
        />
      )}
    </>
  );
}
