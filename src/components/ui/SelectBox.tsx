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
      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-[3px] border outline-none
        transition-[background-color,border-color,box-shadow,transform,opacity] duration-150 ease-out active:scale-90
        focus-visible:ring-3 focus-visible:ring-brand-red/20 ${
          checked
            ? "border-brand-red bg-brand-red text-white shadow-[0_1px_3px_rgba(228,0,43,0.3)]"
            : "border-line-strong bg-white text-transparent hover:border-zinc-400"
        } ${className}`}
    >
      {checked === "mixed" ? (
        <Minus className="h-3 w-3" strokeWidth={3} />
      ) : (
        <Check
          strokeWidth={3}
          className={`h-3 w-3 transition-all duration-150 ${
            checked ? "scale-100 opacity-100" : "scale-75 opacity-0"
          }`}
        />
      )}
    </button>
  );
}
