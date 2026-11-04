/** Copy y KPIs de PF-FOR solo en contexto de tarea (TAR-…), no en tickets. */

const scopeCodeMonoClassName = "font-mono text-[11px] font-semibold tabular-nums text-zinc-800";

export function TaskFormHostLinkSubtitle({ taskNumber }: { taskNumber: string }) {
  return (
    <p className="mt-1 text-xs text-zinc-500">
      Formulario empresarial vinculado a la tarea{" "}
      <span className={scopeCodeMonoClassName}>{taskNumber}</span> · Plastifar S.A.
    </p>
  );
}

export function TaskScopeCodeKpi({ taskNumber }: { taskNumber: string }) {
  return (
    <div className="rounded-xl border border-zinc-200/80 bg-zinc-50/60 p-3.5">
      <span className="font-heading text-[10px] font-bold uppercase tracking-wider text-zinc-400">
        Código tarea
      </span>
      <p className="mt-1 font-mono text-sm font-bold tabular-nums text-zinc-900">{taskNumber}</p>
      <span className="text-[10.5px] text-zinc-500">Misma referencia del encabezado</span>
    </div>
  );
}
