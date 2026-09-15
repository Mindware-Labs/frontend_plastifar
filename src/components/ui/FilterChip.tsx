interface FilterChipProps {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}

/** Pastilla de filtro con contador: papel con filete, y la activa queda pulsada en gris con la cifra en tinta. */
export function FilterChip({ label, count, active, onClick }: FilterChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex h-8 cursor-pointer select-none items-center gap-2 rounded-lg border px-3 text-[12.5px] outline-none
        transition-[background-color,border-color,color,transform] duration-200 ease-out active:scale-[0.98]
        focus-visible:ring-2 focus-visible:ring-brand-red/25 motion-reduce:transition-none motion-reduce:active:scale-100 ${
          active
            ? "border-zinc-300 bg-zinc-100 font-semibold text-zinc-900"
            : "border-zinc-200 bg-white font-medium text-zinc-600 shadow-2xs hover:border-zinc-300 hover:bg-zinc-50 hover:text-zinc-900"
        }`}
    >
      {label}
      <span
        className={`font-heading text-[10px] font-bold leading-none tabular-nums transition-colors ${
          active ? "text-zinc-900" : "text-zinc-400"
        }`}
      >
        {count}
      </span>
    </button>
  );
}
