import { zodResolver } from "@hookform/resolvers/zod";
import { Trash2 } from "lucide-react";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { ApiError } from "../../api/client";
import { fetchAllPages } from "../../api/paging";
import { settingsApi } from "../../api/settings";
import { Alert } from "../../components/ui/Alert";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { CheckboxField, SelectField, TextField, type FieldState } from "../../components/ui/Field";
import { LookupSelect } from "../../components/ui/LookupSelect";
import { Modal } from "../../components/ui/Modal";
import { RowAction } from "../../components/ui/RowAction";
import { searchActiveStaff } from "../../lib/lookups";
import { PLANT_COUNTRIES, type Plant, type Team, type TeamMember } from "../../types/settings";
import { LoadErrorAlert } from "./catalogSection";
import { useReferenceData } from "./catalogState";

/**
 * Espejo de la validacion del servidor en POST/PUT /api/settings/teams
 * (TeamsController.cs): nombre de 2 a 80 caracteres, unico en todo el catalogo.
 * La planta es opcional; que exista y este activa lo comprueba el servidor, y
 * aqui solo se ofrecen las activas.
 */
const schema = z.object({
  name: z.string().trim().min(2, "Al menos 2 caracteres").max(80, "Máximo 80 caracteres"),
  plantId: z.string(),
  isActive: z.boolean(),
});

type FormValues = z.infer<typeof schema>;

/** Valor de un campo opcional sin nada elegido. */
const NINGUNO = "";

/**
 * Con que empieza cada mensaje de POST/PUT /api/settings/teams que habla de un
 * solo campo. Lo que no este aqui va al aviso general del formulario.
 */
const CAMPO_POR_MENSAJE: { field: keyof FormValues; startsWith: string }[] = [
  { field: "name", startsWith: "el nombre debe" },
  { field: "name", startsWith: "ya existe un equipo" },
  { field: "plantId", startsWith: "la planta no existe" },
];

interface TeamModalProps {
  /** Ausente = alta. */
  team?: Team;
  onClose: () => void;
  onSaved: (team: Team) => void;
  /** Se avisa tras cada alta o retiro de integrante: el listado muestra el conteo. */
  onMembersChanged: () => void;
}

export function TeamModal({ team, onClose, onSaved, onMembersChanged }: TeamModalProps) {
  const isEdit = team !== undefined;
  const [formError, setFormError] = useState<string | null>(null);

  /* Las plantas son un catalogo acotado y se recorren enteras. Si la lectura
     falla, el campo conserva la que el equipo ya tenia y lo dice, en vez de
     vaciarla y borrar el dato al guardar. */
  const plantsRef = useReferenceData<Plant[]>(
    () => fetchAllPages((page, pageSize) => settingsApi.plants.list({ page, pageSize })),
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
      name: team?.name ?? "",
      plantId: team?.plantId != null ? String(team.plantId) : NINGUNO,
      isActive: team?.isActive ?? true,
    },
  });

  /* Se ofrecen las activas, mas la que el equipo ya tenia aunque despues se
     desactivara o la lista no haya podido leerse: el servidor acepta
     conservarla. El pais va en la etiqueta porque el nombre se repite entre
     paises. */
  const opcionesPlanta = [
    { value: NINGUNO, label: "Sin planta" },
    ...plantsRef.data
      .filter((plant) => plant.isActive || plant.id === team?.plantId)
      .map((plant) => {
        const pais = PLANT_COUNTRIES.find(({ value }) => value === plant.country)?.label ?? plant.country;
        return {
          value: String(plant.id),
          label: `${plant.name} · ${pais}${plant.isActive ? "" : " (inactiva)"}`,
        };
      }),
  ];
  if (team?.plantId != null && !plantsRef.data.some((plant) => plant.id === team.plantId)) {
    opcionesPlanta.push({
      value: String(team.plantId),
      label: team.plantName ?? `Planta #${team.plantId}`,
    });
  }

  function stateOf(field: keyof FormValues): FieldState {
    if (errors[field]) return "error";
    return touchedFields[field] ? "valid" : "idle";
  }

  async function onSubmit(values: FormValues) {
    setFormError(null);
    const request = {
      name: values.name.trim(),
      plantId: values.plantId === NINGUNO ? null : Number(values.plantId),
      isActive: values.isActive,
    };

    try {
      const saved = isEdit
        ? await settingsApi.teams.update(team.id, request)
        : await settingsApi.teams.create(request);
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
          // Solo el nombre esta registrado con ref; la planta va por
          // Controller sin ella y setFocus no la alcanzaria.
          if (campo === "name") setFocus("name");
        } else {
          setFormError(err.message);
        }
        return;
      }
      setFormError(err instanceof ApiError ? err.message : "No se pudo guardar el equipo");
    }
  }

  return (
    <Modal
      title={isEdit ? "Editar equipo" : "Nuevo equipo"}
      description="Un grupo de personas de trabajo. Puede pertenecer a una planta o a ninguna."
      onClose={onClose}
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onClose}>
            {isEdit ? "Cerrar" : "Cancelar"}
          </Button>
          <Button type="submit" form="team-form" isLoading={isSubmitting}>
            {isEdit ? "Guardar cambios" : "Crear equipo"}
          </Button>
        </>
      }
    >
      <form id="team-form" onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
        {formError && <Alert variant="error">{formError}</Alert>}

        <TextField
          label="Nombre"
          placeholder="Ej. EQUIPO DE CONTROL DE INVENTARIO"
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
              hint={
                plantsRef.failed
                  ? "No se pudo cargar la lista de plantas; se conserva la que ya tenía."
                  : undefined
              }
            />
          )}
        />

        {isEdit && (
          <CheckboxField
            label="Activo"
            description="Si se desmarca, deja de ofrecerse donde se elija un equipo. Conserva a sus integrantes."
            {...register("isActive")}
          />
        )}
      </form>

      {isEdit ? (
        <TeamMembers teamId={team.id} onChanged={onMembersChanged} />
      ) : (
        <p className="mt-4 text-[12.5px] text-faint">
          Los integrantes se agregan después de crear el equipo, al editarlo.
        </p>
      )}
    </Modal>
  );
}

