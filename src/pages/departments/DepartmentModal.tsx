import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { ApiError } from "../../api/client";
import { departmentsApi } from "../../api/departments";
import { fetchAllPages } from "../../api/paging";
import { rolesApi } from "../../api/roles";
import { settingsApi } from "../../api/settings";
import { Alert } from "../../components/ui/Alert";
import { Button } from "../../components/ui/Button";
import {
  CheckboxField,
  LookupField,
  SelectField,
  TextField,
  type FieldState,
} from "../../components/ui/Field";
import { Modal } from "../../components/ui/Modal";
import { buildDepartmentTree, departmentPath } from "../../lib/departments";
import { resolveStaffLabel, searchActiveStaff } from "../../lib/lookups";
import {
  DEPARTMENT_TYPES,
  type DepartmentResponse,
  type RoleResponse,
} from "../../types/api";
import type { Mailbox } from "../../types/settings";
import { useReferenceData } from "../settings/catalogState";

/**
 * Espejo de la validacion del servidor en POST/PUT /api/departments: nombre de
 * 2 a 60 caracteres (el tope de la columna) y tipo obligatorio. Rol, buzon y
 * responsable son opcionales; que existan y esten activos lo comprueba el
 * servidor, y aqui solo se ofrecen los que lo estan.
 */
const schema = z.object({
  name: z.string().trim().min(2, "Al menos 2 caracteres").max(60, "Máximo 60 caracteres"),
  parentId: z.string(),
  type: z.enum(["Publico", "Privado"], { message: "Elige si es público o privado" }),
  defaultRoleId: z.string(),
  mailboxId: z.string(),
  managerStaffId: z.string(),
  isActive: z.boolean(),
});

type FormValues = z.infer<typeof schema>;

/** Valor del desplegable cuando el departamento no cuelga de nadie. */
const SIN_PADRE = "";

/** Valor de un desplegable opcional sin nada elegido. */
const NINGUNO = "";

/**
 * Con que empieza cada mensaje de POST/PUT /api/departments
 * (DepartmentsController.cs) que habla de un solo campo. Se compara el
 * principio de la frase y no una palabra suelta: «rol» tambien esta dentro de
 * «control». Lo que no este aqui —por ejemplo «Tiene N departamentos activos
 * dentro…»— va al aviso general del formulario.
 */
