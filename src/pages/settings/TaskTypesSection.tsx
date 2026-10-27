import { FileSpreadsheet, Plus, Power, Trash2 } from "lucide-react";
import { settingsApi } from "../../api/settings";
import { HeaderCounts } from "../../components/app/HeaderCounts";
import { ModuleHeader } from "../../components/app/ModuleHeader";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { DataTable, HeadRow, Row, Td, Th } from "../../components/ui/DataTable";
import { ClearFiltersButton, FilterDropdown } from "../../components/ui/FilterDropdown";
import { HeaderTag } from "../../components/ui/HeaderTag";
import { ListBody } from "../../components/ui/ListBody";
import { ListPanel } from "../../components/ui/ListPanel";
import { ListPagination } from "../../components/ui/ListPagination";
import { SearchInput } from "../../components/ui/SearchInput";
import { StatusDot } from "../../components/ui/StatusDot";
import { Tooltip } from "../../components/ui/Tooltip";
import { useCatalogActions } from "../../hooks/useCatalogActions";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";
import { usePagedList } from "../../hooks/usePagedList";
import { usePermissions } from "../../hooks/usePermissions";
import { useUrlNumber, useUrlState } from "../../hooks/useUrlState";
import { REQUIRED_FORMS, type TaskType } from "../../types/settings";
import { CatalogRowActions } from "./CatalogRowActions";
import { LoadErrorAlert, WarnNotice } from "./catalogSection";
import { freshCopy } from "./catalogState";
import { TaskTypeModal } from "./TaskTypeModal";
import { PAGE_SIZES } from "../../lib/pageSizes";

const CHIPS = ["todos", "activos", "inactivos"] as const;
type ChipKey = (typeof CHIPS)[number];

const FORM_FILTERS: readonly string[] = ["todos", ...REQUIRED_FORMS.map(({ value }) => value)];

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

  const { modal, setModal, busyId, confirm, dialog } = useCatalogActions<TaskType>();
  const [search, setSearch] = useUrlState<string>("q", "");
  const [form, setForm] = useUrlState<string>("formulario", "todos", FORM_FILTERS);
  const [chip, setChip] = useUrlState<ChipKey>("estado", "todos", CHIPS);
  const [pageSize, setPageSize] = useUrlNumber("tam", 10, PAGE_SIZES);

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
    pageKey: "pagina",
  });

  const rows = data?.items ?? [];
  const counts = data?.counts;
  const isFiltering = debouncedSearch !== "" || chip !== "todos" || form !== "todos";

  function clearFilters() {
    setSearch("");
    setForm("todos");
    setChip("todos");
  }
  const undecided = rows.some((type) => type.businessDaysOnly === null);

  function askDelete(type: TaskType) {
    confirm(type.id, {
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
        await settingsApi.taskTypes.remove(type.id);
        refresh();
      },
    });
  }

  function askToggle(type: TaskType) {
    confirm(type.id, {
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
      },
    });
  }

  return (
    <>
      <ModuleHeader
        title="Tipos de tarea"
        summary={
          <HeaderCounts counts={counts} loadingLabel="Cargando el catálogo de tipos de tarea…">
            {(counts) => (
              <>
                <HeaderTag
                  label={counts.all === 1 ? "tipo de tarea" : "tipos de tarea"}
                  count={counts.all}
                  active={chip === "todos"}
                  onClick={() => {
                    setChip("todos");
                    setPage(1);
                  }}
                  tone="neutral"
                  title="Mostrar todos los tipos de tarea"
                />
                <HeaderTag
                  label={counts.active === 1 ? "activo" : "activos"}
                  count={counts.active}
                  active={chip === "activos"}
                  onClick={() => {
                    setChip("activos");
                    setPage(1);
                  }}
                  tone="emerald"
                  dot
                  title="Filtrar por tipos de tarea activos"
                />
                <HeaderTag
                  label={counts.inactive === 1 ? "inactivo" : "inactivos"}
                  count={counts.inactive}
                  active={chip === "inactivos"}
                  onClick={() => {
                    setChip("inactivos");
                    setPage(1);
                  }}
                  tone="red"
                  dot
                  title="Filtrar por tipos de tarea inactivos"
                />
              </>
            )}
          </HeaderCounts>
        }
        action={
          canWrite && (
            <Button size="sm" onClick={() => setModal("nuevo")} disabled={busyId !== null}>
              <Plus className="h-[15px] w-[15px]" />
              Nuevo tipo
            </Button>
          )
        }
      />

      {error && <LoadErrorAlert message={error} onRetry={refresh} />}

      {undecided && (
        <div className="mb-3">
          <WarnNotice>
            Hay tipos sin definir si sus días son laborables o calendario. Sus tareas no tendrán fecha de vencimiento hasta
            que se defina.
          </WarnNotice>
        </div>
      )}

      <ListPanel
        toolbar={
          <>
            <SearchInput value={search} onChange={setSearch} placeholder="Buscar tipo de tarea…" className="w-[240px]" />

            <FilterDropdown
              title="Seleccionar formulario exigido"
              aria-label="Filtrar por formulario exigido"
              value={form}
              onChange={setForm}
              defaultIcon={<FileSpreadsheet className="h-3.5 w-3.5 text-zinc-500" />}
              options={[{ value: "todos", label: "Cualquier formulario" }, ...REQUIRED_FORMS]}
            />

            {(search || form !== "todos") && (
              <ClearFiltersButton
                onClick={() => {
                  setSearch("");
                  setForm("todos");
                }}
              />
            )}
          </>
        }
        footer={
          <ListPagination
            data={data}
            page={page}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
            noun="tipos de tarea"
            nounSingular="tipo de tarea"
          />
        }
      >
        <ListBody
          data={data}
          error={error}
          isStale={isStale}
          skeletonRows={pageSize}
          skeletonColumns={6}
          empty={
            isFiltering ? "Ningún tipo coincide con este filtro o búsqueda." : "Todavía no hay tipos de tarea."
          }
          onClear={isFiltering ? clearFilters : undefined}
        >
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
                      <CatalogRowActions
                        name={type.name}
                        isActive={type.isActive}
                        busy={busyId === type.id}
                        onEdit={() => setModal(type)}
                        onToggle={() => askToggle(type)}
                        onDelete={() => askDelete(type)}
                      />
                    </Td>
                  )}
                </Row>
              ))}
            </tbody>
          </DataTable>
        </ListBody>
      </ListPanel>

      {modal !== null && <TaskTypeModal taskType={modal === "nuevo" ? undefined : modal} onClose={() => setModal(null)} onSaved={refresh} />}

      {dialog}
    </>
  );
}
