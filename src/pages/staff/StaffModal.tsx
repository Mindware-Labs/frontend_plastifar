import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { ApiError } from "../../api/client";
import { staffApi } from "../../api/staff";
import { Alert } from "../../components/ui/Alert";
import { Button } from "../../components/ui/Button";
import { CheckboxField, SelectField, TextField, type FieldState } from "../../components/ui/Field";
import { Modal } from "../../components/ui/Modal";
import { useAuth } from "../../context/useAuth";
import type { DepartmentResponse, StaffResponse } from "../../types/api";

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
  isAdmin: z.boolean(),
  isActive: z.boolean(),
});

type FormValues = z.infer<typeof schema>;

interface StaffModalProps {
  departments: DepartmentResponse[];
  /** Presente = edicion; ausente = alta. */
  staff?: StaffResponse;
  onClose: () => void;
  onSaved: (staff: StaffResponse) => void;
}

/** Alta y edicion de personal comparten formulario: los mismos campos, distinto destino. */
export function StaffModal({ departments, staff, onClose, onSaved }: StaffModalProps) {
  const { user } = useAuth();
  const [formError, setFormError] = useState<string | null>(null);
  const isEdit = staff !== undefined;
  const isSelf = isEdit && staff.id === user?.staffId;

  const {
    register,
    control,
    handleSubmit,
    setError,
    setFocus,
    formState: { errors, touchedFields, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    // El error aparece al salir del campo, nunca mientras se escribe por primera vez,
    // y a partir de ahi se corrige en vivo.
    mode: "onTouched",
    defaultValues: {
      firstName: staff?.firstName ?? "",
      lastName: staff?.lastName ?? "",
      email: staff?.email ?? "",
      primaryDepartmentId: staff ? String(staff.primaryDepartmentId) : "",
      isAdmin: staff?.isAdmin ?? false,
      isActive: staff?.isActive ?? true,
    },
  });

  /** Verde solo cuando la persona ya paso por el campo y quedo bien. */
  function stateOf(field: keyof FormValues): FieldState {
    if (errors[field]) return "error";
    return touchedFields[field] ? "valid" : "idle";
  }

  async function onSubmit(values: FormValues) {
    setFormError(null);
    const primaryDepartmentId = Number(values.primaryDepartmentId);

    try {
      const saved = isEdit
        ? await staffApi.update(staff.id, { ...values, primaryDepartmentId })
        : await staffApi.create({
            firstName: values.firstName,
            lastName: values.lastName,
            email: values.email,
            primaryDepartmentId,
            isAdmin: values.isAdmin,
          });

      onSaved(saved);
      onClose();
    } catch (err) {
      // El correo duplicado es un error de un campo concreto: se marca ahi,
      // no en un aviso general que obliga a adivinar cual es.
      if (err instanceof ApiError && err.status === 409) {
        setError("email", { message: err.message });
        setFocus("email");
        return;
      }

      const fallback = isEdit ? "No se pudo guardar el usuario" : "No se pudo crear el usuario";
      setFormError(err instanceof ApiError ? err.message : fallback);
    }
  }

  return (
    <Modal
      eyebrow="Personal"
      title={isEdit ? "Editar colaborador" : "Agregar personal"}
      description={
        isEdit
          ? "Los cambios se aplican de inmediato. La contraseña no se toca."
          : "El alta es interna: no existe registro público en el sistema."
      }
      onClose={onClose}
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" form="staff-form" isLoading={isSubmitting}>
            {isEdit ? "Guardar cambios" : "Crear usuario"}
          </Button>
        </>
      }
    >
      <form id="staff-form" onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
        {formError && <Alert variant="error">{formError}</Alert>}

        <div className="grid grid-cols-2 gap-3">
          <TextField
            label="Nombre"
            placeholder="Juan"
            autoComplete="given-name"
            required
            state={stateOf("firstName")}
            error={errors.firstName?.message}
            {...register("firstName")}
          />
          <TextField
            label="Apellido"
            placeholder="Pérez"
            autoComplete="family-name"
            required
            state={stateOf("lastName")}
            error={errors.lastName?.message}
            {...register("lastName")}
          />
        </div>

        <TextField
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
              ? "Cambiarlo cambia también la dirección con la que inicia sesión."
              : "A esta dirección llega el código de activación."
          }
          {...register("email")}
        />

        <Controller
          name="primaryDepartmentId"
          control={control}
          render={({ field }) => (
            <SelectField
              label="Departamento"
              required
              name={field.name}
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
              placeholder="Selecciona un departamento"
              options={departments.map((dept) => ({
                value: String(dept.id),
                label: dept.name,
              }))}
              state={stateOf("primaryDepartmentId")}
              error={errors.primaryDepartmentId?.message}
            />
          )}
        />

        <div className="flex flex-col gap-2">
          <CheckboxField
            label="Es administrador"
            description="Puede dar de alta personal, editar roles y ver todos los departamentos."
            disabled={isSelf}
            {...register("isAdmin")}
          />

          {isEdit && (
            <CheckboxField
              label="Activo"
              description="Si se desmarca, la persona deja de poder iniciar sesión."
              disabled={isSelf}
              {...register("isActive")}
            />
          )}
        </div>

        {isSelf ? (
          <Alert variant="info">
            Estás editando tu propio usuario: no puedes quitarte los permisos de administrador ni
            desactivarte.
          </Alert>
        ) : (
          !isEdit && (
            <p className="rounded-edge border border-dashed border-line-strong bg-canvas px-3.5 py-3 text-[11.5px] leading-relaxed text-subtle">
              Se genera una contraseña aleatoria y se envía un código de activación de 6 dígitos al
              correo indicado. La persona define su propia contraseña desde “Olvidé mi contraseña”.
            </p>
          )
        )}
      </form>
    </Modal>
  );
}
