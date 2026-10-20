import { Pencil, Plus, Power, Trash2 } from "lucide-react";
import { useState } from "react";
import { settingsApi } from "../../api/settings";
import { ModuleHeader } from "../../components/app/ModuleHeader";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { ConfirmDialog, type ConfirmDialogProps } from "../../components/ui/ConfirmDialog";
import { DataTable, HeadRow, Row, Td, Th } from "../../components/ui/DataTable";
import { FilterChip } from "../../components/ui/FilterChip";
import { ListPanel } from "../../components/ui/ListPanel";
import { Pagination } from "../../components/ui/Pagination";
import { RowAction } from "../../components/ui/RowAction";
import { Select } from "../../components/ui/Select";
import { TableSkeleton } from "../../components/ui/Skeleton";
import { StatusDot } from "../../components/ui/StatusDot";
import { usePagedList } from "../../hooks/usePagedList";
import { usePermissions } from "../../hooks/usePermissions";
import { REQUIRED_FORMS, ROUTING_MOMENTS, type FormRoutingRule } from "../../types/settings";
import { ChipGroup, LoadErrorAlert } from "./catalogSection";
import { freshCopy, staleClass } from "./catalogState";
import { FormRoutingRuleModal } from "./FormRoutingRuleModal";

type ChipKey = "todas" | "activas" | "inactivas";

/**
 * Configuración → Formularios (docs/plan/02, RF-S8): quién llena o consulta
 * cada formulario y en qué momento, por departamento (con sus hijos) o por
 * equipo. Es lo que el alta de tickets y la tarea consultarán cuando la
 * Bandeja se conecte.
 */
export function FormRoutingRulesSection() {
  const { can } = usePermissions();
  const canWrite = can("settings.write");

  const [busyId, setBusyId] = useState<number | null>(null);
  const [form, setForm] = useState("todos");
  const [moment, setMoment] = useState("todos");
  const [chip, setChip] = useState<ChipKey>("todas");
  const [pageSize, setPageSize] = useState(10);
  const [modal, setModal] = useState<"nueva" | FormRoutingRule | null>(null);
  const [confirmation, setConfirmation] = useState<Omit<ConfirmDialogProps, "onClose"> | null>(null);

  const { data, isStale, error, page, setPage, refresh } = usePagedList({
    fetch: settingsApi.formRoutingRules.list,
    criteria: {
      pageSize,
      form: form === "todos" ? undefined : form,
      moment: moment === "todos" ? undefined : moment,
      status: chip === "todas" ? undefined : chip,
    },
    fallbackError: "No se pudieron cargar las reglas de formularios",
  });

  const rows = data?.items ?? [];
  const counts = data?.counts;
  const isFiltering = chip !== "todas" || form !== "todos" || moment !== "todos";

  function describe(rule: FormRoutingRule) {
    return `${rule.formLabel} · ${rule.momentLabel} · ${rule.departmentName ?? rule.teamName ?? ""}`;
  }

  function askDelete(rule: FormRoutingRule) {
    setConfirmation({
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
        setBusyId(rule.id);
        try {
          await settingsApi.formRoutingRules.remove(rule.id);
          refresh();
        } finally {
          setBusyId(null);
        }
      },
    });
  }

  function askToggle(rule: FormRoutingRule) {
    setConfirmation({
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
        setBusyId(rule.id);
        try {
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
        } finally {
          setBusyId(null);
        }
      },
    });
  }

  return (
    <>
      <ModuleHeader
        title="Formularios"
        summary={
          counts
            ? `${counts.all} ${counts.all === 1 ? "regla de enrutamiento" : "reglas de enrutamiento"} · ${counts.active} ${counts.active === 1 ? "activa" : "activas"}`
            : "Cargando las reglas de enrutamiento de formularios…"
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
            <Select
              size="sm"
              className="w-[220px]"
              aria-label="Filtrar por formulario"
              value={form}
              onChange={setForm}
              options={[{ value: "todos", label: "Todos los formularios" }, ...REQUIRED_FORMS]}
            />
            <Select
              size="sm"
              className="w-[220px]"
              aria-label="Filtrar por momento"
              value={moment}
              onChange={setMoment}
              options={[{ value: "todos", label: "Cualquier momento" }, ...ROUTING_MOMENTS]}
            />

            <span aria-hidden className="mx-1 h-5 w-px bg-line" />

            <ChipGroup label="Filtrar por estado" ready={counts !== undefined}>
              <FilterChip label="Todas" count={counts?.all ?? 0} active={chip === "todas"} onClick={() => setChip("todas")} />
              <FilterChip label="Activas" count={counts?.active ?? 0} active={chip === "activas"} onClick={() => setChip("activas")} />
              <FilterChip label="Inactivas" count={counts?.inactive ?? 0} active={chip === "inactivas"} onClick={() => setChip("inactivas")} />
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
              noun="reglas"
              nounSingular="regla"
            />
          )
        }
      >
        {data === null ? (
          error === null && <TableSkeleton rows={pageSize} columns={5} />
        ) : rows.length === 0 ? (
          <p className="py-14 text-center text-[13.5px] text-faint">
            {isFiltering ? "Ninguna regla coincide con este filtro." : "Todavía no hay reglas. La carga inicial trae las de la hoja FORMULARIOS."}
          </p>
        ) : (
          <div className={staleClass(isStale)}>
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
                        <div className="flex items-center justify-end gap-1">
                          <RowAction label={`Editar ${describe(rule)}`} icon={Pencil} onClick={() => setModal(rule)} disabled={busyId === rule.id} />
                          <RowAction
                            label={rule.isActive ? `Desactivar ${describe(rule)}` : `Reactivar ${describe(rule)}`}
                            icon={Power}
                            onClick={() => askToggle(rule)}
                            disabled={busyId === rule.id}
                          />
                          <RowAction label={`Eliminar ${describe(rule)}`} icon={Trash2} danger onClick={() => askDelete(rule)} disabled={busyId === rule.id} />
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

      {modal !== null && <FormRoutingRuleModal rule={modal === "nueva" ? undefined : modal} onClose={() => setModal(null)} onSaved={refresh} />}

      {confirmation && <ConfirmDialog {...confirmation} onClose={() => setConfirmation(null)} />}
    </>
  );
}
