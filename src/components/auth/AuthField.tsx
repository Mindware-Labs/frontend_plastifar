import { CircleAlert, Eye, EyeOff } from "lucide-react";
import {
  forwardRef,
  useId,
  useRef,
  useState,
  type InputHTMLAttributes,
  type MouseEvent,
  type ReactNode,
} from "react";

/**
 * Campo de formulario del area de autenticacion.
 *
 * Geometria recta (2px de radio), acorde al trazo pesado y geometrico del
 * logotipo. Con esquinas vivas la calidad no puede venir de la suavidad, asi
 * que viene de la precision: filetes de 1px, un separador vertical entre icono
 * y contenido, y un subrayado rojo de 2px que se despliega desde la izquierda
 * al enfocar —el mismo recurso de filete que usa la papeleria institucional—.
 */

const shellBase =
  "group relative flex h-16 cursor-text items-center gap-3 rounded-edge border pl-4 pr-2 transition-[border-color,background-color,box-shadow] duration-200 ease-out";

const shellIdle =
  "border-zinc-200 bg-[#fbfbfc] hover:border-zinc-300 hover:bg-white focus-within:border-brand-red/50 focus-within:bg-white focus-within:shadow-[0_0_0_3px_rgba(228,0,43,0.07)]";

const shellError =
  "border-brand-red/55 bg-white shadow-[0_0_0_3px_rgba(228,0,43,0.07)]";

const labelBase =
  "block cursor-text font-heading text-[10.5px] font-semibold uppercase leading-none tracking-[0.1em] transition-colors duration-200";

const inputBase =
  "mt-[5px] h-[22px] w-full min-w-0 bg-transparent p-0 text-[15px] font-medium text-ink caret-brand-red outline-none placeholder:font-normal placeholder:text-zinc-300";

interface FieldFrameProps {
  label: string;
  inputId: string;
  error?: string;
  icon: ReactNode;
  children: ReactNode;
  trailing?: ReactNode;
}

function FieldFrame({ label, inputId, error, icon, children, trailing }: FieldFrameProps) {
  const shellRef = useRef<HTMLDivElement>(null);

  // Un campo de calidad se enfoca al pulsar en cualquier punto de su
  // superficie, no solo sobre los 22px del <input>.
  function focusFromShell(event: MouseEvent<HTMLDivElement>) {
    if ((event.target as HTMLElement).closest("input, button")) return;
    event.preventDefault();
    shellRef.current?.querySelector("input")?.focus();
  }

  return (
    <div>
      <div
        ref={shellRef}
        onMouseDown={focusFromShell}
        className={`${shellBase} ${error ? shellError : shellIdle}`}
      >
        <span
          className={`shrink-0 transition-colors duration-200 ${
            error ? "text-brand-red" : "text-zinc-400 group-focus-within:text-brand-red"
          }`}
        >
          {icon}
        </span>

        <span
          aria-hidden
          className={`h-8 w-px shrink-0 transition-colors duration-200 ${
            error ? "bg-brand-red/25" : "bg-zinc-200 group-focus-within:bg-brand-red/25"
          }`}
        />

        <span className="flex min-w-0 flex-1 flex-col justify-center">
          <label
            htmlFor={inputId}
            className={`${labelBase} ${
              error ? "text-brand-red/85" : "text-zinc-400 group-focus-within:text-brand-red/85"
            }`}
          >
            {label}
          </label>
          {children}
        </span>

        {trailing}

        {/* Filete inferior: se despliega desde la izquierda al enfocar */}
        <span
          aria-hidden
          className={`pointer-events-none absolute -bottom-px -inset-x-px h-[2px] origin-left bg-brand-red
            transition-transform duration-300 ease-out motion-reduce:transition-none
            ${error ? "scale-x-100" : "scale-x-0 group-focus-within:scale-x-100"}`}
        />
      </div>

      {error && (
        <p
          id={`${inputId}-error`}
          className="mt-2 flex items-center gap-1.5 text-[12.5px] font-medium text-brand-red"
        >
          <CircleAlert className="h-3.5 w-3.5 shrink-0" aria-hidden />
          {error}
        </p>
      )}
    </div>
  );
}

interface AuthFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  icon: ReactNode;
  error?: string;
}

export const AuthField = forwardRef<HTMLInputElement, AuthFieldProps>(function AuthField(
  { label, icon, error, id, className = "", ...props },
  ref,
) {
  const fallbackId = useId();
  const inputId = id ?? props.name ?? fallbackId;

  return (
    <FieldFrame label={label} inputId={inputId} error={error} icon={icon}>
      <input
        ref={ref}
        id={inputId}
        className={`${inputBase} ${className}`}
        aria-invalid={!!error}
        aria-describedby={error ? `${inputId}-error` : undefined}
        {...props}
      />
    </FieldFrame>
  );
});

interface AuthPasswordFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  label: string;
  icon: ReactNode;
  error?: string;
}

export const AuthPasswordField = forwardRef<HTMLInputElement, AuthPasswordFieldProps>(
  function AuthPasswordField({ label, icon, error, id, className = "", ...props }, ref) {
    const [visible, setVisible] = useState(false);
    const fallbackId = useId();
    const inputId = id ?? props.name ?? fallbackId;

    return (
      <FieldFrame
        label={label}
        inputId={inputId}
        error={error}
        icon={icon}
        trailing={
          <button
            type="button"
            onClick={() => setVisible((v) => !v)}
            tabIndex={-1}
            aria-label={visible ? "Ocultar contraseña" : "Mostrar contraseña"}
            className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-edge text-zinc-400 transition-colors duration-150 hover:bg-zinc-100 hover:text-brand-gray"
          >
            {visible ? <EyeOff className="h-[17px] w-[17px]" /> : <Eye className="h-[17px] w-[17px]" />}
          </button>
        }
      >
        <input
          ref={ref}
          id={inputId}
          type={visible ? "text" : "password"}
          className={`${inputBase} ${visible ? "" : "tracking-[0.18em]"} ${className}`}
          aria-invalid={!!error}
          aria-describedby={error ? `${inputId}-error` : undefined}
          {...props}
        />
      </FieldFrame>
    );
  },
);
