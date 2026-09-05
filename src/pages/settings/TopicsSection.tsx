import { CornerDownRight, Pencil, Plus, Power } from "lucide-react";
import { useCallback, useMemo, useState, type ReactNode } from "react";
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
import { useLocalPage } from "../../hooks/useLocalPage";
import { usePermissions } from "../../hooks/usePermissions";
import type { DepartmentResponse } from "../../types/api";
import type { SlaPolicy, TicketTopic } from "../../types/settings";
import { ChipGroup, LoadErrorAlert, NoticeDialog } from "./catalogSection";
import { freshCopy, staleClass, useSectionLoad } from "./catalogState";
import { SettingsLayout } from "./SettingsLayout";
import { TopicModal } from "./TopicModal";

type ChipKey = "todos" | "activos" | "inactivos";

const priorityTone: Record<string, "red" | "green" | "neutral"> = {
  Emergencia: "red",
  Alta: "red",
  Normal: "neutral",
  Baja: "neutral",
};

const listTopics = () => settingsApi.topics.list({ page: 1, pageSize: 100 });

export function TopicsSection() {
  const { can } = usePermissions();
  const canWrite = can("settings.write");

  const [topics, setTopics] = useState<TicketTopic[]>([]);
  const [policies, setPolicies] = useState<SlaPolicy[]>([]);
  const [departments, setDepartments] = useState<DepartmentResponse[]>([]);
  const [busyId, setBusyId] = useState<number | null>(null);

  const [search, setSearch] = useState("");
  const [departmentId, setDepartmentId] = useState("todos");
  const [chip, setChip] = useState<ChipKey>("todos");

  const [modal, setModal] = useState<"nuevo" | TicketTopic | null>(null);
  const [confirmation, setConfirmation] = useState<Omit<ConfirmDialogProps, "onClose"> | null>(null);
  const [notice, setNotice] = useState<{ title: string; body: ReactNode } | null>(null);

  const debouncedSearch = useDebouncedValue(search).trim().toLowerCase();

  const load = useCallback(async () => {
    const [topicPage, policyPage, departmentList] = await Promise.all([
      listTopics(),
      settingsApi.slaPolicies.list({ page: 1, pageSize: 100 }),
      departmentsApi.list(),
    ]);
    setTopics(topicPage.items);
    setPolicies(policyPage.items);
    setDepartments(departmentList);
  }, []);

  const { status, isRefetching, error, reload, retry } = useSectionLoad(
    load,
    "No se pudieron cargar los motivos",
  );

  const all = topics;
  const activeCount = all.filter((topic) => topic.isActive).length;

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
    return all.find((candidate) => candidate.id === topic.parentId)?.name ?? null;
  }

  /**
   * Solo la busqueda libre aplana el arbol: un termino puede encontrar al hijo
   * sin encontrar al padre, y una jerarquia con la mitad de las ramas ocultas
   * miente. El departamento y el estado siguen leyendose en dos niveles, porque
   * filtran por una propiedad que padre e hijo declaran cada uno por su cuenta.
   */
  const isFlat = debouncedSearch !== "";

  const { list: rows, nested } = useMemo(() => {
    const matches = (topic: TicketTopic) => {
      const byChip =
        chip === "todos" ||
        (chip === "activos" && topic.isActive) ||
        (chip === "inactivos" && !topic.isActive);

      const byDepartment =
        departmentId === "todos" || topic.defaultDepartmentId === Number(departmentId);

      const bySearch =
        debouncedSearch === "" || topic.name.toLowerCase().includes(debouncedSearch);

      return byChip && byDepartment && bySearch;
    };

    const filtered = all.filter(matches);
    if (isFlat) return { list: filtered, nested: new Set<number>() };

    const kept = new Set(filtered.map((topic) => topic.id));
    const list: TicketTopic[] = [];
    const indented = new Set<number>();
    const placed = new Set<number>();

    for (const parent of all.filter((topic) => topic.parentId === null)) {
      const children = all.filter((child) => child.parentId === parent.id && kept.has(child.id));
      if (!kept.has(parent.id) && children.length === 0) continue;

      if (kept.has(parent.id)) {
        list.push(parent);
        placed.add(parent.id);
      }

      for (const child of children) {
        list.push(child);
        placed.add(child.id);
        // Sangrado solo cuando el padre esta encima: sangrar bajo un padre que
        // el filtro dejo fuera dibujaria una rama que no esta en pantalla.
        if (kept.has(parent.id)) indented.add(child.id);
      }
    }

    // Un sub-motivo cuyo padre no esta en el catalogo existe y cuenta: se
    // muestra suelto en vez de desaparecer sin dejar rastro.
    for (const topic of filtered) if (!placed.has(topic.id)) list.push(topic);

    return { list, nested: indented };
  }, [all, chip, departmentId, debouncedSearch, isFlat]);

  /**
   * RF-K2: los listados de catalogo paginan como cualquier otro, y la unidad de
   * pagina es la fila que se ve. Cortar por grupos padre-hijo hacia que el pie
   * contara doce y la tabla enseñara veinte; cuando el corte separa a un hijo de
   * su padre, la fila lo dice con «en <padre>» en vez de fingir la sangria.
   */
  const { page, pageSize, total, totalPages, pageRows, setPage, changePageSize } = useLocalPage(
    rows,
    JSON.stringify([debouncedSearch, departmentId, chip]),
  );

  /**
   * RF-K5: no se desactiva el ultimo motivo activo. Sin motivos no hay forma de
   * abrir un ticket, asi que el sistema se quedaria sin puerta de entrada.
   */
  function askToggle(topic: TicketTopic) {
    if (topic.isActive && activeCount === 1) {
      setNotice({
        title: "No se puede desactivar",
        body: (
          <>
            <strong className="font-semibold text-ink">{topic.name}</strong> es el único motivo
            activo. Sin ninguno no habría forma de abrir un ticket: activa otro antes de desactivar
            este.
          </>
        ),
      });
      return;
    }

    setConfirmation({
      tone: "warn",
      icon: Power,
      title: topic.isActive ? "Desactivar motivo" : "Reactivar motivo",
      description: topic.isActive ? (
        <>
          <strong className="font-semibold text-ink">{topic.name}</strong> dejará de ofrecerse al
          abrir un ticket. {topic.ticketCount.toLocaleString("es-DO")}{" "}
          {topic.ticketCount === 1 ? "ticket que ya lo usa conserva" : "tickets que ya lo usan conservan"}{" "}
          su motivo y su historial.
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
          const current = await freshCopy(listTopics, topic);
          await settingsApi.topics.update(current.id, {
            name: current.name,
            parentId: current.parentId,
            defaultDepartmentId: current.defaultDepartmentId,
            defaultPriority: current.defaultPriority,
            slaPolicyId: current.slaPolicyId,
            requiresProductLine: current.requiresProductLine,
            isActive: !current.isActive,
          });
          await reload();
        } finally {
          setBusyId(null);
        }
      },
    });
  }

  return (
    <SettingsLayout
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

        <ChipGroup label="Filtrar por estado" ready={status === "ready"}>
          <FilterChip
            label="Todos"
            count={all.length}
            active={chip === "todos"}
            onClick={() => setChip("todos")}
          />
          <FilterChip
            label="Activos"
            count={activeCount}
            active={chip === "activos"}
            onClick={() => setChip("activos")}
          />
          <FilterChip
            label="Inactivos"
            count={all.length - activeCount}
            active={chip === "inactivos"}
            onClick={() => setChip("inactivos")}
          />
        </ChipGroup>
      </div>

      {error && <LoadErrorAlert message={error} onRetry={retry} />}

      {status === "loading" ? (
        <div className="flex justify-center py-16">
          <Spinner />
        </div>
      ) : status === "error" ? null : rows.length === 0 ? (
        <p className="py-14 text-center text-[13.5px] text-faint">
          {all.length === 0
            ? "Todavía no hay ningún motivo configurado."
            : "Ningún motivo coincide con este filtro o búsqueda."}
        </p>
      ) : (
        <div className={staleClass(isRefetching)}>
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
              {pageRows.map((topic, index) => {
                const policy = policyFor(topic);
                const parent = parentName(topic);
                const isChild = topic.parentId !== null;
                // La sangria solo vale si el padre esta en pantalla, encima.
                const isNested = nested.has(topic.id) && index > 0;

                return (
                  <Row key={topic.id} busy={busyId === topic.id}>
                    <Td>
                      <span className={`flex items-center gap-2 ${isNested ? "pl-5" : ""}`}>
                        {isNested && (
                          <CornerDownRight aria-hidden className="h-3.5 w-3.5 shrink-0 text-faint" />
                        )}
                        <span className="flex flex-col gap-0.5">
                          <span className="text-[12.5px] font-medium leading-tight text-ink">
                            {topic.name}
                          </span>
                          {isChild && !isNested && parent && (
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

      {status === "ready" && rows.length > 0 && (
        <Pagination
          page={page}
          pageSize={pageSize}
          total={total}
          totalPages={totalPages}
          onPageChange={setPage}
          onPageSizeChange={changePageSize}
          noun="motivos"
        />
      )}

      <p className="mt-4 max-w-[76ch] text-[12px] leading-relaxed text-faint">
        El motivo decide a qué cola entra el ticket y con qué prioridad nace. Si no tiene política de
        SLA propia se aplica la predeterminada de su prioridad, y esas fechas se copian al ticket al
        crearlo: cambiar la política después no altera los tickets ya abiertos.
      </p>

      {modal !== null && (
        <TopicModal
          topic={modal === "nuevo" ? undefined : modal}
          topics={all}
          policies={policies}
          departments={departments}
          onClose={() => setModal(null)}
          onSaved={() => {
            void reload();
          }}
        />
      )}

      {confirmation && <ConfirmDialog {...confirmation} onClose={() => setConfirmation(null)} />}

      {notice && (
        <NoticeDialog title={notice.title} icon={Power} onClose={() => setNotice(null)}>
          {notice.body}
        </NoticeDialog>
      )}
    </SettingsLayout>
  );
}
