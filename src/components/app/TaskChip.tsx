import { ArrowUpRight, Check, ListTodo } from "lucide-react";
import { useEffect, useMemo, useRef } from "react";
import { Link } from "react-router-dom";
import type { EmailLinkedTask, TaskStatus } from "../../types/tasks";
import { Popover, PopoverContent, PopoverTrigger } from "../shadcn/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "../shadcn/tooltip";
import { Button } from "../ui/Button";

/** Pastilla de enlace o creación de tarea vinculada a un correo (paridad con TicketChip). */

const SETTLE_MS = 2400;

const rootClass =
  "group/chip relative inline-flex shrink-0 select-none items-center rounded-lg border outline-none " +
  "transition-[background-color,border-color,color,transform,box-shadow] duration-200 ease-out " +
  "focus-visible:ring-2 focus-visible:ring-brand-red/25 focus-visible:border-brand-red/40 " +
  "motion-reduce:transition-none";

const restingClass =
  "border-zinc-200 bg-white text-zinc-700 shadow-2xs hover:border-zinc-300 hover:bg-zinc-50 hover:text-zinc-900";

const pressedClass = "border-zinc-300 bg-zinc-100 text-zinc-900 shadow-none";

const createdClass = "border-brand-green/40 bg-brand-green/[0.06] text-zinc-900 shadow-2xs";

const mutedClass = "border-zinc-200 bg-zinc-50 text-zinc-700 shadow-2xs hover:border-zinc-300 hover:bg-white";

function isOpenStatus(status: TaskStatus) {
  return status === "Pendiente" || status === "EnProgreso";
}

export function taskStatusLabel(status: TaskStatus): string {
  switch (status) {
    case "Pendiente":
      return "Pendiente";
    case "EnProgreso":
      return "En progreso";
    case "Completada":
      return "Completada";
    case "Cancelada":
      return "Cancelada";
    default:
      return status;
  }
}

function taskStatusTone(status: TaskStatus): string {
  if (isOpenStatus(status)) return "text-brand-red-dark bg-brand-red/10 border-brand-red/20";
  if (status === "Completada") return "text-emerald-800 bg-emerald-50 border-emerald-200/80";
  return "text-zinc-600 bg-zinc-100 border-zinc-200";
}

function Seal({ tone, children }: { tone: "rest" | "created"; children: React.ReactNode }) {
  return (
    <span
      aria-hidden
      className={`flex size-5 shrink-0 items-center justify-center rounded-md transition-colors duration-200 ease-out motion-reduce:transition-none ${
        tone === "created"
          ? "animate-plf-seal-pop bg-brand-green text-white"
          : "bg-brand-red/10 text-brand-red group-hover/chip:bg-brand-red group-hover/chip:text-white group-active/chip:bg-brand-red-dark"
      }`}
    >
      {children}
    </span>
  );
}

interface TaskChipProps {
  tasks: EmailLinkedTask[];
  size?: "md" | "xs";
  justCreatedId?: number | null;
  onSettled?: () => void;
  active?: boolean;
  busy?: boolean;
  onCreate?: () => void;
  className?: string;
}

