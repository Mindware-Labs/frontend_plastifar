import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { settingsApi } from "../../api/settings";
import { Alert } from "../../components/ui/Alert";
import {
  CheckboxField,
  LookupField,
  SelectField,
  TextField,
  type FieldState,
} from "../../components/ui/Field";
import { FormModalFooter } from "../../components/ui/FormModalFooter";
import { Modal } from "../../components/ui/Modal";
import { applyServerError, type ServerErrorRule } from "../../lib/formErrors";
import { resolveStaffLabel, searchActiveStaff } from "../../lib/lookups";
import { PLANT_COUNTRIES, type Plant } from "../../types/settings";

/**
 * Espejo de la validacion del servidor en POST/PUT /api/settings/plants
 * (PlantsController.cs): nombre de 2 a 80 caracteres, unico dentro del pais, y
 * pais obligatorio. El administrador es opcional; que exista y este activo lo
 * comprueba el servidor, y aqui solo se ofrece personal activo.
 */
const schema = z.object({
  name: z.string().trim().min(2, "Al menos 2 caracteres").max(80, "Máximo 80 caracteres"),
  country: z.enum(["RD", "Guatemala"], { message: "Elige el país" }),
  managerStaffId: z.string(),
  isActive: z.boolean(),
});

type FormValues = z.infer<typeof schema>;

/** Valor del campo de administrador sin nadie elegido. */
const NINGUNO = "";

/**
 * Con que empieza cada mensaje de POST/PUT /api/settings/plants que habla de un
 * solo campo. Lo que no este aqui va al aviso general del formulario.
 */
const CAMPO_POR_MENSAJE: ServerErrorRule<keyof FormValues>[] = [
  { field: "name", startsWith: "el nombre debe" },
  { field: "name", startsWith: "ya existe una planta" },
  { field: "country", startsWith: "el país debe" },
  { field: "managerStaffId", startsWith: "el administrador no existe" },
];

interface PlantModalProps {
  /** Ausente = alta. */
  plant?: Plant;
  onClose: () => void;
  onSaved: (plant: Plant) => void;
}

export function PlantModal({ plant, onClose, onSaved }: PlantModalProps) {
  const isEdit = plant !== undefined;
  const [formError, setFormError] = useState<string | null>(null);

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
      name: plant?.name ?? "",
      country: plant?.country ?? "RD",
      managerStaffId: plant?.managerStaffId != null ? String(plant.managerStaffId) : NINGUNO,
      isActive: plant?.isActive ?? true,
    },
  });

  function stateOf(field: keyof FormValues): FieldState {
    if (errors[field]) return "error";
    return touchedFields[field] ? "valid" : "idle";
  }

  async function onSubmit(values: FormValues) {
    setFormError(null);
    const request = {
      name: values.name.trim(),
      country: values.country,
      managerStaffId: values.managerStaffId === NINGUNO ? null : Number(values.managerStaffId),
      isActive: values.isActive,
    };

    try {
      const saved = isEdit
        ? await settingsApi.plants.update(plant.id, request)
        : await settingsApi.plants.create(request);
      onSaved(saved);
      onClose();
    } catch (err) {
      setFormError(
        applyServerError(err, {
          setError,
          setFocus,
          rules: CAMPO_POR_MENSAJE,
          // Solo el nombre esta registrado con ref; los demas van por
          // Controller sin ella y setFocus no los alcanzaria.
          focusable: ["name"],
          fallback: "No se pudo guardar la planta",
        }),
      );
    }
  }

  return (
    <Modal
      title={isEdit ? "Editar planta" : "Nueva planta"}
      description="Una planta de producción. El nombre puede repetirse en otro país, no dentro del mismo."
      onClose={onClose}
      footer={
        <FormModalFooter
          formId="plant-form"
          isEdit={isEdit}
          createLabel="Crear planta"
          isSubmitting={isSubmitting}
          onCancel={onClose}
        />
      }
    >
      <form id="plant-form" onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
        {formError && <Alert variant="error">{formError}</Alert>}

        <TextField
          label="Nombre"
          placeholder="Ej. PLANTA ENVASES CLEAR"
          required
          state={stateOf("name")}
          error={errors.name?.message}
          {...register("name")}
        />

        <Controller
          name="country"
          control={control}
          render={({ field }) => (
            <SelectField
              label="País"
              name={field.name}
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
              options={PLANT_COUNTRIES}
              required
              state={stateOf("country")}
              error={errors.country?.message}
            />
          )}
        />

        <Controller
          name="managerStaffId"
          control={control}
          render={({ field }) => (
            <LookupField
              label="Administrador"
              name={field.name}
              value={field.value}
              onChange={(value) => field.onChange(value)}
              onBlur={field.onBlur}
              placeholder="Sin administrador"
              searchPlaceholder="Buscar colaborador…"
              clearLabel="Sin administrador"
              search={searchActiveStaff}
              // El nombre ya viene con la planta: solo se usa mientras el valor
              // siga siendo el guardado, o taparía al que se elija ahora.
              selectedLabel={
                plant?.managerStaffId != null && field.value === String(plant.managerStaffId)
                  ? plant.managerName
                  : null
              }
              resolveSelectedLabel={resolveStaffLabel}
              state={stateOf("managerStaffId")}
              error={errors.managerStaffId?.message}
            />
          )}
        />

        {isEdit && (
          <CheckboxField
            label="Activa"
            description="Si se desmarca, deja de ofrecerse donde se elija una planta. Lo que ya la referencia la conserva."
            {...register("isActive")}
          />
        )}
      </form>
    </Modal>
  );
}
