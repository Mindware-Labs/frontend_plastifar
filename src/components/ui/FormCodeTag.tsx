/**
 * Codigo de control del formulario en papel (PF-FOR-109, PF-FOR-068,
 * PF-FOR-291) en la cabecera de su asistente. Es un dato de referencia, no un
 * estado ni una accion: va en neutro, igual en HCA, Retiros y Discrepancias.
 */
export function FormCodeTag({ code, className = "" }: { code: string; className?: string }) {
  return (
    <span
      className={`shrink-0 rounded-edge border border-line bg-fill px-1.5 py-0.5 font-heading text-[10px] font-bold uppercase tracking-wider tabular-nums text-subtle ${className}`}
    >
      {code}
    </span>
  );
}
