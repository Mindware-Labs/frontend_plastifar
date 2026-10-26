import { Clock, FileSpreadsheet, Plus, Power, Trash2 } from "lucide-react";
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
import { StatusDot } from "../../components/ui/StatusDot";
import { useCatalogActions } from "../../hooks/useCatalogActions";
import { usePagedList } from "../../hooks/usePagedList";
import { usePermissions } from "../../hooks/usePermissions";
import { useUrlNumber, useUrlState } from "../../hooks/useUrlState";
import { REQUIRED_FORMS, ROUTING_MOMENTS, type FormRoutingRule } from "../../types/settings";
import { CatalogRowActions } from "./CatalogRowActions";
import { LoadErrorAlert } from "./catalogSection";
import { freshCopy } from "./catalogState";
import { FormRoutingRuleModal } from "./FormRoutingRuleModal";
import { PAGE_SIZES } from "../../lib/pageSizes";

const CHIPS = ["todas", "activas", "inactivas"] as const;
type ChipKey = (typeof CHIPS)[number];

const FORM_FILTERS: readonly string[] = ["todos", ...REQUIRED_FORMS.map(({ value }) => value)];
const MOMENT_FILTERS: readonly string[] = ["todos", ...ROUTING_MOMENTS.map(({ value }) => value)];

/**
 * Configuración → Formularios (docs/plan/02, RF-S8): quién llena o consulta
 * cada formulario y en qué momento, por departamento (con sus hijos) o por
 * equipo. Es lo que el alta de tickets y la tarea consultarán cuando la
 * Bandeja se conecte.
 */
