import { Check, Minus } from "lucide-react";

interface SelectBoxProps {
  checked: boolean | "mixed";
  label: string;
  onToggle: (shiftKey: boolean) => void;
  className?: string;
}

/** Casilla propia: cuadrada, de 2 px, y con el rojo 185 C solo cuando esta marcada. */
export function SelectBox({ checked, label, onToggle, className = "" }: SelectBoxProps) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      onClick={(event) => {
        event.stopPropagation();
        onToggle(event.shiftKey);
      }}
      className={`inline-flex size-4.5 shrink-0 items-center justify-center rounded-[5px] border outline-none
        transition-colors duration-100 ease-out active:scale-95
        focus-visible:ring-2 focus-visible:ring-brand-red/25 ${
          checked
            ? "border-brand-red bg-brand-red text-white"
            : "border-zinc-300 bg-white text-transparent hover:border-zinc-400"
        } ${className}`}
    >
      {checked === "mixed" ? (
        <Minus className="size-3 text-white" strokeWidth={2.75} />
      ) : (
        <Check
          strokeWidth={2.75}
          className={`size-3 text-white ${checked ? "opacity-100" : "opacity-0"}`}
        />
      )}
    </button>
  );
}
