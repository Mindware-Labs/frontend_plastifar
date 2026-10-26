/**
 * Divisor con titulo entre bloques de un formulario. `tight` reduce el aire
 * superior (pt-1) en los dialogos mas compactos.
 */
export function FormDivider({ title, tight = false }: { title: string; tight?: boolean }) {
  return (
    <div className={`flex items-center gap-2 ${tight ? "pt-1" : "pt-2"} border-t border-zinc-100 first:border-0 first:pt-0`}>
      <span className="font-heading text-[10px] font-bold uppercase tracking-[0.08em] text-zinc-400 select-none">
        {title}
      </span>
      <div className="h-px flex-1 bg-zinc-100" />
    </div>
  );
}
