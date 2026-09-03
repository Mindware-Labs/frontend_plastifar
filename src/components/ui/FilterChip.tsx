interface FilterChipProps {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}

/** Pastilla de filtro con contador. Activa = rojo 185 C pleno. */
export function FilterChip({ label, count, active, onClick }: FilterChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex h-8 items-center gap-[7px] rounded-full border px-3.5 text-[12.5px] font-medium
        transition-colors ${
          active
            ? "border-brand-red bg-brand-red text-white"
            : "border-line bg-white text-zinc-500 hover:border-line-strong hover:text-ink"
        }`}
    >
      {label}
      <span
        className={`rounded-full px-1.5 py-px text-[11px] font-semibold ${
          active ? "bg-white/22 text-white" : "bg-fill text-subtle"
        }`}
      >
        {count}
      </span>
    </button>
  );
}
