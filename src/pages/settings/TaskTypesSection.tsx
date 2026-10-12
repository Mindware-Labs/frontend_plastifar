import { Pencil, Plus, Power, Trash2 } from "lucide-react";
import { useState } from "react";
import { settingsApi } from "../../api/settings";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { ConfirmDialog, type ConfirmDialogProps } from "../../components/ui/ConfirmDialog";
import { DataTable, HeadRow, Row, Td, Th } from "../../components/ui/DataTable";
import { FilterChip } from "../../components/ui/FilterChip";
import { ListPanel } from "../../components/ui/ListPanel";
import { Pagination } from "../../components/ui/Pagination";
import { RowAction } from "../../components/ui/RowAction";
import { SearchInput } from "../../components/ui/SearchInput";
import { Select } from "../../components/ui/Select";
import { TableSkeleton } from "../../components/ui/Skeleton";
import { StatusDot } from "../../components/ui/StatusDot";
import { Tooltip } from "../../components/ui/Tooltip";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";
import { usePagedList } from "../../hooks/usePagedList";
import { usePermissions } from "../../hooks/usePermissions";
import { REQUIRED_FORMS, type TaskType } from "../../types/settings";
import { ChipGroup, LoadErrorAlert, WarnNotice } from "./catalogSection";
import { freshCopy, staleClass } from "./catalogState";
import { TaskTypeModal } from "./TaskTypeModal";

type ChipKey = "todos" | "activos" | "inactivos";

/** Cómo se cuentan los días del plazo, en palabras; «por definir» es la pregunta 1 de docs/plan/02. */
function daysLabel(businessDaysOnly: boolean | null): string {
  if (businessDaysOnly === null) return "por definir";
  return businessDaysOnly ? "laborables" : "calendario";
}

/**
 * Configuración → Tipos de tarea (docs/plan/02, RF-S1): la columna ACCION de
 * la hoja SLA, con su plazo, sus departamentos, sus responsables habituales y
 * el formulario que exige. Enlazarlo a la tarea del ticket es de la Bandeja.
 */
