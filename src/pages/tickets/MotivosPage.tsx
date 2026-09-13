import {
  AlertOctagon,
  AlertTriangle,
  Ban,
  Boxes,
  Briefcase,
  Building2,
  CheckCircle2,
  Clock,
  Factory,
  Flag,
  LayoutGrid,
  Pencil,
  Plus,
  ShieldCheck,
  Tag,
  Trash2,
  TrendingUp,
  Wrench,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { ApiError } from "../../api/client";
import { departmentsApi } from "../../api/departments";
import { ticketTopicsApi, type TicketTopicQuery } from "../../api/ticketTopics";
import { ModuleHeader } from "../../components/app/ModuleHeader";
import { Alert } from "../../components/ui/Alert";
import { Button } from "../../components/ui/Button";
import { ConfirmDialog, type ConfirmDialogProps } from "../../components/ui/ConfirmDialog";
import { DataTable, HeadRow, Row, Td, Th } from "../../components/ui/DataTable";
import { Pagination } from "../../components/ui/Pagination";
import { RowAction } from "../../components/ui/RowAction";
import { SearchInput } from "../../components/ui/SearchInput";
import { Spinner } from "../../components/ui/Spinner";
import { useAuth } from "../../context/useAuth";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";
import { usePagedList } from "../../hooks/usePagedList";
import { formatDateTime } from "../../lib/format";
import type {
  DepartmentResponse,
  TicketTopicListResponse,
  TicketTopicResponse,
} from "../../types/api";
import { MotivoModal } from "./MotivoModal";
import { TicketFilterDropdown, type TicketFilterOption } from "./TicketFilterDropdown";

type StatusFilter = "todos" | "activos" | "inactivos";

const statusFilters: {
  key: StatusFilter;
  label: string;
  countKey: keyof TicketTopicListResponse["counts"];
}[] = [
  { key: "todos", label: "Todos", countKey: "all" },
  { key: "activos", label: "Activos", countKey: "active" },
  { key: "inactivos", label: "Inactivos", countKey: "inactive" },
];

/** El tono no decora: dice cuánta prisa mete cada motivo en el SLA del ticket. */
const priorityClass: Record<string, string> = {
  Emergencia: "border-red-200 bg-red-50 text-red-800",
  Alta: "border-amber-200 bg-amber-50 text-amber-800",
  Normal: "border-line-strong bg-canvas text-ink",
  Baja: "border-line-strong bg-canvas text-subtle",
};

/**
 * Catálogo de motivos. De aquí sale el departamento que el formulario de alta
 * rellena solo al elegir el motivo, así que editarlo cambia a dónde se encolan los tickets.
 */
export function MotivosPage() {
  const { user } = useAuth();
  const isAdmin = Boolean(user?.isAdmin);

  const [departments, setDepartments] = useState<DepartmentResponse[]>([]);
  const [departmentId, setDepartmentId] = useState<number | "todos">("todos");
  const [priority, setPriority] = useState<string>("todas");
  const [actionError, setActionError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<StatusFilter>("todos");
  const [pageSize, setPageSize] = useState(10);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [confirmation, setConfirmation] = useState<Omit<ConfirmDialogProps, "onClose"> | null>(null);
  const [modal, setModal] = useState<"nuevo" | TicketTopicResponse | null>(null);

  const debouncedSearch = useDebouncedValue(search, 300).trim();

  const { data, isStale, error, setPage, refresh } = usePagedList<
    TicketTopicQuery,
    TicketTopicListResponse
  >({
    fetch: ticketTopicsApi.list,
    criteria: {
      pageSize,
      search: debouncedSearch || undefined,
      status,
      departmentId: departmentId === "todos" ? undefined : departmentId,
      priority: priority === "todas" ? undefined : priority,
    },
    fallbackError: "No se pudieron cargar los motivos",
  });

  useEffect(() => {
    departmentsApi.list().then(setDepartments).catch(() => setDepartments([]));
  }, []);

  const rows = data?.items ?? [];
  const counts = data?.counts;

  async function run(id: number, action: () => Promise<unknown>) {
    setBusyId(id);
    setActionError(null);
    try {
      await action();
      // Relee la página: totales y contadores los manda el servidor, no se adivinan aquí.
      refresh();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "No se pudo completar la acción");
    } finally {
      setBusyId(null);
    }
  }

  function askToggleActive(topic: TicketTopicResponse) {
    if (topic.isActive) {
      setConfirmation({
        tone: "danger",
        icon: Ban,
        eyebrow: "Tickets · Motivos",
        title: "Desactivar motivo",
        description: (
          <>
            <strong className="font-semibold text-ink">{topic.name}</strong> dejará de ofrecerse al
            crear tickets. Los {topic.ticketCount} que ya lo usan lo conservan.
          </>
        ),
        confirmLabel: "Desactivar",
        onConfirm: () => run(topic.id, () => ticketTopicsApi.setActive(topic.id, false)),
      });
      return;
    }

    void run(topic.id, () => ticketTopicsApi.setActive(topic.id, true));
  }

  function askDelete(topic: TicketTopicResponse) {
    setConfirmation({
      tone: "danger",
      icon: Trash2,
      eyebrow: "Tickets · Motivos",
      title: "Eliminar motivo",
      description: (
        <>
          Se eliminará <strong className="font-semibold text-ink">{topic.name}</strong> del catálogo.
          Si algún ticket lo usa, el borrado se rechaza y tendrás que desactivarlo.
        </>
      ),
      confirmLabel: "Eliminar",
      onConfirm: () => run(topic.id, () => ticketTopicsApi.remove(topic.id)),
    });
  }

  const departmentOptions: TicketFilterOption[] = [
    {
      value: "todos",
      label: "Todos los departamentos",
      icon: <LayoutGrid className="h-4 w-4 text-zinc-500" />,
    },
    ...departments.map((d) => {
      const name = d.name.toLowerCase();
      let icon = <Building2 className="h-4 w-4 text-zinc-500" />;
      if (name.includes("almac")) {
        icon = <Boxes className="h-4 w-4 text-amber-600" />;
      } else if (name.includes("admin")) {
        icon = <Briefcase className="h-4 w-4 text-blue-600" />;
      } else if (name.includes("calidad")) {
        icon = <ShieldCheck className="h-4 w-4 text-emerald-600" />;
      } else if (name.includes("producc")) {
        icon = <Factory className="h-4 w-4 text-purple-600" />;
      } else if (name.includes("manten")) {
        icon = <Wrench className="h-4 w-4 text-orange-600" />;
      } else if (name.includes("ventas") || name.includes("comercial")) {
        icon = <TrendingUp className="h-4 w-4 text-cyan-600" />;
      }
      return {
        value: String(d.id),
        label: d.name,
        icon,
      };
    }),
  ];

  const priorityFilterOptions: TicketFilterOption[] = [
    {
      value: "todas",
      label: "Todas las prioridades",
      icon: <Flag className="h-4 w-4 text-zinc-500" />,
    },
    {
      value: "Emergencia",
      label: "Emergencia",
      icon: <AlertOctagon className="h-4 w-4 text-brand-red" />,
    },
    {
      value: "Alta",
      label: "Alta",
      icon: <AlertTriangle className="h-4 w-4 text-amber-500" />,
    },
    {
      value: "Normal",
      label: "Normal",
      icon: <CheckCircle2 className="h-4 w-4 text-zinc-500" />,
    },
    {
      value: "Baja",
      label: "Baja",
      icon: <Clock className="h-4 w-4 text-zinc-400" />,
    },
  ];

  return (
    <div className="flex h-full flex-col">
      <ModuleHeader
        title="Motivos"
        summary={
          data
            ? `${data.total} ${data.total === 1 ? "motivo" : "motivos"} · cada uno decide a qué departamento se encola el ticket`
            : "Cargando los motivos…"
        }
        action={
          isAdmin && (
            <Button size="sm" onClick={() => setModal("nuevo")}>
              <Plus className="h-[15px] w-[15px]" />
              Nuevo motivo
            </Button>
          )
        }
      />

      <div className="min-h-0 flex-1 overflow-y-auto pb-8">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder="Buscar por motivo o departamento…"
              className="w-[280px]"
            />
            <TicketFilterDropdown
              title="Seleccionar departamento"
              value={String(departmentId)}
              onChange={(next) => setDepartmentId(next === "todos" ? "todos" : Number(next))}
              options={departmentOptions}
              defaultIcon={<Building2 className="h-4 w-4 text-zinc-500" />}
              aria-label="Filtrar por departamento"
            />
            <TicketFilterDropdown
              title="Seleccionar prioridad"
              value={priority}
              onChange={setPriority}
              options={priorityFilterOptions}
              defaultIcon={<Flag className="h-4 w-4 text-zinc-500" />}
              aria-label="Filtrar por prioridad"
            />

            {(search || departmentId !== "todos" || priority !== "todas") && (
              <button
                type="button"
                onClick={() => {
                  setSearch("");
                  setDepartmentId("todos");
                  setPriority("todas");
                }}
                title="Limpiar filtros"
                className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-2.5 text-[12.5px] font-medium text-zinc-600 shadow-2xs hover:bg-zinc-50 hover:border-zinc-300 transition-all cursor-pointer active:scale-[0.98]"
              >
                <X className="h-3.5 w-3.5 text-zinc-400" />
                <span>Limpiar</span>
              </button>
            )}
          </div>

          {/* Vistas de estado: Todos, Activos e Inactivos a la derecha */}
          <div
            role="group"
            aria-label="Filtro de estado"
            className="inline-flex h-8 items-center gap-0.5 rounded-lg border border-zinc-200 bg-zinc-50 p-0.5"
          >
            {statusFilters.map((filter) => {
              const isActive = status === filter.key;
              const count = counts?.[filter.countKey] ?? 0;
              return (
                <button
                  key={filter.key}
                  type="button"
                  onClick={() => setStatus(filter.key)}
                  aria-pressed={isActive}
                  className={`inline-flex h-7 items-center gap-1.5 rounded-md border px-2.5 text-[12.5px] transition-colors duration-150 outline-none select-none cursor-pointer focus-visible:ring-2 focus-visible:ring-brand-red/25 ${
                    isActive
                      ? "border-zinc-200 bg-white font-semibold text-zinc-900 shadow-2xs"
                      : "border-transparent font-medium text-zinc-500 hover:bg-white/60 hover:text-zinc-800"
                  }`}
                >
                  <span>{filter.label}</span>
                  <span
                    className={`font-heading text-[10px] font-bold leading-none tabular-nums transition-colors ${
                      isActive ? "text-zinc-900" : "text-zinc-400"
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {(error || actionError) && (
          <div className="mb-3">
            <Alert variant="error">{error ?? actionError}</Alert>
          </div>
        )}

        {!data ? (
          <div className="flex justify-center py-16">
            <Spinner />
          </div>
        ) : (
          // Atenuada mientras llega la página nueva: la anterior se queda para no dar un salto en blanco.
          <div className={`transition-opacity ${isStale ? "opacity-60" : ""}`}>
            <DataTable>
              <thead>
                <HeadRow>
                  <Th>Motivo</Th>
                  <Th>Departamento</Th>
                  <Th>Prioridad</Th>
                  <Th>Línea de producto</Th>
                  <Th>Tickets</Th>
                  <Th>Estado</Th>
                  <Th>Actualizado</Th>
                  {isAdmin && <Th className="w-28 text-right">Acciones</Th>}
                </HeadRow>
              </thead>
              <tbody>
                {rows.map((topic) => (
                  <Row key={topic.id} busy={busyId === topic.id}>
                    <Td className="text-[13px] font-medium text-ink">{topic.name}</Td>
                    <Td className="text-[12.5px] text-ink">{topic.defaultDepartmentName}</Td>
                    <Td>
                      <span
                        className={`inline-flex items-center rounded-edge border px-1.5 py-0.5 text-[11px] font-medium ${
                          priorityClass[topic.defaultPriority] ?? priorityClass.Normal
                        }`}
                      >
                        {topic.defaultPriority}
                      </span>
                    </Td>
                    <Td className="text-[12.5px] text-subtle">
                      {topic.requiresProductLine ? "Obligatoria" : "No se pide"}
                    </Td>
                    <Td className="text-[12.5px] text-subtle">{topic.ticketCount}</Td>
                    <Td>
                      <span className="inline-flex items-center gap-1.5 text-[12.5px]">
                        <span
                          aria-hidden
                          className={`h-[7px] w-[7px] rounded-full ${
                            topic.isActive ? "bg-brand-green" : "bg-line-strong"
                          }`}
                        />
                        <span className={topic.isActive ? "text-ink" : "text-subtle"}>
                          {topic.isActive ? "Activo" : "Inactivo"}
                        </span>
                      </span>
                    </Td>
                    <Td className="whitespace-nowrap text-[12.5px] text-subtle">
                      {formatDateTime(topic.updatedAt)}
                    </Td>

                    {isAdmin && (
                      <Td>
                        <div className="flex items-center justify-end gap-1">
                          <RowAction
                            label={`Editar ${topic.name}`}
                            icon={Pencil}
                            onClick={() => setModal(topic)}
                            disabled={busyId === topic.id}
                          />
                          <RowAction
                            label={topic.isActive ? `Desactivar ${topic.name}` : `Activar ${topic.name}`}
                            icon={topic.isActive ? Ban : CheckCircle2}
                            onClick={() => askToggleActive(topic)}
                            disabled={busyId === topic.id}
                          />
                          <RowAction
                            label={`Eliminar ${topic.name}`}
                            icon={Trash2}
                            onClick={() => askDelete(topic)}
                            disabled={busyId === topic.id}
                            danger
                          />
                        </div>
                      </Td>
                    )}
                  </Row>
                ))}
              </tbody>
            </DataTable>

            {rows.length === 0 && (
              <div className="flex flex-col items-center gap-2 py-14 text-center">
                <Tag className="h-6 w-6 text-faint" />
                <p className="text-[13.5px] text-faint">
                  {debouncedSearch || status !== "todos" || departmentId !== "todos" || priority !== "todas"
                    ? "Ningún motivo coincide con el filtro."
                    : "Todavía no hay motivos en el catálogo."}
                </p>
              </div>
            )}

            <Pagination
              page={data.page}
              pageSize={data.pageSize}
              total={data.total}
              totalPages={data.totalPages}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
              noun="motivos"
            />
          </div>
        )}
      </div>

      {confirmation && <ConfirmDialog {...confirmation} onClose={() => setConfirmation(null)} />}

      {modal !== null && (
        <MotivoModal
          topic={modal === "nuevo" ? undefined : modal}
          departments={departments}
          onClose={() => setModal(null)}
          onSaved={refresh}
        />
      )}
    </div>
  );
}
