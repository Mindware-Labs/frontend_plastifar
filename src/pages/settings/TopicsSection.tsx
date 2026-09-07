import { CornerDownRight, Pencil, Plus, Power } from "lucide-react";
import { useState } from "react";
import { departmentsApi } from "../../api/departments";
import { settingsApi } from "../../api/settings";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { ConfirmDialog, type ConfirmDialogProps } from "../../components/ui/ConfirmDialog";
import { DataTable, HeadRow, Row, Td, Th } from "../../components/ui/DataTable";
import { FilterChip } from "../../components/ui/FilterChip";
import { RowAction } from "../../components/ui/RowAction";
import { SearchInput } from "../../components/ui/SearchInput";
import { Select } from "../../components/ui/Select";
import { Pagination } from "../../components/ui/Pagination";
import { Spinner } from "../../components/ui/Spinner";
import { StatusDot } from "../../components/ui/StatusDot";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";
import { usePagedList } from "../../hooks/usePagedList";
import { usePermissions } from "../../hooks/usePermissions";
import type { DepartmentResponse } from "../../types/api";
import type { SlaPolicy, TicketTopic } from "../../types/settings";
import { ChipGroup, LoadErrorAlert } from "./catalogSection";
import { freshCopy, staleClass, useRecordCache, useReferenceData } from "./catalogState";
import { SettingsLayout } from "./SettingsLayout";
import { TopicModal } from "./TopicModal";

type ChipKey = "todos" | "activos" | "inactivos";

const priorityTone: Record<string, "red" | "green" | "neutral"> = {
  Emergencia: "red",
  Alta: "red",
  Normal: "neutral",
  Baja: "neutral",
};

/**
 * Catálogos de apoyo del diálogo: las políticas que puede elegir y los motivos
 * de primer nivel que puede tomar como padre. Son listas de opciones, no el
 * listado que se pagina; el tope de cien es el del desplegable.
 */
const loadPolicies = () =>
  settingsApi.slaPolicies.list({ page: 1, pageSize: 100 }).then(({ items }) => items);

const loadTopicOptions = () =>
  settingsApi.topics.list({ page: 1, pageSize: 100 }).then(({ items }) => items);