export function TaskTypesSection() {
  const { can } = usePermissions();
  const canWrite = can("settings.write");

  const [busyId, setBusyId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState("todos");
  const [chip, setChip] = useState<ChipKey>("todos");
  const [pageSize, setPageSize] = useState(10);
  const [modal, setModal] = useState<"nuevo" | TaskType | null>(null);
  const [confirmation, setConfirmation] = useState<Omit<ConfirmDialogProps, "onClose"> | null>(null);

  const debouncedSearch = useDebouncedValue(search).trim();

  const { data, isStale, error, page, setPage, refresh } = usePagedList({
    fetch: settingsApi.taskTypes.list,
    criteria: {
      pageSize,
      search: debouncedSearch || undefined,
      form: form === "todos" ? undefined : form,
      status: chip === "todos" ? undefined : chip,
    },
    fallbackError: "No se pudieron cargar los tipos de tarea",
  });

  const rows = data?.items ?? [];
  const counts = data?.counts;
  const isFiltering = debouncedSearch !== "" || chip !== "todos" || form !== "todos";
  const undecided = rows.some((type) => type.businessDaysOnly === null);

  function askDelete(type: TaskType) {
    setConfirmation({
      tone: "danger",
      icon: Trash2,
      title: "Eliminar tipo de tarea",
      description: (
        <>
          <strong className="font-semibold text-ink">{type.name}</strong> se borrará del catálogo con sus departamentos y
          responsables. Si ya no debe ofrecerse pero conviene conservarlo, desactívalo en su lugar.
        </>
      ),
      confirmLabel: "Eliminar",
      onConfirm: async () => {
        setBusyId(type.id);
        try {
          await settingsApi.taskTypes.remove(type.id);
          refresh();
        } finally {
          setBusyId(null);
        }
      },
    });
  }

  function askToggle(type: TaskType) {
    setConfirmation({
      tone: "warn",
      icon: Power,
      title: type.isActive ? "Desactivar tipo de tarea" : "Reactivar tipo de tarea",
      description: type.isActive ? (
        <>
          <strong className="font-semibold text-ink">{type.name}</strong> dejará de ofrecerse al crear tareas. Lo ya creado lo
          conserva.
        </>
      ) : (
        <>
          <strong className="font-semibold text-ink">{type.name}</strong> vuelve a estar disponible.
        </>
      ),
      confirmLabel: type.isActive ? "Desactivar" : "Reactivar",
      onConfirm: async () => {
        setBusyId(type.id);
        try {
          const current = await freshCopy(settingsApi.taskTypes.get, type);
          await settingsApi.taskTypes.update(current.id, {
            name: current.name,
            slaDays: current.slaDays,
            businessDaysOnly: current.businessDaysOnly,
            requiredForm: current.requiredForm,
            departmentIds: current.departments.map((d) => d.id),
            assigneeStaffIds: current.assignees.map((a) => a.staffId),
            isActive: !current.isActive,
          });
          refresh();
        } finally {
          setBusyId(null);
        }
      },
    });
  }

  return (
    <>
      {error && <LoadErrorAlert message={error} onRetry={refresh} />}

      {undecided && (
        <div className="mb-3">
          <WarnNotice>
            Algún tipo tiene el plazo «por definir»: Plastifar no ha dicho si los días son laborables o calendario. Mientras
            tanto no se calcula ningún vencimiento.
          </WarnNotice>
        </div>
      )}

      <ListPanel
        action={
          canWrite && (
            <Button size="sm" onClick={() => setModal("nuevo")} disabled={busyId !== null}>
              <Plus className="h-[15px] w-[15px]" />
              Nuevo tipo
            </Button>
          )
        }
        toolbar={
          <>
            <SearchInput value={search} onChange={setSearch} placeholder="Buscar tipo de tarea…" className="w-[240px]" />

            <Select
              size="sm"
              className="w-[220px]"
              aria-label="Filtrar por formulario exigido"
              value={form}
              onChange={setForm}
              options={[{ value: "todos", label: "Cualquier formulario" }, ...REQUIRED_FORMS]}
            />

            <span aria-hidden className="mx-1 h-5 w-px bg-line" />

            <ChipGroup label="Filtrar por estado" ready={counts !== undefined}>
              <FilterChip label="Todos" count={counts?.all ?? 0} active={chip === "todos"} onClick={() => setChip("todos")} />
              <FilterChip label="Activos" count={counts?.active ?? 0} active={chip === "activos"} onClick={() => setChip("activos")} />
              <FilterChip label="Inactivos" count={counts?.inactive ?? 0} active={chip === "inactivos"} onClick={() => setChip("inactivos")} />
            </ChipGroup>
          </>
        }
        footer={
          data !== null &&
          data.total > 0 && (
            <Pagination
              page={page}
              pageSize={pageSize}
              total={data.total}
              totalPages={data.totalPages}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
              noun="tipos de tarea"
              nounSingular="tipo de tarea"
            />
          )
        }
      >
        {data === null ? (
          error === null && <TableSkeleton rows={pageSize} columns={6} />
        ) : rows.length === 0 ? (
          <p className="py-14 text-center text-[13.5px] text-faint">
            {isFiltering ? "Ningún tipo coincide con este filtro o búsqueda." : "Todavía no hay tipos de tarea. La carga inicial trae los 13 de la hoja SLA."}
          </p>
        ) : (
          <div className={staleClass(isStale)}>
            <DataTable>
              <thead>
                <HeadRow>
                  <Th>Tipo de tarea</Th>
                  <Th>Plazo</Th>
                  <Th>Departamentos</Th>
                  <Th>Responsables</Th>
                  <Th>Formulario exigido</Th>
                  <Th>Estado</Th>
                  {canWrite && <Th className="w-32 text-right">Acciones</Th>}
                </HeadRow>
              </thead>
              <tbody>
                {rows.map((type) => (
                  <Row key={type.id} busy={busyId === type.id}>
                    <Td className="text-[12.5px] font-medium text-ink">{type.name}</Td>
                    <Td className="whitespace-nowrap text-[12.5px] text-subtle">
                      <span className="tabular-nums text-ink">{type.slaDays}</span> {type.slaDays === 1 ? "día" : "días"}{" "}
                      <span className={type.businessDaysOnly === null ? "text-warn" : "text-faint"}>({daysLabel(type.businessDaysOnly)})</span>
                    </Td>
                    <Td className="text-[12.5px] text-subtle">
                      <span className="block max-w-[220px] truncate" title={type.departments.map((d) => d.name).join(", ")}>
                        {type.departments.map((d) => d.name).join(", ") || "—"}
                      </span>
                    </Td>
                    <Td className="text-[12.5px] text-subtle">
                      {type.assignees.length === 0 ? (
                        <span className="text-faint">Sin responsable habitual</span>
                      ) : (
                        <span className="inline-flex flex-wrap items-center gap-1.5">
                          {type.assignees.map((a) => (
                            <span key={a.staffId} className="inline-flex items-center gap-1">
                              {a.name}
                              {!a.isActive && <Badge tone="neutral">Inactivo</Badge>}
                            </span>
                          ))}
                        </span>
                      )}
                    </Td>
                    <Td className="text-[12.5px] text-subtle">
                      {type.requiredFormLabel ? (
                        <Tooltip content="La tarea no podrá completarse sin este formulario (cuando la Bandeja lo compruebe).">
                          <Badge tone="warn">{type.requiredFormLabel}</Badge>
                        </Tooltip>
                      ) : (
                        <span className="text-faint">Ninguno</span>
                      )}
                    </Td>
                    <Td>
                      <StatusDot active={type.isActive} />
                    </Td>
                    {canWrite && (
                      <Td>
                        <div className="flex items-center justify-end gap-1">
                          <RowAction label={`Editar ${type.name}`} icon={Pencil} onClick={() => setModal(type)} disabled={busyId === type.id} />
                          <RowAction
                            label={type.isActive ? `Desactivar ${type.name}` : `Reactivar ${type.name}`}
                            icon={Power}
                            onClick={() => askToggle(type)}
                            disabled={busyId === type.id}
                          />
                          <RowAction label={`Eliminar ${type.name}`} icon={Trash2} danger onClick={() => askDelete(type)} disabled={busyId === type.id} />
                        </div>
                      </Td>
                    )}
                  </Row>
                ))}
              </tbody>
            </DataTable>
          </div>
        )}
      </ListPanel>

      {modal !== null && <TaskTypeModal taskType={modal === "nuevo" ? undefined : modal} onClose={() => setModal(null)} onSaved={refresh} />}

      {confirmation && <ConfirmDialog {...confirmation} onClose={() => setConfirmation(null)} />}
    </>
  );
}
