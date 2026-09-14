export interface SegmentedFilterItem<T extends string = string> {
  key: T;
  label: string;
  count?: number;
}

interface SegmentedFilterProps<T extends string = string> {
  items: SegmentedFilterItem<T>[];
  value: T;
  onChange: (value: T) => void;
  "aria-label"?: string;
  className?: string;
}

// Control segmentado para filtros tipo pastilla con cifras tabulares.
export function SegmentedFilter<T extends string = string>({
  items,
  value,
  onChange,
  "aria-label": ariaLabel = "Filtro",
  className = "",
}: SegmentedFilterProps<T>) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className={`inline-flex h-8 items-center gap-0.5 rounded-lg border border-zinc-200 bg-zinc-50 p-0.5 ${className}`}
    >
      {items.map((item) => {
        const isActive = item.key === value;
        return (
          <button
            key={item.key}
            type="button"
            onClick={() => onChange(item.key)}
            aria-pressed={isActive}
            className={`inline-flex h-7 items-center gap-1.5 rounded-md border px-2.5 text-[12.5px] transition-colors duration-150 outline-none select-none cursor-pointer focus-visible:ring-2 focus-visible:ring-brand-red/25 active:scale-[0.98] ${
              isActive
                ? "border-zinc-200 bg-white font-semibold text-zinc-900 shadow-2xs"
                : "border-transparent font-medium text-zinc-500 hover:bg-white/60 hover:text-zinc-800"
            }`}
          >
            <span>{item.label}</span>
            {item.count !== undefined && (
              <span
                className={`font-heading text-[10px] font-bold leading-none tabular-nums transition-colors ${
                  isActive ? "text-zinc-900" : "text-zinc-400"
                }`}
              >
                {item.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
