import { zodResolver } from "@hookform/resolvers/zod";
import { ShieldCheck } from "lucide-react";
import { useMemo, useState, type KeyboardEvent } from "react";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { SubmitValidationButton } from "../../components/app/SubmitValidationButton";
import { rolesApi } from "../../api/roles";
import { Alert } from "../../components/ui/Alert";
import { Button } from "../../components/ui/Button";
import { CheckboxField, TextField, type FieldState } from "../../components/ui/Field";
import { FormDivider } from "../../components/ui/FormDivider";
import { Modal } from "../../components/ui/Modal";
import { useModalAnimation } from "../../hooks/useModalAnimation";
import { applyServerError } from "../../lib/formErrors";
import { buildValidationItems, focusFormField } from "../../lib/validationItems";
import type { RoleResponse } from "../../types/api";

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
    register,
    handleSubmit,
    setError,
    setFocus,
    control,
    formState: { errors, touchedFields, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    mode: "onTouched",
    defaultValues: {
      name: role?.name ?? "",
      isActive: role?.isActive ?? true,
    },
  });

  const roleName = useWatch({ control, name: "name" }) ?? "";
  const roleFormMissing = useMemo(
    () =>
      buildValidationItems([
        {
          id: "name",
          label: "Falta el nombre del rol",
          short: "el nombre",
          valid: roleName.trim().length >= 2,
        },
      ]),
    [roleName],
  );

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

  function handleKeyDown(event: KeyboardEvent<HTMLFormElement>) {
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
      event.preventDefault();
      void handleSubmit(onSubmit)();
    }
  }

  return (
    <Modal
      maxWidth="max-w-xl"
      eyebrow={
        isEdit
          ? `Rol #${role.id}${role.isSystem ? " · Sistema" : ""}`
          : "Accesos y permisos"
      }
      title={isEdit ? `Editar ${role.name}` : "Nuevo rol"}
      description={
        isEdit
          ? "Actualiza la denominación y disponibilidad del rol."
          : "Define el nombre; los permisos se configuran después de crearlo."
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
              formId="role-form"
              ready={roleFormMissing.length === 0}
              busy={isSubmitting}
              missingItems={roleFormMissing}
              onFocusField={focusFormField}
              hintText="Para guardar el rol, completa lo siguiente:"
            >
              {isEdit ? "Guardar cambios" : "Crear rol"}
            </SubmitValidationButton>
          </div>
        </div>
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

        <FormDivider title="Identificación" />

        <TextField
          size="sm"
          label="Nombre del rol"
          placeholder="Ej. Supervisor de Planta, Vendedor Senior"
          required
          autoFocus
          state={stateOf("name")}
          error={errors.name?.message}
          hint="Se muestra en el organigrama y al conceder accesos a colaboradores."
          {...register("name")}
        />

        <FormDivider title="Permisos y accesos" />

        <div className="rounded-lg border border-dashed border-zinc-200 bg-zinc-50/60 p-3 text-left">
          <div className="flex items-start gap-2.5">
            <ShieldCheck className="h-4 w-4 shrink-0 text-brand-red mt-0.5" />
            <div className="space-y-0.5">
              <p className="text-[12px] font-medium text-zinc-800">Gestión de permisos</p>
              <p className="text-[11.5px] leading-relaxed text-zinc-500">
                {isEdit
                  ? "Ajusta módulos y acciones desde el panel lateral al hacer clic sobre la fila en la tabla de roles."
                  : "Tras crear el rol, configura permisos haciendo clic sobre su fila o desde la pestaña Matriz de permisos."}
              </p>
            </div>
          </div>
        </div>

        {isEdit && (
          <CheckboxField
            label="Rol activo"
            description="Si se desmarca, no se podrá asignar a nuevos colaboradores."
            {...register("isActive")}
          />
        )}
      </form>
    </Modal>
  );
}
