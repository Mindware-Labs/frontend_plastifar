import { CornerDownRight, Pencil, Plus, Power } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Alert } from "../../components/ui/Alert";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { ConfirmDialog, type ConfirmDialogProps } from "../../components/ui/ConfirmDialog";
import { DataTable, HeadRow, Row, Td, Th } from "../../components/ui/DataTable";
import { FilterChip } from "../../components/ui/FilterChip";
import { RowAction } from "../../components/ui/RowAction";
import { SearchInput } from "../../components/ui/SearchInput";
import { Select } from "../../components/ui/Select";
import { Spinner } from "../../components/ui/Spinner";
import { StatusDot } from "../../components/ui/StatusDot";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";
import { upsertById } from "../../lib/catalog";
import { usePermissions } from "../../hooks/usePermissions";
import { settingsMock } from "../../mocks/settings";
import type { SlaPolicy, TicketTopic } from "../../types/settings";
import { SettingsLayout } from "./SettingsLayout";
import { TopicModal } from "./TopicModal";

type ChipKey = "todos" | "activos" | "inactivos";

const priorityTone: Record<string, "red" | "green" | "neutral"> = {
  Emergencia: "red",
  Alta: "red",
  Normal: "neutral",
  Baja: "neutral",
};

export function TopicsSection() {
  const { can } = usePermissions();
  const canWrite = can("settings.write");

  const [topics, setTopics] = useState<TicketTopic[] | null>(null);
  const [policies, setPolicies] = useState<SlaPolicy[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [departmentId, setDepartmentId] = useState("todos");
  const [chip, setChip] = useState<ChipKey>("todos");

  const [modal, setModal] = useState<"nuevo" | TicketTopic | null>(null);
  const [confirmation, setConfirmation] = useState<Omit<ConfirmDialogProps, "onClose"> | null>(null);

  const debouncedSearch = useDebouncedValue(search).trim().toLowerCase();
  const departments = settingsMock.departments();

  useEffect(() => {
    Promise.all([settingsMock.topics(), settingsMock.policies()])
      .then(([loadedTopics, loadedPolicies]) => {
        setTopics(loadedTopics);
        setPolicies(loadedPolicies);
      })
      .catch(() => setError("No se pudieron cargar los motivos"));
  }, []);

  const all = useMemo(() => topics ?? [], [topics]);
  const activeCount = all.filter((topic) => topic.isActive).length;

  function departmentName(id: number) {
    return departments.find((department) => department.id === id)?.name ?? "—";
  }

  /**
   * Resolucion de la seccion 8.3: primero la politica del motivo; si no tiene, la
   * predeterminada de su prioridad. La celda nombra la que de verdad va a
   * aplicarse, porque decir «la de alta» esconde justo la consecuencia que esta
   * pantalla existe para mostrar.
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
   * Orden de lectura: cada motivo de primer nivel seguido de sus hijos. Buscar
   * aplana la lista, porque una jerarquia con la mitad de las ramas ocultas
   * miente sobre lo que hay.
   */
  const rows = useMemo(() => {
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
    if (debouncedSearch !== "" || departmentId !== "todos" || chip !== "todos") return filtered;

    return all
      .filter((topic) => topic.parentId === null)
      .flatMap((parent) => [parent, ...all.filter((child) => child.parentId === parent.id)]);
  }, [all, chip, departmentId, debouncedSearch]);

  const isFlat = debouncedSearch !== "" || departmentId !== "todos" || chip !== "todos";

  function upsert(item: TicketTopic) {
    setTopics((previous) => upsertById(previous ?? [], item));
  }

  /**
   * RF-K5: no se desactiva el ultimo motivo activo. Sin motivos no hay forma de
   * abrir un ticket, asi que el sistema se quedaria sin puerta de entrada.
   */
  function askToggle(topic: TicketTopic) {
    const isLastActive = topic.isActive && activeCount === 1;

    if (isLastActive) {
      setConfirmation({
        tone: "warn",
        icon: Power,
        title: "No se puede desactivar",
        description: (
          <>
            <strong className="font-semibold text-ink">{topic.name}</strong> es el único motivo
            activo. Sin al menos uno no se puede abrir ningún ticket: crea o reactiva otro motivo
            antes de desactivar este.
          </>
        ),
        confirmLabel: "Entendido",
        cancelLabel: "Cerrar",
        onConfirm: () => {},
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
          abrir un ticket. Los {topic.ticketCount.toLocaleString("es-DO")} tickets que ya lo usan
          conservan su motivo y su historial.
        </>
      ) : (
        <>
          <strong className="font-semibold text-ink">{topic.name}</strong> vuelve a estar disponible
          al abrir un ticket, con el departamento y la prioridad que tiene configurados.
        </>
      ),
      confirmLabel: topic.isActive ? "Desactivar" : "Reactivar",
      onConfirm: () => upsert({ ...topic, isActive: !topic.isActive }),
    });
  }

  return (
    <SettingsLayout
      summary={
        topics === null
          ? "Cargando los motivos…"
          : `${all.length} motivos · ${activeCount} activos · encolan en ${
              new Set(all.map((topic) => topic.defaultDepartmentId)).size
            } departamentos`
      }
      action={
        canWrite && (
          <Button size="sm" onClick={() => setModal("nuevo")}>
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
      </div>

      {error && (
        <div className="mb-3">
          <Alert variant="error">{error}</Alert>
        </div>
      )}

      {topics === null ? (
        <div className="flex justify-center py-16">
          <Spinner />
        </div>
      ) : rows.length === 0 ? (
        <p className="py-14 text-center text-[13.5px] text-faint">
          Ningún motivo coincide con este filtro o búsqueda.
        </p>
      ) : (
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
                <Row key={topic.id}>
                  <Td>
                    <span className={`flex items-center gap-2 ${isChild && !isFlat ? "pl-5" : ""}`}>
                      {isChild && !isFlat && (
                        <CornerDownRight aria-hidden className="h-3.5 w-3.5 shrink-0 text-faint" />
                      )}
                      <span className="flex flex-col gap-0.5">
                        <span className="text-[13px] font-medium leading-tight text-ink">
                          {topic.name}
                        </span>
                        {isChild && isFlat && parent && (
                          <span className="text-[11px] leading-tight text-faint">en {parent}</span>
                        )}
                      </span>
                    </span>
                  </Td>
                  <Td className="text-[12.5px] text-brand-gray">
                    {departmentName(topic.defaultDepartmentId)}
                  </Td>
                  <Td>
                    <Badge tone={priorityTone[topic.defaultPriority]}>{topic.defaultPriority}</Badge>
                  </Td>
                  <Td className="text-[12.5px] text-brand-gray">
                    {policy ? (
                      <span className="flex flex-col gap-0.5">
                        <span className="leading-tight">{policy.policy.name}</span>
                        {policy.inherited && (
                          <span className="text-[11px] leading-tight text-faint">
                            heredada de {topic.defaultPriority}
                          </span>
                        )}
                      </span>
                    ) : (
                      <span className="text-warn">
                        Sin política para {topic.defaultPriority}
                      </span>
                    )}
                  </Td>
                  <Td className="text-[12.5px] text-brand-gray">
                    {topic.requiresProductLine ? "Obligatoria" : <span className="text-faint">—</span>}
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
                        />
                        <RowAction
                          label={topic.isActive ? `Desactivar ${topic.name}` : `Reactivar ${topic.name}`}
                          icon={Power}
                          onClick={() => askToggle(topic)}
                        />
                      </div>
                    </Td>
                  )}
                </Row>
              );
            })}
          </tbody>
        </DataTable>
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
          onSave={upsert}
        />
      )}

      {confirmation && <ConfirmDialog {...confirmation} onClose={() => setConfirmation(null)} />}
    </SettingsLayout>
  );
}
