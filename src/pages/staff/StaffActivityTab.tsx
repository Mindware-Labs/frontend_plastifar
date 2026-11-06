import {
  ArrowRight,
  CheckCircle2,
  FileText,
  History,
  MessageSquare,
  ShieldCheck,
  Ticket as TicketIcon,
  Workflow,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { staffApi } from "../../api/staff";
import { Badge } from "../../components/ui/Badge";
import { DetailCard } from "../../components/ui/DetailCard";
import { ErrorRetry } from "../../components/ui/ErrorRetry";
import { SearchInput } from "../../components/ui/SearchInput";
import { SegmentedFilter } from "../../components/ui/SegmentedFilter";
import { ServerPagination } from "../../components/ui/ServerPagination";
import { Skeleton } from "../../components/ui/Skeleton";
import { formatDateTime } from "../../lib/format";
import type { StaffActivityItem, StaffActivityResponse } from "../../types/api";

interface StaffActivityTabProps {
  staffId: number;
  staffName: string;
}

type ActivityCategory = "all" | "tickets" | "tasks" | "forms" | "system";

function getActivityIcon(item: StaffActivityItem) {
  if (item.category === "tickets") {
    if (item.action.toLowerCase().includes("respuesta") || item.action.toLowerCase().includes("nota")) {
      return { icon: MessageSquare, color: "text-blue-600 bg-blue-50 border-blue-200" };
    }
    return { icon: TicketIcon, color: "text-sky-600 bg-sky-50 border-sky-200" };
  }
  if (item.category === "tasks") {
    if (item.action.toLowerCase().includes("completad")) {
      return { icon: CheckCircle2, color: "text-emerald-600 bg-emerald-50 border-emerald-200" };
    }
    return { icon: Workflow, color: "text-violet-600 bg-violet-50 border-violet-200" };
  }
  if (item.category === "forms") {
    return { icon: FileText, color: "text-amber-600 bg-amber-50 border-amber-200" };
  }
  return { icon: ShieldCheck, color: "text-zinc-600 bg-zinc-100 border-zinc-200" };
}

function getActivityBadgeTone(category: string): "neutral" | "slate" | "green" | "warn" | "amber" {
  switch (category) {
    case "tickets":
      return "neutral";
    case "tasks":
      return "slate";
    case "forms":
      return "warn";
    case "system":
      return "slate";
    default:
      return "neutral";
  }
}

export function StaffActivityTab({ staffId, staffName }: StaffActivityTabProps) {
  const [data, setData] = useState<StaffActivityResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [category, setCategory] = useState<ActivityCategory>("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  function loadActivity() {
    setLoading(true);
    setError(null);
    staffApi
      .getActivity(staffId, {
        page,
        pageSize,
        category: category === "all" ? undefined : category,
        search: search.trim() || undefined,
      })
      .then((res) => {
        setData(res);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "No se pudo cargar el historial de actividad.");
      })
      .finally(() => {
        setLoading(false);
      });
  }

  useEffect(() => {
    loadActivity();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [staffId, page, pageSize, category]);

  // Si cambia la búsqueda, reinicia a página 1 tras una breve pausa
  useEffect(() => {
    const timer = setTimeout(() => {
      setPage(1);
      loadActivity();
    }, 280);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const counts = data?.counts ?? { all: 0, tickets: 0, tasks: 0, forms: 0, system: 0 };

  const filterItems = [
    { key: "all" as ActivityCategory, label: "Todo", count: counts.all },
    { key: "tickets" as ActivityCategory, label: "Tickets", count: counts.tickets },
    { key: "tasks" as ActivityCategory, label: "Tareas", count: counts.tasks },
    { key: "forms" as ActivityCategory, label: "Formularios", count: counts.forms },
    { key: "system" as ActivityCategory, label: "Sistema", count: counts.system },
  ];

  return (
    <div className="space-y-3.5">
      {/* Barra de control: Filtro por categoría y búsqueda */}
      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
        <SegmentedFilter<ActivityCategory>
          items={filterItems}
          value={category}
          onChange={(newCat) => {
            setCategory(newCat);
            setPage(1);
          }}
          aria-label="Filtrar por categoría de actividad"
        />

        <div className="w-full sm:w-64">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Buscar en la actividad..."
          />
        </div>
      </div>

      {error !== null && (
        <ErrorRetry onRetry={loadActivity}>{error}</ErrorRetry>
      )}

      {/* Contenedor principal de actividad */}
      <DetailCard
        icon={History}
        title={`Historial de actividad de ${staffName}`}
        aside={
          data && (
            <span className="text-[11.5px] font-medium text-zinc-400 tabular-nums">
              {data.total} {data.total === 1 ? "registro" : "registros"}
            </span>
          )
        }
      >
        {loading ? (
          <div className="divide-y divide-zinc-100 p-4 space-y-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex gap-3 pt-3 first:pt-0">
                <Skeleton className="size-8 shrink-0 rounded-lg" delay={i * 40} />
                <div className="flex-1 space-y-2">
                  <div className="flex items-center justify-between">
                    <Skeleton className="h-4 w-36 rounded" delay={i * 40 + 20} />
                    <Skeleton className="h-3 w-24 rounded" delay={i * 40 + 40} />
                  </div>
                  <Skeleton className="h-3 w-3/4 rounded" delay={i * 40 + 60} />
                </div>
              </div>
            ))}
          </div>
        ) : data && data.items.length > 0 ? (
          <div className="relative p-4 sm:p-5">
            {/* Línea vertical de la cronología */}
            <div
              aria-hidden
              className="absolute left-[27px] sm:left-[31px] top-6 bottom-6 w-px bg-zinc-200/80"
            />

            <ul className="relative space-y-4">
              {data.items.map((item) => {
                const { icon: Icon, color } = getActivityIcon(item);
                const badgeTone = getActivityBadgeTone(item.category);

                return (
                  <li key={item.id} className="relative flex gap-3.5 group">
                    {/* Icono de la acción */}
                    <div
                      className={`relative z-10 flex size-7 sm:size-8 shrink-0 items-center justify-center rounded-lg border shadow-2xs ${color}`}
                    >
                      <Icon className="size-3.5 sm:size-4" />
                    </div>

                    {/* Contenido descriptivo */}
                    <div className="flex-1 min-w-0 pt-0.5">
                      <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="font-heading text-[13px] font-bold text-zinc-900">
                            {item.action}
                          </span>
                          <Badge tone={badgeTone} className="capitalize">
                            {item.category}
                          </Badge>
                          {item.title && (
                            <span className="font-medium text-[12px] text-zinc-500">
                              · {item.title}
                            </span>
                          )}
                        </div>

                        <time
                          dateTime={item.timestamp}
                          className="font-mono text-[11px] text-zinc-400 tabular-nums shrink-0"
                          title={new Date(item.timestamp).toLocaleString("es-DO")}
                        >
                          {formatDateTime(item.timestamp)}
                        </time>
                      </div>

                      <p className="mt-1 text-[12.5px] leading-relaxed text-zinc-700">
                        {item.description}
                      </p>

                      {/* Detalles adicionales si existen */}
                      {item.details && item.details !== item.description && (
                        <div className="mt-1.5 rounded-md border border-zinc-200/70 bg-zinc-50/60 px-2.5 py-1.5 text-[11.5px] text-zinc-600 line-clamp-3">
                          {item.details}
                        </div>
                      )}

                      {/* Enlace directo al recurso si aplica */}
                      {item.linkTo && (
                        <div className="mt-1.5">
                          <Link
                            to={item.linkTo}
                            className="inline-flex items-center gap-1 text-[11.5px] font-medium text-brand-red hover:underline"
                          >
                            <span>Ver {item.title || "recurso"}</span>
                            <ArrowRight className="size-3" />
                          </Link>
                        </div>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : (
          <div className="py-12 text-center px-4">
            <History className="mx-auto h-9 w-9 text-zinc-300" />
            <p className="mt-2.5 text-[13.5px] font-medium text-zinc-700">
              No se encontraron registros de actividad
            </p>
            <p className="mt-1 text-[12px] text-zinc-400 max-w-sm mx-auto">
              {search
                ? `No hay acciones que coincidan con la búsqueda "${search}".`
                : category !== "all"
                ? `No hay acciones registradas en la categoría ${category}.`
                : "Este colaborador aún no registra acciones o movimientos dentro del sistema."}
            </p>
          </div>
        )}

        {/* Paginación en el pie de la tarjeta */}
        {data && data.totalPages > 1 && (
          <div className="border-t border-zinc-100 px-4 py-2 bg-zinc-50/30">
            <ServerPagination
              data={data}
              onPageChange={setPage}
              onPageSizeChange={(newSize) => {
                setPageSize(newSize);
                setPage(1);
              }}
              noun="actividades"
              nounSingular="actividad"
              loading={loading}
            />
          </div>
        )}
      </DetailCard>
    </div>
  );
}
