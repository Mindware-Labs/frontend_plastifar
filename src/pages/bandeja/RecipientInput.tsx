import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type RefObject } from "react";
import { emailsApi } from "../../api/emails";
import {
  filterMailContactDirectory,
  useMailContactDirectory,
} from "../../hooks/useMailContactDirectory";
import type { ContactResponse } from "../../types/api";

interface RecipientInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  autoFocus?: boolean;
  inputRef?: RefObject<HTMLInputElement | null>;
  /** Texto con direcciones mal formadas (tiempo real). */
  invalid?: boolean;
}

/** El trozo que se esta escribiendo: lo que va despues de la ultima coma o punto y coma. */
function splitCurrent(value: string) {
  const at = Math.max(value.lastIndexOf(","), value.lastIndexOf(";"));
  return { head: at >= 0 ? value.slice(0, at + 1) : "", current: value.slice(at + 1).trim() };
}

function mergeContacts(primary: ContactResponse[], secondary: ContactResponse[]) {
  const seen = new Set(primary.map((item) => item.email.toLowerCase()));
  const merged = [...primary];
  for (const item of secondary) {
    const key = item.email.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(item);
  }
  return merged;
}

/** Selector de destinatarios con autocompletado de contactos sugeridos. */
export function RecipientInput({
  value,
  onChange,
  placeholder,
  className = "",
  autoFocus,
  inputRef,
  invalid = false,
}: RecipientInputProps) {
  const directory = useMailContactDirectory();
  const [remoteSuggestions, setRemoteSuggestions] = useState<ContactResponse[]>([]);
  const [active, setActive] = useState(0);
  const [open, setOpen] = useState(false);
  const ownRef = useRef<HTMLInputElement>(null);
  const ref = inputRef ?? ownRef;

  const { head, current } = splitCurrent(value);
  const localMatches = useMemo(
    () => filterMailContactDirectory(directory, current, 10),
    [directory, current],
  );

  useEffect(() => {
    if (current.length < 2) {
      setRemoteSuggestions([]);
      return;
    }

    let cancelled = false;
    emailsApi
      .contacts(current)
      .then((list) => {
        if (cancelled) return;
        setRemoteSuggestions(list);
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [current]);

  const suggestions = useMemo(
    () => mergeContacts(localMatches, remoteSuggestions).slice(0, 12),
    [localMatches, remoteSuggestions],
  );

  useEffect(() => {
    setActive(0);
    setOpen(current.length >= 2 && suggestions.length > 0);
  }, [current, suggestions.length]);

  function pick(contact: ContactResponse) {
    onChange(`${head}${head ? " " : ""}${contact.email}, `);
    setOpen(false);
    setRemoteSuggestions([]);
    ref.current?.focus();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (!open || suggestions.length === 0) return;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((index) => (index + 1) % suggestions.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((index) => (index - 1 + suggestions.length) % suggestions.length);
    } else if (event.key === "Enter" || event.key === "Tab") {
      event.preventDefault();
      pick(suggestions[active]);
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
        onFocus={() => current.length >= 2 && suggestions.length > 0 && setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        placeholder={placeholder}
        autoFocus={autoFocus}
        autoComplete="off"
        role="combobox"
        aria-expanded={open}
        aria-autocomplete="list"
        aria-invalid={invalid || undefined}
        className={`w-full bg-transparent text-[12.5px] outline-none font-medium ${className} ${
          invalid
            ? "text-brand-red placeholder:text-red-300/80 caret-brand-red"
            : "text-zinc-900 placeholder:text-zinc-400"
        }`}
      />

      {open && suggestions.length > 0 && (
        <ul
          role="listbox"
          className="animate-plf-toast-in absolute left-0 top-full z-30 mt-1.5 max-h-56 w-max min-w-[11rem] max-w-[min(100%,26rem)] overflow-y-auto overflow-x-hidden rounded-lg
            border border-zinc-200/90 bg-white p-1 shadow-[0_10px_28px_-6px_rgba(0,0,0,0.12),0_2px_8px_-2px_rgba(0,0,0,0.04)]"
        >
          {suggestions.map((contact, index) => (
            <li
              key={contact.email}
              role="option"
              aria-selected={index === active}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => pick(contact)}
              onMouseEnter={() => setActive(index)}
              className={`max-w-full cursor-pointer rounded-md px-2.5 py-1.5 text-[12px] transition-colors ${
                index === active ? "bg-zinc-100 text-zinc-900" : "text-zinc-700 hover:bg-zinc-50"
              }`}
            >
              {contact.name && (
                <span className="block max-w-full truncate font-semibold text-zinc-900">{contact.name}</span>
              )}
              <span
                className={`block max-w-full truncate whitespace-nowrap ${
                  contact.name ? "text-[11px] text-zinc-500" : "font-medium text-zinc-800"
                }`}
              >
                {contact.email}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
