interface FilterChipProps {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}

/** Pastilla de filtro con contador: papel con filete, y la activa va en rojo de marca, sin escalado para que el texto quede nítido. */
export function FilterChip({ label, count, active, onClick }: FilterChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex h-8 cursor-pointer select-none items-center gap-2 rounded-lg border px-3 text-[12.5px] outline-none
        transition-colors duration-150 antialiased
        focus-visible:ring-2 focus-visible:ring-brand-red/25 motion-reduce:transition-none ${
          active
            ? "border-brand-red-dark bg-brand-red font-semibold text-white shadow-[0_1px_2px_rgba(184,0,31,0.35)] hover:bg-brand-red-dark"
            : "border-zinc-200 bg-white font-medium text-zinc-600 shadow-2xs hover:border-zinc-300 hover:bg-zinc-50 hover:text-zinc-900"
        }`}
    >
      {label}
      <span
        className={`font-heading text-[10px] font-bold leading-none tabular-nums transition-colors ${
          active ? "text-white" : "text-zinc-400"
        }`}
      >
        {count}
      </span>
    </button>
  );
}
