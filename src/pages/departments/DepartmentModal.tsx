import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { ApiError } from "../../api/client";
import { departmentsApi } from "../../api/departments";
import { Alert } from "../../components/ui/Alert";
import { Button } from "../../components/ui/Button";
import { CheckboxField, SelectField, TextField, type FieldState } from "../../components/ui/Field";
import { Modal } from "../../components/ui/Modal";
import { buildDepartmentTree, departmentPath } from "../../lib/departments";
import type { DepartmentResponse } from "../../types/api";

/** Espejo de la validacion del servidor en POST/PUT /api/departments. */
const schema = z.object({
  name: z.string().trim().min(2, "Al menos 2 caracteres").max(80, "Máximo 80 caracteres"),
  parentId: z.string(),
  isActive: z.boolean(),
});

type FormValues = z.infer<typeof schema>;

/** Valor del desplegable cuando el departamento no cuelga de nadie. */
const SIN_PADRE = "";

interface DepartmentModalProps {
  /** Ausente = alta. */
  department?: DepartmentResponse;
  /** El catalogo COMPLETO, activos e inactivos: de ahi salen los padres posibles. */
  all: DepartmentResponse[];
  onClose: () => void;
  onSaved: () => void;
}

export function DepartmentModal({ department, all, onClose, onSaved }: DepartmentModalProps) {
  const isEdit = department !== undefined;
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    control,
    handleSubmit,
    watch,
    setError,
    setFocus,
    formState: { errors, touchedFields, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    mode: "onTouched",
    defaultValues: {
      name: department?.name ?? "",
      parentId: department?.parentId != null ? String(department.parentId) : SIN_PADRE,
      isActive: department?.isActive ?? true,
    },
  });

  /* PADRES POSIBLES: el arbol entero menos el propio departamento y todo lo que
     cuelga de el.

     El servidor rechaza el ciclo con un 409 y su motivo, pero ofrecer la opcion
     para despues negarla es hacer elegir mal a proposito. Aqui simplemente no
     esta: quien administra no descubre la regla chocando contra ella. */
  const vetados = new Set<number>();
  if (isEdit) {
    const hijosDe = new Map<number, number[]>();
    for (const d of all) {
      if (d.parentId == null) continue;
      const grupo = hijosDe.get(d.parentId);
      if (grupo) grupo.push(d.id);
      else hijosDe.set(d.parentId, [d.id]);
    }
    const pendientes = [department.id];
    while (pendientes.length > 0) {
      const actual = pendientes.pop() as number;
      if (vetados.has(actual)) continue;
      vetados.add(actual);
      pendientes.push(...(hijosDe.get(actual) ?? []));
    }
  }

  const opcionesPadre = [
    { value: SIN_PADRE, label: "Ninguno — es de primer nivel" },
    ...buildDepartmentTree(all)
      .filter((d) => !vetados.has(d.id))
      .map((d) => ({
        value: String(d.id),
        // Sangria con espacios finos (U+2009): un <option> colapsa los normales.
        label: "    ".repeat(d.depth) + d.name + (d.isActive ? "" : " (inactivo)"),
      })),
  ];

  const parentIdElegido = watch("parentId");
  const padre = parentIdElegido === SIN_PADRE ? null : Number(parentIdElegido);
  const cambiaDePadre = (department?.parentId ?? null) !== padre;

  /* Cuanta gente pasa a quedar bajo el alcance del nuevo padre. Es la
     consecuencia real de mover un departamento, y es la unica que no se ve en
     ningun otro sitio del panel. */
  const alcanceQueGana = (() => {
    if (padre === null) return 0;
    const hijosDe = new Map<number, number[]>();
    for (const d of all) {
      if (d.parentId == null) continue;
      const grupo = hijosDe.get(d.parentId);
      if (grupo) grupo.push(d.id);
      else hijosDe.set(d.parentId, [d.id]);
    }
    const raiz = department?.id;
    if (raiz === undefined) return 0;
    let total = 0;
    const vistos = new Set<number>();
    const pendientes = [raiz];
    while (pendientes.length > 0) {
      const actual = pendientes.pop() as number;
      if (vistos.has(actual)) continue;
      vistos.add(actual);
      total += all.find((d) => d.id === actual)?.staffCount ?? 0;
      pendientes.push(...(hijosDe.get(actual) ?? []));
    }
    return total;
  })();

  function stateOf(field: keyof FormValues): FieldState {
    if (errors[field]) return "error";
    return touchedFields[field] ? "valid" : "idle";
  }

  async function onSubmit(values: FormValues) {
    setFormError(null);
    const request = {
      name: values.name.trim(),
      parentId: values.parentId === SIN_PADRE ? null : Number(values.parentId),
      isActive: values.isActive,
    };

    try {
      if (isEdit) await departmentsApi.update(department.id, request);
      else await departmentsApi.create(request);
      onSaved();
      onClose();
    } catch (err) {
      if (err instanceof ApiError && (err.status === 409 || err.status === 400)) {
        /* El API no dice que campo choca. Si el mensaje menciona el nombre que
           se envio, el choque es de nombre; si no, es del padre o de una regla
           del arbol, y va arriba en vez de marcar un campo al azar. */
        if (err.message.toLowerCase().includes(request.name.toLowerCase())) {
          setError("name", { message: err.message });
          setFocus("name");
        } else {
          setFormError(err.message);
        }
        return;
      }
      setFormError(err instanceof ApiError ? err.message : "No se pudo guardar el departamento");
    }
  }

  return (
    <Modal
      title={isEdit ? "Editar departamento" : "Nuevo departamento"}
      description="Una unidad de la empresa. Define de quién es un ticket y hasta dónde llega un rol."
      onClose={onClose}
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" form="department-form" isLoading={isSubmitting}>
            {isEdit ? "Guardar cambios" : "Crear departamento"}
          </Button>
        </>
      }
    >
      <form
        id="department-form"
        onSubmit={handleSubmit(onSubmit)}
        noValidate
        className="flex flex-col gap-4"
      >
        {formError && <Alert variant="error">{formError}</Alert>}

        <TextField
          label="Nombre"
          placeholder="Ej. Ventas internacionales"
          required
          state={stateOf("name")}
          error={errors.name?.message}
          {...register("name")}
        />

        <Controller
          name="parentId"
          control={control}
          render={({ field }) => (
            <SelectField
              label="Depende de"
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
              options={opcionesPadre}
              error={errors.parentId?.message}
              hint={
                isEdit
                  ? "No aparecen ni este departamento ni los que ya tiene dentro: uno no puede colgar de sí mismo."
                  : "Déjalo en «Ninguno» si es una unidad de primer nivel."
              }
            />
          )}
        />

        {/* LA CONSECUENCIA, ANTES DE GUARDAR. Mover un departamento no reordena
            un menú: amplía sobre quién puede la gente que tiene un rol en el
            padre nuevo. Es la única pantalla del panel donde eso se puede ver. */}
        {isEdit && cambiaDePadre && padre !== null && (
          <p className="rounded-edge border border-line bg-fill/60 px-3.5 py-3 text-[11.5px] leading-relaxed text-subtle">
            Al guardar, quien tenga un rol en{" "}
            <strong className="font-semibold text-ink">
              {departmentPath(all, padre) ?? "el departamento elegido"}
            </strong>{" "}
            pasará a ejercerlo también sobre{" "}
            <strong className="font-semibold text-ink">{department.name}</strong>
            {alcanceQueGana > 0 && (
              <>
                {" "}
                y sobre{" "}
                <span className="tabular-nums">
                  {alcanceQueGana} {alcanceQueGana === 1 ? "persona" : "personas"}
                </span>
              </>
            )}
            .
          </p>
        )}

        {isEdit && cambiaDePadre && padre === null && (
          <p className="rounded-edge border border-line bg-fill/60 px-3.5 py-3 text-[11.5px] leading-relaxed text-subtle">
            Al guardar, <strong className="font-semibold text-ink">{department.name}</strong> deja de
            heredar el alcance de{" "}
            <strong className="font-semibold text-ink">
              {departmentPath(all, department.parentId ?? 0) ?? "su departamento superior"}
            </strong>
            : quien tuviera un rol allí dejará de alcanzarlo.
          </p>
        )}

        {isEdit && (
          <CheckboxField
            label="Activo"
            description="Si se desmarca, deja de ofrecerse al asignar personal o encolar un ticket. Lo que ya está dentro conserva su departamento."
            {...register("isActive")}
          />
        )}
      </form>
    </Modal>
  );
}