export function TaskChip({
  tasks,
  size = "md",
  justCreatedId = null,
  active = false,
  busy = false,
  onCreate,
  onSettled,
  className = "",
}: TaskChipProps) {
  const openTasks = useMemo(() => tasks.filter((t) => isOpenStatus(t.status)), [tasks]);
  const primary = openTasks[0] ?? tasks[0] ?? null;
  const confirming = primary != null && justCreatedId === primary.id;

  const onSettledRef = useRef(onSettled);
  useEffect(() => {
    onSettledRef.current = onSettled;
  }, [onSettled]);

  useEffect(() => {
    if (!justCreatedId) return;
    const timer = window.setTimeout(() => onSettledRef.current?.(), SETTLE_MS);
    return () => window.clearTimeout(timer);
  }, [justCreatedId]);

  if (size === "xs") {
    if (!primary) return null;
    return (
      <span
        title={`Tarea ${primary.number}`}
        className={`inline-flex h-4 shrink-0 items-center gap-1 rounded-[5px] border border-zinc-200 bg-white pl-1 pr-1.5 font-heading text-[9.5px] font-bold tabular-nums tracking-[0.02em] text-zinc-700 ${className}`}
      >
        <span aria-hidden className="size-1.5 rounded-full bg-brand-red" />
        {primary.number}
      </span>
    );
  }

  if (!primary) {
    if (!onCreate) return null;
    return (
      <button
        type="button"
        onClick={onCreate}
        disabled={busy}
        aria-busy={busy || undefined}
        data-active={active}
        className={`${rootClass} h-7 cursor-pointer gap-2 pl-1 pr-2.5 active:scale-[0.98] motion-reduce:active:scale-100 disabled:cursor-progress ${
          active ? pressedClass : restingClass
        } ${className}`}
      >
        <Seal tone="rest">
          {busy ? (
            <span className="size-3 animate-spin rounded-full border-[1.5px] border-current border-t-transparent" />
          ) : (
            <ListTodo className="size-3" strokeWidth={2.25} />
          )}
        </Seal>
        <span className="text-[12px] font-medium leading-none">{busy ? "Creando…" : "Crear tarea"}</span>
      </button>
    );
  }

  if (isOpenStatus(primary.status)) {
    const eyebrow = confirming ? "Tarea creada" : "Desde este correo";
    const title =
      openTasks.length > 1
        ? `${openTasks.length} tareas activas desde este correo · abrir ${primary.number}`
        : `Tarea ${primary.number}, creada a partir de este correo`;

    return (
      <Link
        to={`/tareas/${primary.id}`}
        title={title}
        aria-label={`${eyebrow}: ver la tarea ${primary.number}`}
        data-confirming={confirming}
        className={`${rootClass} h-7 gap-2 pl-1 pr-2 active:scale-[0.98] motion-reduce:active:scale-100 ${
          confirming ? createdClass : restingClass
        } ${className}`}
      >
        <Seal tone={confirming ? "created" : "rest"}>
          {confirming ? (
            <Check className="size-3" strokeWidth={3} />
          ) : (
            <ListTodo className="size-3" strokeWidth={2.25} />
          )}
        </Seal>

        <span className="flex flex-col justify-center gap-[3px]">
          <span
            className={`font-heading text-[8.5px] font-bold uppercase leading-none tracking-[0.08em] transition-colors duration-300 ${
              confirming ? "text-brand-green" : "text-zinc-400 group-hover/chip:text-zinc-500"
            }`}
          >
            {eyebrow}
          </span>
          <span className="font-heading text-[11px] font-bold leading-none tabular-nums tracking-[0.01em] text-zinc-900">
            {primary.number}
          </span>
        </span>

        <ArrowUpRight
          aria-hidden
          className="ml-0.5 size-3 shrink-0 text-zinc-400 opacity-0 -translate-x-0.5 translate-y-0.5 transition-[opacity,transform] duration-280 ease-plf-spring group-hover/chip:translate-x-0 group-hover/chip:translate-y-0 group-hover/chip:opacity-100 group-focus-visible/chip:opacity-100 motion-reduce:transition-none"
        />
      </Link>
    );
  }

  return (
    <Popover>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <button
              type="button"
              aria-label="Ver tareas vinculadas a este correo"
              className={`${rootClass} h-7 cursor-pointer gap-2 pl-1 pr-2.5 ${mutedClass} ${className}`}
            >
              <span className="flex size-5 items-center justify-center rounded-md bg-zinc-200/80 text-zinc-600">
                <ListTodo className="size-3" strokeWidth={2.25} />
              </span>
              <span className="flex flex-col justify-center gap-[3px] text-left">
                <span className="font-heading text-[8.5px] font-bold uppercase leading-none tracking-[0.08em] text-zinc-500">
                  Desde este correo
                </span>
                <span className="font-heading text-[11px] font-bold leading-none text-zinc-800">
                  {tasks.length === 1 ? "Tarea cerrada" : `${tasks.length} tareas`}
                </span>
              </span>
            </button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent>Tareas creadas desde este correo</TooltipContent>
      </Tooltip>

      <PopoverContent align="end" sideOffset={6} className="w-80 p-3.5">
        <LinkedTasksPanel tasks={tasks} onCreate={onCreate} />
      </PopoverContent>
    </Popover>
  );
}

interface LinkedTasksPanelProps {
  tasks: EmailLinkedTask[];
  onCreate?: () => void;
}

function LinkedTasksPanel({ tasks, onCreate }: LinkedTasksPanelProps) {
  const allClosed = tasks.every((t) => !isOpenStatus(t.status));

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2.5">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-brand-red/20 bg-brand-red/8 text-brand-red shadow-2xs">
          <ListTodo className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <h4 className="font-heading text-xs font-bold uppercase tracking-wider text-brand-red-dark">Tareas</h4>
          <p className="text-[11px] text-subtle">Vinculadas a este correo</p>
        </div>
      </div>

      <p className="text-[12px] leading-relaxed text-ink">
        {allClosed
          ? "De este correo ya se creó al menos una tarea; todas están completadas o canceladas."
          : "De este correo se han creado las siguientes tareas:"}
      </p>

      <ul className="max-h-48 space-y-1.5 overflow-y-auto no-scrollbar">
        {tasks.map((task) => (
          <li key={task.id}>
            <Link
              to={`/tareas/${task.id}`}
              className="group flex items-center justify-between gap-2 rounded-edge border border-line bg-canvas px-2.5 py-2 text-left transition-colors hover:border-brand-red/30 hover:bg-white"
            >
              <div className="min-w-0">
                <p className="truncate font-heading text-[11px] font-bold tabular-nums text-zinc-900">{task.number}</p>
                <p className="truncate text-[11px] text-subtle">{task.title}</p>
              </div>
              <span
                className={`shrink-0 rounded-full border px-2 py-0.5 font-heading text-[9px] font-bold uppercase tracking-wide ${taskStatusTone(task.status)}`}
              >
                {taskStatusLabel(task.status)}
              </span>
            </Link>
          </li>
        ))}
      </ul>

      {onCreate && (
        <div className="border-t border-line-soft pt-2.5">
          <Button type="button" variant="secondary" size="sm" className="w-full" onClick={onCreate}>
            Crear otra tarea desde este correo
          </Button>
        </div>
      )}
    </div>
  );
}
