import { AlertCircle, Check, Eye, EyeOff } from "lucide-react";
import { forwardRef, useId, useState, type InputHTMLAttributes, type ReactNode } from "react";
import { controlBase, controlSizes, stateClasses, type ControlSize, type FieldState } from "./fieldStyles";
import { Select, type SelectOption } from "./Select";

/**
 * Controles de formulario del panel: misma gramatica que las tablas — etiqueta
 * en Montserrat versalita, radio de 2 px, filete gris y foco en rojo 185 C.
 *
 * El estado del campo es explicito y visible: reposo, error (borde rojo + mensaje
 * con icono) y correcto (borde verde 348 C + palomita). Nunca se pinta "correcto"
 * antes de que la persona haya tocado el campo: corregir en silencio es una cosa,
 * regañar por adelantado es otra.
 */
export type { FieldState } from "./fieldStyles";

interface ShellProps {
  id: string;
  label: string;
  error?: string;
  hint?: ReactNode;
  required?: boolean;
  children: ReactNode;
}

function FieldShell({ id, label, error, hint, required, children }: ShellProps) {
  return (
    <div className="flex flex-col gap-1">
      <label
        htmlFor={id}
        className="font-heading text-[11px] font-semibold text-zinc-500"
      >
        {label}
        {required && <span className="ml-1 text-brand-red">*</span>}
      </label>

      {children}

      {error ? (
        <p
          id={`${id}-error`}
          className="animate-plf-shake flex items-start gap-1 text-[11px] font-medium text-brand-red-dark"
        >
          <AlertCircle className="mt-px h-3.5 w-3.5 shrink-0" />
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-[11px] leading-relaxed text-zinc-400">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

function describedBy(id: string, error?: string, hint?: ReactNode) {
  if (error) return `${id}-error`;
  return hint ? `${id}-hint` : undefined;
}

interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "size"> {
  label: string;
  error?: string;
  hint?: ReactNode;
  state?: FieldState;
  size?: ControlSize;
}

export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(function TextField(
  { label, error, hint, state = "idle", size = "md", id, className = "", required, ...props },
  ref,
) {
  const generated = useId();
  const fieldId = id ?? props.name ?? generated;
  const resolved: FieldState = error ? "error" : state;

  return (
    <FieldShell id={fieldId} label={label} error={error} hint={hint} required={required}>
      <div className="relative">
        <input
          ref={ref}
          id={fieldId}
          aria-invalid={resolved === "error"}
          aria-describedby={describedBy(fieldId, error, hint)}
          className={`${controlBase} ${stateClasses[resolved]} ${controlSizes[size]} px-3
            placeholder:text-zinc-400 ${resolved === "valid" ? "pr-9" : ""} ${className}`}
          {...props}
        />
        {resolved === "valid" && (
          <Check
            aria-hidden
            className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-green"
          />
        )}
      </div>
    </FieldShell>
  );
});

interface PasswordFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  label: string;
  error?: string;
  hint?: ReactNode;
  state?: FieldState;
}

/** Campo de contrasena con interruptor de visibilidad; el resto, igual que TextField. */
export const PasswordField = forwardRef<HTMLInputElement, PasswordFieldProps>(
  function PasswordField(
    { label, error, hint, state = "idle", id, className = "", required, ...props },
    ref,
  ) {
    const generated = useId();
    const [visible, setVisible] = useState(false);
    const fieldId = id ?? props.name ?? generated;
    const resolved: FieldState = error ? "error" : state;

    return (
      <FieldShell id={fieldId} label={label} error={error} hint={hint} required={required}>
        <div className="relative">
          <input
            ref={ref}
            id={fieldId}
            type={visible ? "text" : "password"}
            aria-invalid={resolved === "error"}
            aria-describedby={describedBy(fieldId, error, hint)}
            className={`${controlBase} ${stateClasses[resolved]} ${controlSizes.md} pl-3 pr-10
              placeholder:text-zinc-400 ${className}`}
            {...props}
          />
          <button
            type="button"
            onClick={() => setVisible((current) => !current)}
            // Fuera del recorrido con Tab: es una ayuda visual, no un paso del formulario.
            tabIndex={-1}
            aria-label={visible ? "Ocultar contraseña" : "Mostrar contraseña"}
            className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center
              rounded-edge text-subtle transition-colors hover:bg-fill hover:text-ink"
          >
            {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </FieldShell>
    );
  },
);

interface SelectFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  options: SelectOption[];
  placeholder?: string;
  error?: string;
  hint?: ReactNode;
  state?: FieldState;
  /** md en formularios estandar; sm para secciones densas (varios selects por fila). */
  size?: ControlSize;
  required?: boolean;
  disabled?: boolean;
  id?: string;
  name?: string;
}

/** Campo desplegable: etiqueta y validacion del formulario sobre el Select propio. */
export function SelectField({
  label,
  value,
  onChange,
  onBlur,
  options,
  placeholder,
  error,
  hint,
  state = "idle",
  size = "md",
  required,
  disabled,
  id,
  name,
}: SelectFieldProps) {
  const generated = useId();
  const fieldId = id ?? name ?? generated;
  const resolved: FieldState = error ? "error" : state;

  return (
    <FieldShell id={fieldId} label={label} error={error} hint={hint} required={required}>
      <Select
        id={fieldId}
        value={value}
        onChange={onChange}
        onBlur={onBlur}
        options={options}
        placeholder={placeholder}
        size={size}
        state={resolved}
        disabled={disabled}
        aria-describedby={describedBy(fieldId, error, hint)}
      />
    </FieldShell>
  );
}

interface CheckboxFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  label: string;
  description?: ReactNode;
}

/** Casilla como fila completa: el bloque entero es el area de click. */
export const CheckboxField = forwardRef<HTMLInputElement, CheckboxFieldProps>(
  function CheckboxField({ label, description, id, className = "", disabled, ...props }, ref) {
    const generated = useId();
    const fieldId = id ?? props.name ?? generated;

    return (
      <label
        htmlFor={fieldId}
        className={`group flex cursor-pointer items-start gap-2.5 rounded-lg border p-3
          transition-all duration-150 select-none shadow-2xs
          border-zinc-200/90 bg-white hover:border-zinc-300 hover:bg-zinc-50/70
          has-checked:border-zinc-300 has-checked:bg-zinc-50/50
          has-disabled:cursor-not-allowed has-disabled:opacity-50 has-disabled:hover:bg-white
          ${className}`}
      >
        <input
          ref={ref}
          id={fieldId}
          type="checkbox"
          disabled={disabled}
          className="peer sr-only"
          {...props}
        />
        <div
          aria-hidden="true"
          className="mt-0.5 flex size-4.5 shrink-0 items-center justify-center rounded-[5px] border border-zinc-300 bg-white shadow-2xs transition-all duration-150
            group-hover:border-zinc-400
            peer-checked:border-brand-red peer-checked:bg-brand-red peer-checked:[&>svg]:opacity-100
            peer-focus-visible:ring-2 peer-focus-visible:ring-brand-red/25
            peer-disabled:opacity-50"
        >
          <Check
            strokeWidth={2.75}
            className="size-3 text-white opacity-0 transition-opacity duration-150"
          />
        </div>
        <span className="flex flex-col gap-0.5 min-w-0">
          <span className="font-heading text-[12.5px] font-semibold leading-snug text-zinc-900 group-hover:text-zinc-950 transition-colors">
            {label}
          </span>
          {description && (
            <span className="text-[11.5px] leading-relaxed text-zinc-500">{description}</span>
          )}
        </span>
      </label>
    );
  },
);
