import { Search, X } from "lucide-react";
import { useId } from "react";
import { controlBase, controlSizes, stateClasses } from "./fieldStyles";

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  className?: string;
}

/**
 * Buscador de una tabla. Vive junto a los demas criterios, no en la cabecera:
 * filtra lo que hay debajo, y un control lejos de lo que afecta se lee como si
 * buscara en toda la aplicacion.
 */
export function SearchInput({ value, onChange, placeholder, className = "" }: SearchInputProps) {
  const id = useId();

  return (
    <div className={`relative ${className}`}>
      <Search
        aria-hidden
        className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-faint"
      />
      <input
        id={id}
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className={`${controlBase} ${stateClasses.idle} ${controlSizes.sm}
          pl-8 pr-8 font-medium placeholder:font-normal placeholder:text-faint
          [&::-webkit-search-cancel-button]:hidden`}
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label="Limpiar búsqueda"
          className="absolute right-1.5 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center
            rounded-full text-faint transition-colors hover:bg-fill hover:text-ink"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}
