import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { ApiError } from "../../api/client";
import { settingsApi } from "../../api/settings";
import { Alert } from "../../components/ui/Alert";
import { Button } from "../../components/ui/Button";
import { CheckboxField, SelectField, TextField, type FieldState } from "../../components/ui/Field";
import { Modal } from "../../components/ui/Modal";
import { PLANT_COUNTRIES, type Plant, type Product, type ProductLine } from "../../types/settings";

/**
 * Espejo de la validacion del servidor en POST/PUT /api/settings/products
 * (ProductsController.cs): codigo de 1 a 20 caracteres, unico sin distinguir
 * mayusculas, y descripcion de 2 a 200. La linea y la planta son opcionales;
 * que existan y esten activas lo comprueba el servidor, y aqui solo se ofrecen
 * las activas.
 */
const schema = z.object({
  code: z.string().trim().min(1, "Escribe el código").max(20, "Máximo 20 caracteres"),
  name: z.string().trim().min(2, "Al menos 2 caracteres").max(200, "Máximo 200 caracteres"),
  productLineId: z.string(),
  plantId: z.string(),
  isActive: z.boolean(),
});

type FormValues = z.infer<typeof schema>;

/** Valor de un campo opcional sin nada elegido. */
const NINGUNO = "";

/**
 * Con que empieza cada mensaje de POST/PUT /api/settings/products que habla de
 * un solo campo. Lo que no este aqui va al aviso general del formulario.
 */
const CAMPO_POR_MENSAJE: { field: keyof FormValues; startsWith: string }[] = [
  { field: "code", startsWith: "el código debe" },
  { field: "code", startsWith: "ya existe un producto" },
  { field: "name", startsWith: "la descripción debe" },
  { field: "productLineId", startsWith: "la línea de producto no existe" },
  { field: "plantId", startsWith: "la planta no existe" },
];

interface ProductModalProps {
  /** Ausente = alta. */
  product?: Product;
  /** Catalogos de apoyo, ya cargados por la seccion: tambien alimentan sus filtros. */
  productLines: ProductLine[];
  plants: Plant[];
  /** Alguno de los dos catalogos no pudo leerse: el campo conserva lo guardado y lo dice. */
  referencesFailed: boolean;
  onClose: () => void;
  onSaved: (product: Product) => void;
}

export function ProductModal({
  product,
  productLines,
  plants,
  referencesFailed,
  onClose,
  onSaved,
}: ProductModalProps) {
  const isEdit = product !== undefined;
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
      code: product?.code ?? "",
      name: product?.name ?? "",
      productLineId: product?.productLineId != null ? String(product.productLineId) : NINGUNO,
      plantId: product?.plantId != null ? String(product.plantId) : NINGUNO,
      isActive: product?.isActive ?? true,
    },
  });

  /* Se ofrecen las activas, mas la que el producto ya tenia aunque despues se
     desactivara o la lista no haya podido leerse: el servidor acepta
     conservarla. */
  const opcionesLinea = [
    { value: NINGUNO, label: "Sin línea" },
    ...productLines
      .filter((line) => line.isActive || line.id === product?.productLineId)
      .map((line) => ({
        value: String(line.id),
        label: `${line.name}${line.isActive ? "" : " (inactiva)"}`,
      })),
  ];
  if (product?.productLineId != null && !productLines.some((line) => line.id === product.productLineId)) {
    opcionesLinea.push({
      value: String(product.productLineId),
      label: product.productLineName ?? `Línea #${product.productLineId}`,
    });
  }

  // El pais va en la etiqueta porque el nombre de la planta se repite entre paises.
  const opcionesPlanta = [
    { value: NINGUNO, label: "Sin planta" },
    ...plants
      .filter((plant) => plant.isActive || plant.id === product?.plantId)
      .map((plant) => {
        const pais = PLANT_COUNTRIES.find(({ value }) => value === plant.country)?.label ?? plant.country;
        return {
          value: String(plant.id),
          label: `${plant.name} · ${pais}${plant.isActive ? "" : " (inactiva)"}`,
        };
      }),
  ];
  if (product?.plantId != null && !plants.some((plant) => plant.id === product.plantId)) {
    opcionesPlanta.push({
      value: String(product.plantId),
      label: product.plantName ?? `Planta #${product.plantId}`,
    });
  }

  function stateOf(field: keyof FormValues): FieldState {
    if (errors[field]) return "error";
    return touchedFields[field] ? "valid" : "idle";
  }

  async function onSubmit(values: FormValues) {
    setFormError(null);
    const request = {
      code: values.code.trim(),
      name: values.name.trim(),
      productLineId: values.productLineId === NINGUNO ? null : Number(values.productLineId),
      plantId: values.plantId === NINGUNO ? null : Number(values.plantId),
      isActive: values.isActive,
    };

    try {
      const saved = isEdit
        ? await settingsApi.products.update(product.id, request)
        : await settingsApi.products.create(request);
      onSaved(saved);
      onClose();
    } catch (err) {
      if (err instanceof ApiError && (err.status === 409 || err.status === 400)) {
        const mensaje = err.message.trim().toLowerCase();
        const campo = CAMPO_POR_MENSAJE.find(({ startsWith }) =>
          mensaje.startsWith(startsWith),
        )?.field;
        if (campo) {
          setError(campo, { message: err.message });
          // Solo el codigo y la descripcion estan registrados con ref; la linea
          // y la planta van por Controller sin ella y setFocus no las alcanzaria.
          if (campo === "code" || campo === "name") setFocus(campo);
        } else {
          setFormError(err.message);
        }
        return;
      }
      setFormError(err instanceof ApiError ? err.message : "No se pudo guardar el producto");
    }
  }

  const referenceHint = referencesFailed
    ? "No se pudo cargar la lista; se conserva lo que ya tenía."
    : undefined;

  return (
    <Modal
      title={isEdit ? "Editar producto" : "Nuevo producto"}
      description="Un artículo que se vende, se reclama o se retira. El código lo identifica y no puede repetirse."
      onClose={onClose}
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" form="product-form" isLoading={isSubmitting}>
            {isEdit ? "Guardar cambios" : "Crear producto"}
          </Button>
        </>
      }
    >
      <form id="product-form" onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
        {formError && <Alert variant="error">{formError}</Alert>}

        <TextField
          label="Código"
          placeholder="Ej. 18215"
          required
          hint="Se guarda como texto: los ceros a la izquierda se conservan."
          state={stateOf("code")}
          error={errors.code?.message}
          {...register("code")}
        />

        <TextField
          label="Descripción"
          placeholder="Ej. Vaso foam 8 oz"
          required
          state={stateOf("name")}
          error={errors.name?.message}
          {...register("name")}
        />

        <Controller
          name="plantId"
          control={control}
          render={({ field }) => (
            <SelectField
              label="Planta"
              name={field.name}
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
              options={opcionesPlanta}
              state={stateOf("plantId")}
              error={errors.plantId?.message}
              hint={referenceHint}
            />
          )}
        />

        <Controller
          name="productLineId"
          control={control}
          render={({ field }) => (
            <SelectField
              label="Línea de producto"
              name={field.name}
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
              options={opcionesLinea}
              state={stateOf("productLineId")}
              error={errors.productLineId?.message}
              hint={referenceHint}
            />
          )}
        />

        {isEdit && (
          <CheckboxField
            label="Activo"
            description="Si se desmarca, deja de ofrecerse en formularios nuevos. Los que ya lo nombran conservan su código y su descripción."
            {...register("isActive")}
          />
        )}
      </form>
    </Modal>
  );
}
