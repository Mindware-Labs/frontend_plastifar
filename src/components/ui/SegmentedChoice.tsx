import { AlertCircle, type LucideIcon } from "lucide-react";
import { useId, useRef, type KeyboardEvent } from "react";

export interface SegmentedChoiceOption<T extends string = string> {
  value: T;
  label: string;
  icon?: LucideIcon;
}

interface SegmentedChoiceProps<T extends string = string> {
  /** Etiqueta visible del grupo; tambien es su nombre accesible. */
  label: string;
  required?: boolean;
  options: readonly SegmentedChoiceOption<T>[];
  value: T | null | undefined;
  onChange: (value: T) => void;
  onBlur?: () => void;
  error?: string;
  /** Clases de rejilla; por defecto una columna por opcion en dos. */
  gridClassName?: string;
  size?: "sm" | "md";
}

/**
 * Eleccion unica entre pocas opciones visibles a la vez (2 a 4). Es un
 * radiogroup real: una sola parada de Tab (tabindex itinerante), flechas para
 * moverse y seleccionar, Inicio/Fin para los extremos, y foco visible.
 * Para filtros de lista usa SegmentedFilter; para seleccion multiple,
 * ChoiceTileGroup.
 */
export function SegmentedChoice<T extends string = string>({
  label,
  required = false,
  options,
  value,
  onChange,
  onBlur,
  error,
  gridClassName = "grid-cols-2",
  size = "sm",
}: SegmentedChoiceProps<T>) {
  const labelId = useId();
  const errorId = useId();
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const selectedIndex = options.findIndex((o) => o.value === value);
  // Sin seleccion, la primera opcion recibe el Tab.
  const tabIndexOwner = selectedIndex >= 0 ? selectedIndex : 0;

  function select(index: number) {
    const next = options[index];
    if (!next) return;
    onChange(next.value);
    refs.current[index]?.focus();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const last = options.length - 1;
    let target: number | null = null;
    switch (event.key) {
      case "ArrowRight":
      case "ArrowDown":
        target = index === last ? 0 : index + 1;
        break;
      case "ArrowLeft":
      case "ArrowUp":
        target = index === 0 ? last : index - 1;
        break;
      case "Home":
        target = 0;
        break;
      case "End":
        target = last;
        break;
      default:
        return;
    }
    event.preventDefault();
    select(target);
  }

  const height = size === "md" ? "h-8 px-3 text-[12.5px] gap-2" : "h-7 px-2 text-[12px] gap-1.5";
  const iconSize = size === "md" ? "h-3.5 w-3.5" : "h-3 w-3";

  return (
    <div className="flex flex-col gap-1">
      <span id={labelId} className="font-heading text-[11.5px] font-semibold text-faint">
        {label} {required && <span className="text-brand-red">*</span>}
      </span>
      <div
        role="radiogroup"
        aria-labelledby={labelId}
        aria-required={required || undefined}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) onBlur?.();
        }}
        className={`grid ${gridClassName} gap-1 rounded-edge border p-0.5 ${
          error ? "border-brand-red/40 bg-canvas" : "border-line bg-canvas"
        }`}
      >
        {options.map((option, index) => {
          const isSelected = option.value === value;
          const Icon = option.icon;
          return (
            <button
              key={option.value}
              ref={(el) => {
                refs.current[index] = el;
              }}
              type="button"
              role="radio"
              aria-checked={isSelected}
              tabIndex={index === tabIndexOwner ? 0 : -1}
              onClick={() => select(index)}
              onKeyDown={(event) => handleKeyDown(event, index)}
              className={`inline-flex min-w-0 items-center justify-center rounded-edge border transition-colors duration-150 cursor-pointer select-none outline-none focus-visible:ring-2 focus-visible:ring-ink/25 ${height} ${
                isSelected
                  ? "border-line bg-white font-semibold text-ink shadow-2xs"
                  : "border-transparent font-medium text-subtle hover:bg-white/50 hover:text-ink"
              }`}
            >
              {Icon && (
                <Icon aria-hidden className={`${iconSize} shrink-0 ${isSelected ? "text-ink" : "text-faint"}`} />
              )}
              <span className="truncate">{option.label}</span>
            </button>
          );
        })}
      </div>
      {error && (
        <p
          id={errorId}
          title={error}
          className="animate-plf-shake flex items-center gap-1 truncate text-[11px] font-medium leading-none text-brand-red-dark"
        >
          <AlertCircle className="h-3 w-3 shrink-0" />
          <span className="truncate">{error}</span>
        </p>
      )}
    </div>
  );
}