export function FormRoutingRulesSection() {
  const { can } = usePermissions();
  const canWrite = can("settings.write");

  const { modal, setModal, busyId, confirm, dialog } = useCatalogActions<FormRoutingRule, "nueva">();
  const [form, setForm] = useUrlState<string>("formulario", "todos", FORM_FILTERS);
  const [moment, setMoment] = useUrlState<string>("momento", "todos", MOMENT_FILTERS);
  const [chip, setChip] = useUrlState<ChipKey>("estado", "todas", CHIPS);
  const [pageSize, setPageSize] = useUrlNumber("tam", 10, PAGE_SIZES);

  const { data, isStale, error, page, setPage, refresh } = usePagedList({
    fetch: settingsApi.formRoutingRules.list,
    criteria: {
      pageSize,
      form: form === "todos" ? undefined : form,
      moment: moment === "todos" ? undefined : moment,
      status: chip === "todas" ? undefined : chip,
    },
    fallbackError: "No se pudieron cargar las reglas de formularios",
    pageKey: "pagina",
  });

  const rows = data?.items ?? [];
  const counts = data?.counts;
  const isFiltering = chip !== "todas" || form !== "todos" || moment !== "todos";

  function clearFilters() {
    setForm("todos");
    setMoment("todos");
    setChip("todas");
  }

  function describe(rule: FormRoutingRule) {
    return `${rule.formLabel} · ${rule.momentLabel} · ${rule.departmentName ?? rule.teamName ?? ""}`;
  }

  function askDelete(rule: FormRoutingRule) {
    confirm(rule.id, {
      tone: "danger",
      icon: Trash2,
      title: "Eliminar regla",
      description: (
        <>
          <strong className="font-semibold text-ink">{describe(rule)}</strong> se borrará. Si solo debe dejar de aplicar, desactívala.
        </>
      ),
      confirmLabel: "Eliminar",
      onConfirm: async () => {
        await settingsApi.formRoutingRules.remove(rule.id);
        refresh();
      },
    });
  }

  function askToggle(rule: FormRoutingRule) {
    confirm(rule.id, {
      tone: "warn",
      icon: Power,
      title: rule.isActive ? "Desactivar regla" : "Reactivar regla",
      description: (
        <>
          <strong className="font-semibold text-ink">{describe(rule)}</strong> {rule.isActive ? "dejará de aplicar." : "vuelve a aplicar."}
        </>
      ),
      confirmLabel: rule.isActive ? "Desactivar" : "Reactivar",
      onConfirm: async () => {
        const current = await freshCopy(settingsApi.formRoutingRules.get, rule);
        await settingsApi.formRoutingRules.update(current.id, {
          form: current.form,
          moment: current.moment,
          departmentId: current.departmentId,
          teamId: current.teamId,
          isBlocking: current.isBlocking,
          isActive: !current.isActive,
        });
        refresh();
      },
    });
  }

  return (
    <>
      <ModuleHeader
        title="Formularios"
        summary={
          <HeaderCounts counts={counts} loadingLabel="Cargando las reglas de enrutamiento de formularios…">
            {(counts) => (
              <>
                <HeaderTag
                  label={counts.all === 1 ? "regla" : "reglas"}
                  count={counts.all}
                  active={chip === "todas"}
                  onClick={() => {
                    setChip("todas");
                    setPage(1);
                  }}
                  tone="neutral"
                  title="Mostrar todas las reglas de enrutamiento"
                />
                <HeaderTag
                  label={counts.active === 1 ? "activa" : "activas"}
                  count={counts.active}
                  active={chip === "activas"}
                  onClick={() => {
                    setChip("activas");
                    setPage(1);
                  }}
                  tone="emerald"
                  dot
                  title="Filtrar por reglas activas"
                />
                <HeaderTag
                  label={counts.inactive === 1 ? "inactiva" : "inactivas"}
                  count={counts.inactive}
                  active={chip === "inactivas"}
                  onClick={() => {
                    setChip("inactivas");
                    setPage(1);
                  }}
                  tone="red"
                  dot
                  title="Filtrar por reglas inactivas"
                />
              </>
            )}
          </HeaderCounts>
        }
        action={
          canWrite && (
            <Button size="sm" onClick={() => setModal("nueva")} disabled={busyId !== null}>
              <Plus className="h-[15px] w-[15px]" />
              Nueva regla
            </Button>
          )
        }
      />

      {error && <LoadErrorAlert message={error} onRetry={refresh} />}

      <ListPanel
        toolbar={
          <>
            <FilterDropdown
              title="Seleccionar formulario"
              aria-label="Filtrar por formulario"
              value={form}
              onChange={setForm}
              defaultIcon={<FileSpreadsheet className="h-3.5 w-3.5 text-zinc-500" />}
              options={[{ value: "todos", label: "Todos los formularios" }, ...REQUIRED_FORMS]}
            />
            <FilterDropdown
              title="Seleccionar momento"
              aria-label="Filtrar por momento"
              value={moment}
              onChange={setMoment}
              defaultIcon={<Clock className="h-3.5 w-3.5 text-zinc-500" />}
              options={[{ value: "todos", label: "Cualquier momento" }, ...ROUTING_MOMENTS]}
            />
            {(form !== "todos" || moment !== "todos") && (
              <ClearFiltersButton
                onClick={() => {
                  setForm("todos");
                  setMoment("todos");
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
            noun="reglas"
            nounSingular="regla"
          />
        }
      >
        <ListBody
          data={data}
          error={error}
          isStale={isStale}
          skeletonRows={pageSize}
          skeletonColumns={5}
          empty={
            isFiltering ? "Ninguna regla coincide con este filtro." : "Todavía no hay reglas. La carga inicial trae las de la hoja FORMULARIOS."
          }
          onClear={isFiltering ? clearFilters : undefined}
        >
          <DataTable>
            <thead>
              <HeadRow>
                <Th>Formulario</Th>
                <Th>Momento</Th>
                <Th>Aplica a</Th>
                <Th>Bloquea el cierre</Th>
                <Th>Estado</Th>
                {canWrite && <Th className="w-32 text-right">Acciones</Th>}
              </HeadRow>
            </thead>
            <tbody>
              {rows.map((rule) => (
                <Row key={rule.id} busy={busyId === rule.id}>
                  <Td className="text-[12.5px] font-medium text-ink">{rule.formLabel}</Td>
                  <Td className="text-[12.5px] text-subtle">{rule.momentLabel}</Td>
                  <Td className="text-[12.5px] text-subtle">
                    {rule.departmentName ? (
                      <span>
                        {rule.departmentName} <span className="text-faint">y sus hijos</span>
                      </span>
                    ) : (
                      <span>
                        Equipo <span className="text-ink">{rule.teamName}</span>
                      </span>
                    )}
                  </Td>
                  <Td>{rule.isBlocking ? <Badge tone="warn">Sí</Badge> : <span className="text-[12.5px] text-faint">No</span>}</Td>
                  <Td>
                    <StatusDot active={rule.isActive} />
                  </Td>
                  {canWrite && (
                    <Td>
                      <CatalogRowActions
                        name={describe(rule)}
                        isActive={rule.isActive}
                        busy={busyId === rule.id}
                        onEdit={() => setModal(rule)}
                        onToggle={() => askToggle(rule)}
                        onDelete={() => askDelete(rule)}
                      />
                    </Td>
                  )}
                </Row>
              ))}
            </tbody>
          </DataTable>
        </ListBody>
      </ListPanel>

      {modal !== null && <FormRoutingRuleModal rule={modal === "nueva" ? undefined : modal} onClose={() => setModal(null)} onSaved={refresh} />}

      {dialog}
    </>
  );
}