export function TopicsSection() {
  const { can } = usePermissions();
  const canWrite = can("settings.write");

  const [busyId, setBusyId] = useState<number | null>(null);

  const [search, setSearch] = useState("");
  const [departmentId, setDepartmentId] = useState("todos");
  const [chip, setChip] = useState<ChipKey>("todos");
  const [pageSize, setPageSize] = useState(10);

  const [modal, setModal] = useState<"nuevo" | TicketTopic | null>(null);
  const [confirmation, setConfirmation] = useState<Omit<ConfirmDialogProps, "onClose"> | null>(null);

  const debouncedSearch = useDebouncedValue(search).trim();

  // Seccion 4.1: la pagina, el filtro, la busqueda y los contadores los resuelve
  // SQL. La vista solo dibuja lo que llega.
  const { data, isStale, error, page, setPage, refresh } = usePagedList({
    fetch: settingsApi.topics.list,
    criteria: {
      pageSize,
      search: debouncedSearch || undefined,
      status: chip === "todos" ? undefined : chip,
      departmentId: departmentId === "todos" ? undefined : Number(departmentId),
    },
    fallbackError: "No se pudieron cargar los motivos",
  });

  const departmentsRef = useReferenceData<DepartmentResponse[]>(departmentsApi.list, []);
  const departments = departmentsRef.data;

  const policiesRef = useReferenceData<SlaPolicy[]>(loadPolicies, []);
  const policies = policiesRef.data;

  const topicOptionsRef = useReferenceData<TicketTopic[]>(loadTopicOptions, []);

  const rows = data?.items ?? [];
  const counts = data?.counts;
  const isFirstLoad = data === null && error === null;
  // Sin criterio activo, una pagina vacia significa catalogo vacio; con
  // criterio, que nada coincide. Los contadores no distinguen ese caso: se
  // calculan sobre el filtro base, no sobre la tabla entera.
  const isFiltering = debouncedSearch !== "" || chip !== "todos" || departmentId !== "todos";

  /**
   * El segundo nivel deja de dibujarse con sangría y pasa a decirse con la
   * leyenda «en ‹padre›» en cada sub-motivo.
   *
   * La sangría solo significa algo si el padre está encima, en la misma
   * pantalla, y con el corte en servidor padre e hijo caen en páginas
   * distintas cuando toca. La leyenda dice lo mismo sin depender de eso, y
   * ningún hijo se queda fuera por no tener a su padre a la vista.
   */
  const parents = useRecordCache(settingsApi.topics.get, rows.flatMap((topic) => topic.parentId ?? []));

  /** Un alta o una edicion cambia tambien los padres que el dialogo ofrece. */
  function reloadAll() {
    refresh();
    topicOptionsRef.reload();
  }

  function departmentName(id: number) {
    return departments.find((department) => department.id === id)?.name ?? "—";
  }

  /**
   * Resolucion de la seccion 8.3: primero la politica del motivo; si no tiene, la
   * predeterminada de su prioridad. La celda nombra la que de verdad va a
   * aplicarse, porque decir «la de alta» esconde justo la consecuencia que esta
   * pantalla existe para mostrar. La predeterminada tiene que estar activa: una
   * politica apagada no calcula nada, y el dialogo aplica la misma regla.
   */
  function policyFor(topic: TicketTopic) {
    if (topic.slaPolicyId !== null) {
      const own = policies.find((policy) => policy.id === topic.slaPolicyId);
      if (own) return { policy: own, inherited: false };
    }

    const fallback = policies.find(
      (policy) => policy.priority === topic.defaultPriority && policy.isDefault && policy.isActive,
    );

    return fallback ? { policy: fallback, inherited: true } : null;
  }

  function parentName(topic: TicketTopic) {
    return topic.parentId === null ? null : (parents[topic.parentId]?.name ?? null);
  }

  /**
   * RF-K5: no se desactiva el ultimo motivo activo; sin ninguno no hay forma de
   * clasificar lo que entra. Quien lo sabe es el servidor --cuenta sobre la
   * tabla, no sobre una pagina-- y su 409 sube al dialogo. Adelantarlo aqui
   * llegaba a prohibir desactivaciones legitimas y a permitir la ultima.
   */
  function askToggle(topic: TicketTopic) {
    setConfirmation({
      tone: "warn",
      icon: Power,
      title: topic.isActive ? "Desactivar motivo" : "Reactivar motivo",
      description: topic.isActive ? (
        <>
          <strong className="font-semibold text-ink">{topic.name}</strong> dejará de ofrecerse al
          abrir un ticket.{" "}
          {/* El API devuelve null mientras la Bandeja no exista: no hay tickets
              que contar. Se calla en vez de afirmar que no hay ninguno. */}
          {topic.ticketCount !== null && (
            <>
              {topic.ticketCount.toLocaleString("es-DO")}{" "}
              {topic.ticketCount === 1
                ? "ticket que ya lo usa conserva"
                : "tickets que ya lo usan conservan"}{" "}
              su motivo y su historial.
            </>
          )}
        </>
      ) : (
        <>
          <strong className="font-semibold text-ink">{topic.name}</strong> vuelve a estar disponible
          al abrir un ticket, con el departamento y la prioridad que tiene configurados.
        </>
      ),
      confirmLabel: topic.isActive ? "Desactivar" : "Reactivar",
      onConfirm: async () => {
        setBusyId(topic.id);
        try {
          const current = await freshCopy(settingsApi.topics.get, topic);
          await settingsApi.topics.update(current.id, {
            name: current.name,
            parentId: current.parentId,
            defaultDepartmentId: current.defaultDepartmentId,
            defaultPriority: current.defaultPriority,
            slaPolicyId: current.slaPolicyId,
            requiresProductLine: current.requiresProductLine,
            isActive: !current.isActive,
          });
          reloadAll();
        } finally {
          setBusyId(null);
        }
      },
    });
  }

  return (
    <SettingsLayout
      title="Motivos"
      note="El motivo decide a qué cola entra el ticket y con qué prioridad nace. Si no tiene política de SLA propia se aplica la predeterminada de su prioridad, y esas fechas se copian al ticket al crearlo: cambiar la política después no altera los tickets ya abiertos."
      action={
        canWrite && (
          <Button size="sm" onClick={() => setModal("nuevo")} disabled={busyId !== null}>
            <Plus className="h-[15px] w-[15px]" />
            Nuevo motivo
          </Button>
        )
      }
    >
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Buscar motivo…"
          className="w-[240px]"
        />

        <Select
          size="sm"
          className="w-[220px]"
          aria-label="Filtrar por departamento"
          value={departmentId}
          onChange={setDepartmentId}
          options={[
            { value: "todos", label: "Todos los departamentos" },
            ...departments.map((department) => ({
              value: String(department.id),
              label: department.name,
            })),
          ]}
        />

        <span aria-hidden className="mx-1 h-5 w-px bg-line" />

        <ChipGroup label="Filtrar por estado" ready={counts !== undefined}>
          <FilterChip
            label="Todos"
            count={counts?.all ?? 0}
            active={chip === "todos"}
            onClick={() => setChip("todos")}
          />
          <FilterChip
            label="Activos"
            count={counts?.active ?? 0}
            active={chip === "activos"}
            onClick={() => setChip("activos")}
          />
          <FilterChip
            label="Inactivos"
            count={counts?.inactive ?? 0}
            active={chip === "inactivos"}
            onClick={() => setChip("inactivos")}
          />
        </ChipGroup>
      </div>

      {error && <LoadErrorAlert message={error} onRetry={refresh} />}

      {(departmentsRef.failed || policiesRef.failed) && (
        <LoadErrorAlert
          message="No se pudieron cargar los departamentos y las políticas: esas columnas quedan sin nombre."
          onRetry={() => {
            if (departmentsRef.failed) departmentsRef.reload();
            if (policiesRef.failed) policiesRef.reload();
          }}
        />
      )}

      {isFirstLoad ? (
        <div className="flex justify-center py-16">
          <Spinner />
        </div>
      ) : data === null ? null : rows.length === 0 ? (
        <p className="py-14 text-center text-[13.5px] text-faint">
          {isFiltering
            ? "Ningún motivo coincide con este filtro o búsqueda."
            : "Todavía no hay ningún motivo configurado."}
        </p>
      ) : (
        <div className={staleClass(isStale)}>
          <DataTable>
            <thead>
              <HeadRow>
                <Th>Motivo</Th>
                <Th>Departamento</Th>
                <Th>Prioridad</Th>
                <Th>Política de SLA</Th>
                <Th>Línea de producto</Th>
                <Th>Estado</Th>
                {canWrite && <Th className="w-24 text-right">Acciones</Th>}
              </HeadRow>
            </thead>

            <tbody>
              {rows.map((topic) => {
                const policy = policyFor(topic);
                const parent = parentName(topic);
                const isChild = topic.parentId !== null;

                return (
                  <Row key={topic.id} busy={busyId === topic.id}>
                    <Td>
                      <span className="flex items-center gap-2">
                        {isChild && (
                          <CornerDownRight aria-hidden className="h-3.5 w-3.5 shrink-0 text-faint" />
                        )}
                        <span className="flex flex-col gap-0.5">
                          <span className="text-[12.5px] font-medium leading-tight text-ink">
                            {topic.name}
                          </span>
                          {isChild && parent !== null && (
                            <span className="text-[11px] leading-tight text-faint">en {parent}</span>
                          )}
                        </span>
                      </span>
                    </Td>
                    <Td className="text-[12.5px] text-brand-gray">
                      {departmentName(topic.defaultDepartmentId)}
                    </Td>
                    <Td>
                      <Badge tone={priorityTone[topic.defaultPriority]}>
                        {topic.defaultPriority}
                      </Badge>
                    </Td>
                    <Td className="text-[12.5px] text-brand-gray">
                      {policy ? (
                        <span className="flex flex-col gap-0.5">
                          <span className="leading-tight">{policy.policy.name}</span>
                          {policy.inherited && (
                            <span className="text-[11px] leading-tight text-faint">
                              heredada de {topic.defaultPriority.toLowerCase()}
                            </span>
                          )}
                        </span>
                      ) : policies.length === 0 ? (
                        // Sin el catalogo de politicas no se sabe cual aplica;
                        // el ambar afirmaria que no hay ninguna.
                        <span className="text-faint">—</span>
                      ) : (
                        <span className="text-warn">
                          Sin política para {topic.defaultPriority.toLowerCase()}
                        </span>
                      )}
                    </Td>
                    <Td className="text-[12.5px] text-brand-gray">
                      {topic.requiresProductLine ? (
                        "Obligatoria"
                      ) : (
                        <span className="text-faint">—</span>
                      )}
                    </Td>
                    <Td>
                      <StatusDot active={topic.isActive} />
                    </Td>
                    {canWrite && (
                      <Td>
                        <div className="flex items-center justify-end gap-1">
                          <RowAction
                            label={`Editar ${topic.name}`}
                            icon={Pencil}
                            onClick={() => setModal(topic)}
                            disabled={busyId === topic.id}
                          />
                          <RowAction
                            label={
                              topic.isActive ? `Desactivar ${topic.name}` : `Reactivar ${topic.name}`
                            }
                            icon={Power}
                            onClick={() => askToggle(topic)}
                            disabled={busyId === topic.id}
                          />
                        </div>
                      </Td>
                    )}
                  </Row>
                );
              })}
            </tbody>
          </DataTable>
        </div>
      )}

      {data !== null && data.total > 0 && (
        <Pagination
          page={page}
          pageSize={pageSize}
          total={data.total}
          totalPages={data.totalPages}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
          noun="motivos"
        />
      )}


      {modal !== null && (
        <TopicModal
          topic={modal === "nuevo" ? undefined : modal}
          topics={topicOptionsRef.data}
          policies={policies}
          departments={departments}
          onClose={() => setModal(null)}
          onSaved={reloadAll}
        />
      )}

      {confirmation && <ConfirmDialog {...confirmation} onClose={() => setConfirmation(null)} />}
    </SettingsLayout>
  );
}
