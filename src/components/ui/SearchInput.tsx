import { Search, X } from "lucide-react";
import { useId } from "react";

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  className?: string;
}

/** Campo de búsqueda contextual para tablas y listados. */
export function SearchInput({ value, onChange, placeholder, className = "" }: SearchInputProps) {
  const id = useId();

  return (
    <div className={`relative ${className}`}>
      <Search
        aria-hidden
        className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400"
      />
      <input
        id={id}
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="w-full h-8 rounded-lg border border-zinc-200 bg-white pl-8 pr-7 text-[12.5px] text-zinc-800
          placeholder:text-zinc-400 placeholder:font-normal shadow-2xs outline-none transition-colors hover:border-zinc-300
          focus:border-zinc-400 focus:ring-2 focus:ring-zinc-400/20 [&::-webkit-search-cancel-button]:hidden"
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
