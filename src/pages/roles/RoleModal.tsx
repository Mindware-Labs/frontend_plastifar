import { zodResolver } from "@hookform/resolvers/zod";
import { Check, Power, ShieldCheck } from "lucide-react";
import React, { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { rolesApi } from "../../api/roles";
import { Alert } from "../../components/ui/Alert";
import { TextField, type FieldState } from "../../components/ui/Field";
import { Modal } from "../../components/ui/Modal";
import { FormModalFooter } from "../../components/ui/FormModalFooter";
import { useModalAnimation } from "../../hooks/useModalAnimation";
import { applyServerError } from "../../lib/formErrors";
import type { RoleResponse } from "../../types/api";
import { FormDivider } from "../../components/ui/FormDivider";

const schema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Al menos 2 caracteres")
    .max(60, "Máximo 60 caracteres"),
  isActive: z.boolean(),
});

type FormValues = z.infer<typeof schema>;

interface RoleModalProps {
  /** Presente = edición; ausente = alta. */
  role?: RoleResponse;
  onClose: () => void;
  onSaved: (role: RoleResponse) => void;
}

export function RoleModal({ role, onClose, onSaved }: RoleModalProps) {
  const [formError, setFormError] = useState<string | null>(null);
  const isEdit = role !== undefined;
  const { isExiting, requestClose } = useModalAnimation();

  const {
    control,
    register,
    handleSubmit,
    setError,
    setFocus,
    formState: { errors, touchedFields, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    mode: "onTouched",
    defaultValues: {
      name: role?.name ?? "",
      isActive: role?.isActive ?? true,
    },
  });

  function stateOf(field: keyof FormValues): FieldState {
    if (errors[field]) return "error";
    return touchedFields[field] ? "valid" : "idle";
  }

  async function onSubmit(values: FormValues) {
    setFormError(null);
    try {
      if (isEdit) {
        await rolesApi.update(role.id, {
          name: values.name,
          permissions: role.permissions,
          isActive: values.isActive,
        });
        onSaved({ ...role, name: values.name, isActive: values.isActive });
      } else {
        onSaved(await rolesApi.create({ name: values.name, permissions: [] }));
      }
      requestClose();
    } catch (err) {
      const fallback = isEdit ? "No se pudo guardar el rol" : "No se pudo crear el rol";
      setFormError(
        applyServerError(err, {
          setError,
          setFocus,
          rules: [{ field: "name" }],
          statuses: [409],
          focusable: ["name"],
          fallback,
        }),
      );
    }
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLFormElement>) {
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
      event.preventDefault();
      void handleSubmit(onSubmit)();
    }
  }

  return (
    <Modal
      size="lg"
      title={isEdit ? `Editar ${role.name}` : "Nuevo rol"}
      description={
        isEdit
          ? "Actualiza la denominación y estado del rol en la organización."
          : "Define la denominación y disponibilidad inicial del rol."
      }
      onClose={onClose}
      isExiting={isExiting}
      onRequestClose={requestClose}
      footer={
        <FormModalFooter
          shortcut
          formId="role-form"
          isEdit={isEdit}
          createLabel="Crear rol"
          isSubmitting={isSubmitting}
          onCancel={requestClose}
        />
      }
    >
      <form
        id="role-form"
        onSubmit={handleSubmit(onSubmit)}
        onKeyDown={handleKeyDown}
        noValidate
        className="flex flex-col gap-3 text-left"
      >
        {formError && <Alert variant="error">{formError}</Alert>}

        {/* 1. IDENTIFICACIÓN */}
        <FormDivider title="Identificación" />

        <TextField
          size="sm"
          label="Nombre del rol"
          placeholder="Ej. Supervisor de Planta, Vendedor Senior"
          required
          state={stateOf("name")}
          error={errors.name?.message}
          hint="Se muestra en el organigrama y al conceder accesos a colaboradores."
          {...register("name")}
        />

        {/* 2. ESTADO */}
        {isEdit && (
          <>
            <FormDivider title="Disponibilidad" />
            <Controller
              name="isActive"
              control={control}
              render={({ field }) => (
                <div className="flex flex-col gap-1">
                  <label className="font-heading text-[11.5px] font-semibold text-faint">
                    Estado del rol
                  </label>
                  <div
                    role="radiogroup"
                    aria-label="Estado del rol"
                    className="grid grid-cols-2 gap-1 rounded-lg border border-zinc-200 bg-zinc-50/70 p-0.5"
                  >
                    <button
                      type="button"
                      role="radio"
                      aria-checked={field.value === true}
                      onClick={() => field.onChange(true)}
                      className={`inline-flex h-7 items-center justify-center gap-1.5 rounded-md px-2 text-[12px] transition-all cursor-pointer select-none ${
                        field.value === true
                          ? "border border-zinc-200 bg-white font-semibold text-zinc-900 shadow-2xs"
                          : "border border-transparent font-medium text-zinc-600 hover:text-zinc-900 hover:bg-white/50"
                      }`}
                    >
                      <Check
                        className={`h-3 w-3 shrink-0 ${
                          field.value === true ? "text-emerald-600" : "text-zinc-400"
                        }`}
                      />
                      <span>Activo</span>
                    </button>
                    <button
                      type="button"
                      role="radio"
                      aria-checked={field.value === false}
                      onClick={() => field.onChange(false)}
                      className={`inline-flex h-7 items-center justify-center gap-1.5 rounded-md px-2 text-[12px] transition-all cursor-pointer select-none ${
                        field.value === false
                          ? "border border-zinc-200 bg-white font-semibold text-zinc-900 shadow-2xs"
                          : "border border-transparent font-medium text-zinc-600 hover:text-zinc-900 hover:bg-white/50"
                      }`}
                    >
                      <Power
                        className={`h-3 w-3 shrink-0 ${
                          field.value === false ? "text-brand-red" : "text-zinc-400"
                        }`}
                      />
                      <span>Inactivo</span>
                    </button>
                  </div>
                  <span className="text-[11px] text-zinc-400">
                    {field.value
                      ? "El rol está habilitado para ser asignado al personal."
                      : "No se podrá asignar a nuevos miembros del personal."}
                  </span>
                </div>
              )}
            />
          </>
        )}

        {/* 3. PERMISOS */}
        <FormDivider title="Permisos y accesos" />

        <div className="rounded-lg border border-dashed border-zinc-200 bg-zinc-50/60 p-3 text-left">
          <div className="flex items-start gap-2.5">
            <ShieldCheck className="h-4 w-4 shrink-0 text-brand-red mt-0.5" />
            <div className="space-y-0.5">
              <p className="text-[12px] font-medium text-zinc-800">
                Gestión de permisos
              </p>
              <p className="text-[11.5px] leading-relaxed text-zinc-500">
                {isEdit
                  ? "Puedes ajustar los módulos y acciones permitidas para este rol desde el panel lateral editorial al hacer clic sobre su fila en la tabla de roles."
                  : "Al crear el rol, podrás configurarle permisos inmediatamente haciendo clic sobre su fila en la tabla o desde la pestaña Matriz de permisos."}
              </p>
            </div>
          </div>
        </div>
      </form>
    </Modal>
  );
}
