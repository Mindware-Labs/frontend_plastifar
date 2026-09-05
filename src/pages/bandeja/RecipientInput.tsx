import { useEffect, useRef, useState, type KeyboardEvent, type RefObject } from "react";
import { emailsApi } from "../../api/emails";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";
import type { ContactResponse } from "../../types/api";

interface RecipientInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  autoFocus?: boolean;
  inputRef?: RefObject<HTMLInputElement | null>;
}

/** El trozo que se esta escribiendo: lo que va despues de la ultima coma o punto y coma. */
function splitCurrent(value: string) {
  const at = Math.max(value.lastIndexOf(","), value.lastIndexOf(";"));
  return { head: at >= 0 ? value.slice(0, at + 1) : "", current: value.slice(at + 1).trim() };
}

/**
 * Campo de direcciones con sugerencias de contactos conocidos. Varias direcciones
 * van separadas por coma; la sugerencia completa solo la que se esta escribiendo.
 */
export function RecipientInput({ value, onChange, placeholder, className = "", autoFocus, inputRef }: RecipientInputProps) {
  const [suggestions, setSuggestions] = useState<ContactResponse[]>([]);
  const [active, setActive] = useState(0);
  const [open, setOpen] = useState(false);
  const ownRef = useRef<HTMLInputElement>(null);
  const ref = inputRef ?? ownRef;

  const { head, current } = splitCurrent(value);
  const query = useDebouncedValue(current, 200);

  useEffect(() => {
    if (query.length < 2) return;

    let cancelled = false;
    emailsApi
      .contacts(query)
      .then((list) => {
        if (cancelled) return;
        setSuggestions(list);
        setActive(0);
        setOpen(list.length > 0);
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [query]);

  // Con menos de dos letras no hay busqueda: lo que quedo de antes no se muestra.
  const shown = query.length >= 2 ? suggestions : [];

  function pick(contact: ContactResponse) {
    onChange(`${head}${head ? " " : ""}${contact.email}, `);
    setOpen(false);
    setSuggestions([]);
    ref.current?.focus();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (!open || shown.length === 0) return;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((index) => (index + 1) % shown.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((index) => (index - 1 + shown.length) % shown.length);
    } else if (event.key === "Enter" || event.key === "Tab") {
      event.preventDefault();
      pick(shown[active]);
    } else if (event.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div className="relative min-w-0 flex-1">
      <input
        ref={ref}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={handleKeyDown}
        onFocus={() => shown.length > 0 && setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        placeholder={placeholder}
        autoFocus={autoFocus}
        autoComplete="off"
        role="combobox"
        aria-expanded={open}
        aria-autocomplete="list"
        className={`w-full bg-transparent text-[12px] text-ink outline-none placeholder:text-faint ${className}`}
      />

      {open && shown.length > 0 && (
        <ul
          role="listbox"
          className="absolute left-0 top-full z-30 mt-1 max-h-56 w-full max-w-[420px] overflow-y-auto rounded-edge
            border border-line bg-white py-1 shadow-[0_8px_24px_-4px_rgba(27,27,29,0.14)]"
        >
          {shown.map((contact, index) => (
            <li
              key={contact.email}
              role="option"
              aria-selected={index === active}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => pick(contact)}
              onMouseEnter={() => setActive(index)}
              className={`flex cursor-pointer flex-col px-3 py-1.5 text-[12px] ${
                index === active ? "bg-brand-red/[0.06] text-ink" : "text-brand-gray"
              }`}
            >
              {contact.name && <span className="font-medium text-ink">{contact.name}</span>}
              <span className={contact.name ? "text-[11px] text-subtle" : ""}>{contact.email}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