interface TeamMembersProps {
  teamId: number;
  onChanged: () => void;
}

/**
 * Integrantes del equipo. Cada alta y cada retiro se guarda al momento, fuera
 * del formulario de arriba. Nada se pinta por adelantado: tras escribir se
 * relee la lista del servidor, asi que un fallo no puede dejarla mostrando
 * algo que no ocurrio.
 */
function TeamMembers({ teamId, onChanged }: TeamMembersProps) {
  const membersRef = useReferenceData<TeamMember[] | null>(
    () => settingsApi.teams.members.list(teamId),
    null,
  );

  const [pick, setPick] = useState(NINGUNO);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const members = membersRef.data;

  async function write(action: () => Promise<unknown>, fallback: string) {
    setBusy(true);
    setError(null);
    try {
      await action();
      setPick(NINGUNO);
      membersRef.reload();
      onChanged();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : fallback);
      // Un 404 o un 409 significan que la lista ya no es la que se ve.
      membersRef.reload();
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-label="Integrantes" className="mt-5 flex flex-col gap-3 border-t border-line pt-4">
      <div>
        <h3 className="text-[13px] font-semibold text-ink">Integrantes</h3>
        <p className="text-[12.5px] text-faint">
          Solo se puede agregar personal activo. Cada cambio se guarda al momento.
        </p>
      </div>

      {error && <Alert variant="error">{error}</Alert>}

      <div className="flex items-start gap-2">
        <LookupSelect
          className="flex-1"
          aria-label="Colaborador a agregar"
          value={pick}
          onChange={(value) => setPick(value)}
          search={searchActiveStaff}
          placeholder="Elige un colaborador"
          searchPlaceholder="Buscar colaborador…"
          disabled={busy}
        />
        <Button
          type="button"
          variant="secondary"
          disabled={pick === NINGUNO}
          isLoading={busy}
          onClick={() =>
            write(
              () => settingsApi.teams.members.add(teamId, Number(pick)),
              "No se pudo agregar al integrante",
            )
          }
        >
          Agregar
        </Button>
      </div>

      {membersRef.failed ? (
        <LoadErrorAlert message="No se pudieron cargar los integrantes" onRetry={membersRef.reload} />
      ) : members === null ? (
        <p className="py-3 text-[12.5px] text-faint" role="status">
          Cargando integrantes…
        </p>
      ) : members.length === 0 ? (
        <p className="py-3 text-[12.5px] text-faint">Este equipo todavía no tiene integrantes.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-line border-y border-line">
          {members.map((member) => (
            <li key={member.staffId} className="flex items-center gap-3 py-2">
              <p className="min-w-0 flex-1 truncate text-[12.5px] font-medium text-ink">{member.name}</p>
              {!member.isActive && <Badge tone="neutral">Inactivo</Badge>}
              <RowAction
                label={`Quitar a ${member.name} del equipo`}
                icon={Trash2}
                danger
                disabled={busy}
                onClick={() =>
                  write(
                    () => settingsApi.teams.members.remove(teamId, member.staffId),
                    "No se pudo quitar al integrante",
                  )
                }
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