const CAMPO_POR_MENSAJE: { field: keyof FormValues; startsWith: string }[] = [
  { field: "name", startsWith: "el nombre debe" },
  { field: "name", startsWith: "ya existe un departamento" },
  { field: "type", startsWith: "el tipo debe" },
  { field: "parentId", startsWith: "el departamento superior" },
  { field: "parentId", startsWith: "ese departamento no puede colgar" },
  { field: "defaultRoleId", startsWith: "el rol no existe" },
  { field: "mailboxId", startsWith: "el buzón no existe" },
  { field: "managerStaffId", startsWith: "el responsable no existe" },
];

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

  /* Roles y buzones son catalogos acotados y se recorren enteros. Cada uno pide
     su propio permiso de lectura, que quien edita departamentos puede no tener:
     si la lectura falla, el campo conserva lo que ya estaba elegido y lo dice,
     en vez de vaciarlo y borrar el dato al guardar. */
  const rolesRef = useReferenceData<RoleResponse[]>(
    () => fetchAllPages((page, pageSize) => rolesApi.list({ page, pageSize, dir: "asc" })),
    [],
  );
  const mailboxesRef = useReferenceData<Mailbox[]>(
    () =>
      fetchAllPages((page, pageSize) =>
        settingsApi.mailboxes.list({ page, pageSize }),
      ),
    [],
  );

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
      type: department?.type ?? "Publico",
      defaultRoleId: department?.defaultRoleId != null ? String(department.defaultRoleId) : NINGUNO,
      mailboxId: department?.mailboxId != null ? String(department.mailboxId) : NINGUNO,
      managerStaffId:
        department?.managerStaffId != null ? String(department.managerStaffId) : NINGUNO,
      isActive: department?.isActive ?? true,
    },
  });

  /* Se ofrece lo activo, mas lo que el departamento ya tenia elegido aunque
     despues se desactivara o la lista no haya podido leerse: el servidor acepta
     conservarlo, y un desplegable que no lo incluyera lo borraria al guardar. */
  const opcionesRol = [
    { value: NINGUNO, label: "Sin rol asignado" },
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

  const opcionesBuzon = [
    { value: NINGUNO, label: "Sin buzón" },
    ...mailboxesRef.data
      .filter((mailbox) => mailbox.isActive || mailbox.id === department?.mailboxId)
      .map((mailbox) => ({
        value: String(mailbox.id),
        label: mailbox.isActive ? mailbox.address : `${mailbox.address} (inactivo)`,
      })),
  ];
  if (
    department?.mailboxId != null &&
    !mailboxesRef.data.some((mailbox) => mailbox.id === department.mailboxId)
  ) {
    opcionesBuzon.push({
      value: String(department.mailboxId),
      label: department.mailboxAddress ?? `Buzón #${department.mailboxId}`,
    });
  }

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
      type: values.type,
      defaultRoleId: values.defaultRoleId === NINGUNO ? null : Number(values.defaultRoleId),
      mailboxId: values.mailboxId === NINGUNO ? null : Number(values.mailboxId),
      managerStaffId: values.managerStaffId === NINGUNO ? null : Number(values.managerStaffId),
    };

    try {
      if (isEdit) await departmentsApi.update(department.id, request);
      else await departmentsApi.create(request);
      onSaved();
      onClose();
    } catch (err) {
      if (err instanceof ApiError && (err.status === 409 || err.status === 400)) {
        /* El API no dice que campo choca, pero sus mensajes empiezan
           nombrandolo: «Ya existe un departamento… con ese nombre», «El rol no
           existe…». Si no es de ninguno, va arriba en vez de marcar un campo
           al azar. */
        const mensaje = err.message.trim().toLowerCase();
        const campo = CAMPO_POR_MENSAJE.find(({ startsWith }) =>
          mensaje.startsWith(startsWith),
        )?.field;
        if (campo) {
          setError(campo, { message: err.message });
          // Solo el nombre esta registrado con ref; los demas van por
          // Controller sin ella y setFocus no los alcanzaria.
          if (campo === "name") setFocus("name");
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

        <Controller
          name="type"
          control={control}
          render={({ field }) => (
            <SelectField
              label="Tipo"
              name={field.name}
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
              options={DEPARTMENT_TYPES}
              required
              state={stateOf("type")}
              error={errors.type?.message}
              hint="Por ahora solo se registra: no cambia quién ve el departamento."
            />
          )}
        />

        <Controller
          name="defaultRoleId"
          control={control}
          render={({ field }) => (
            <SelectField
              label="Rol del departamento"
              name={field.name}
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
              options={opcionesRol}
              state={stateOf("defaultRoleId")}
              error={errors.defaultRoleId?.message}
              hint={
                rolesRef.failed
                  ? "No se pudo cargar la lista de roles; se conserva el que ya tenía."
                  : "Es una referencia: no concede ni retira permisos. Cada persona ejerce el rol de su propio acceso."
              }
            />
          )}
        />

        <Controller
          name="mailboxId"
          control={control}
          render={({ field }) => (
            <SelectField
              label="Buzón"
              name={field.name}
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
              options={opcionesBuzon}
              state={stateOf("mailboxId")}
              error={errors.mailboxId?.message}
              hint={
                mailboxesRef.failed
                  ? "No se pudo cargar la lista de buzones; se conserva el que ya tenía."
                  : "Varios departamentos pueden compartir el mismo buzón."
              }
            />
          )}
        />

        <Controller
          name="managerStaffId"
          control={control}
          render={({ field }) => (
            <LookupField
              label="Responsable"
              name={field.name}
              value={field.value}
              onChange={(value) => field.onChange(value)}
              onBlur={field.onBlur}
              placeholder="Sin responsable"
              searchPlaceholder="Buscar colaborador…"
              clearLabel="Sin responsable"
              search={searchActiveStaff}
              // El nombre ya viene con el departamento: solo se usa mientras el
              // valor siga siendo el guardado, o taparía al que se elija ahora.
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
