import { CircleAlert, Eye, EyeOff } from "lucide-react";
import {
  forwardRef,
  useId,
  useState,
  type InputHTMLAttributes,
  type KeyboardEvent,
  type ReactNode,
} from "react";

/**
 * Campo de formulario del area de autenticacion.
 *
 * Etiqueta visible encima del control, en la misma gramatica que `ui/Field`:
 * Montserrat versalita de 10.5px en `faint`. Antes el nombre del campo viajaba
 * solo en el placeholder, asi que desaparecia en cuanto la persona escribia —y
 * con el, la unica pista de que llevaba ese hueco (WCAG 3.3.2). El icono de la
 * izquierda sigue identificandolo de un vistazo y se tine del 185 C al enfocar.
 */

const shellBase =
  "group relative flex h-12 cursor-text items-center gap-[11px] rounded-edge border bg-gradient-to-b from-white to-canvas/70 shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_1px_2px_rgba(27,27,29,0.04)] transition-[border-color,box-shadow,background-color] duration-200 ease-out";

const shellIdle =
  "border-line hover:border-hairline-hover hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_2px_6px_-1px_rgba(27,27,29,0.07)] focus-within:border-brand-red focus-within:bg-white focus-within:shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_0_0_4px_color-mix(in_srgb,var(--color-brand-red)_8%,transparent),0_6px_16px_-8px_color-mix(in_srgb,var(--color-brand-red)_35%,transparent)]";

const shellError =
  "border-brand-red bg-white shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_0_0_4px_color-mix(in_srgb,var(--color-brand-red)_8%,transparent),0_6px_16px_-8px_color-mix(in_srgb,var(--color-brand-red)_35%,transparent)]";

const inputBase =
  // 13.5px es el tamano de control del panel. Antes era 15px, un paso que no
  // existe en la rampa: el area de acceso es mas espaciosa por sus alturas y su
  // aire, no por tener su propia tipografia.
  "h-full w-full min-w-0 bg-transparent p-0 text-[13.5px] font-medium tracking-[-0.01em] text-ink caret-brand-red outline-none placeholder:font-normal placeholder:tracking-normal placeholder:text-faint";

/** Ids de los textos que describen al campo, en el mismo orden en que se leen. */
function describedBy(inputId: string, error?: string, hint?: string) {
  const ids = [error && `${inputId}-error`, hint && `${inputId}-hint`].filter(Boolean);
  return ids.length > 0 ? ids.join(" ") : undefined;
}

interface FieldFrameProps {
  inputId: string;
  label: string;
  error?: string;
  /** Aviso neutro bajo el campo (p. ej. Bloq Mayus). No es un error. */
  hint?: string;
  /** Enlace o accion alineada a la derecha, bajo el campo. */
  action?: ReactNode;
  icon: ReactNode;
  padded: string;
  children: ReactNode;
  trailing?: ReactNode;
}

function FieldFrame({
  inputId,
  label,
  error,
  hint,
  action,
  icon,
  padded,
  children,
  trailing,
}: FieldFrameProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <label
        htmlFor={inputId}
        className="font-heading text-[10.5px] font-semibold uppercase tracking-[0.08em] text-faint"
      >
        {label}
      </label>

      {/* La pieza ya no es un <label>: con la etiqueta visible encima, un
          segundo <label> para el mismo input duplicaria el nombre accesible.
          El click en el marco enfoca el campo a mano, salvo si cae sobre un
          control propio (el ojo de mostrar contrasena). */}
      <div
        onMouseDown={(event) => {
          if ((event.target as HTMLElement).closest("button, input")) return;
          event.preventDefault();
          document.getElementById(inputId)?.focus();
        }}
        className={`${shellBase} ${padded} ${error ? shellError : shellIdle}`}
      >
        <span
          className={`shrink-0 transition-colors duration-200 ${
            error ? "text-brand-red" : "text-muted group-focus-within:text-brand-red"
          }`}
        >
          {icon}
        </span>

        {children}
        {trailing}
      </div>

      {error && (
        <p
          id={`${inputId}-error`}
          className="animate-plf-rise mt-1 flex items-center gap-1.5 text-[12.5px] font-medium text-brand-red"
        >
          <CircleAlert className="h-3.5 w-3.5 shrink-0" aria-hidden />
          {error}
        </p>
      )}

      {(hint || action) && (
        <div className="mt-1 flex min-h-[18px] items-center justify-between gap-4">
          {hint ? (
            <span id={`${inputId}-hint`} className="animate-plf-rise text-[12.5px] text-muted">
              {hint}
            </span>
          ) : (
            <span />
          )}
          {action}
        </div>
      )}
    </div>
  );
}

interface AuthFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  /** Nombre del campo: etiqueta visible y nombre accesible del control. */
  label: string;
  icon: ReactNode;
  error?: string;
  action?: ReactNode;
}

export const AuthField = forwardRef<HTMLInputElement, AuthFieldProps>(function AuthField(
  { label, icon, error, action, id, className = "", ...props },
  ref,
) {
  const fallbackId = useId();
  const inputId = id ?? props.name ?? fallbackId;

  return (
    <FieldFrame inputId={inputId} label={label} error={error} action={action} icon={icon} padded="px-4">
      <input
        ref={ref}
        id={inputId}
        className={`${inputBase} ${className}`}
        aria-invalid={!!error}
        aria-describedby={describedBy(inputId, error)}
        {...props}
      />
    </FieldFrame>
  );
});

interface AuthPasswordFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  label: string;
  icon: ReactNode;
  error?: string;
  action?: ReactNode;
}

export const AuthPasswordField = forwardRef<HTMLInputElement, AuthPasswordFieldProps>(
  function AuthPasswordField({ label, icon, error, action, id, className = "", ...props }, ref) {
    const [visible, setVisible] = useState(false);
    const [capsLock, setCapsLock] = useState(false);
    const fallbackId = useId();
    const inputId = id ?? props.name ?? fallbackId;

    // Bloq Mayus activo es la primera causa de un "credenciales incorrectas"
    // que no lo es: avisar antes de enviar ahorra el intento fallido.
    function trackCapsLock(event: KeyboardEvent<HTMLInputElement>) {
      setCapsLock(event.getModifierState?.("CapsLock") ?? false);
    }

    const hint = capsLock ? "Bloq Mayús está activado" : undefined;

    return (
      <FieldFrame
        inputId={inputId}
        label={label}
        error={error}
        hint={hint}
        action={action}
        icon={icon}
        padded="pl-4 pr-2.5"
        trailing={
          <button
            type="button"
            onClick={() => setVisible((v) => !v)}
            tabIndex={-1}
            aria-label={visible ? "Ocultar contraseña" : "Mostrar contraseña"}
            className="flex h-[30px] w-[30px] shrink-0 cursor-pointer items-center justify-center rounded-full text-muted transition-colors duration-150 hover:bg-fill hover:text-ink"
          >
            {visible ? (
              <EyeOff className="h-[17px] w-[17px]" />
            ) : (
              <Eye className="h-[17px] w-[17px]" />
            )}
          </button>
        }
      >
        <input
          ref={ref}
          id={inputId}
          type={visible ? "text" : "password"}
          className={`${inputBase} ${visible ? "" : "tracking-[0.18em]"} ${className}`}
          aria-invalid={!!error}
          // El aviso de Bloq Mayus entra aqui tambien: sin referenciarlo, el
          // grupo de personas que mas lo necesita nunca se entera de que existe.
          aria-describedby={describedBy(inputId, error, hint)}
          {...props}
          onKeyDown={(event) => {
            trackCapsLock(event);
            props.onKeyDown?.(event);
          }}
          onKeyUp={(event) => {
            trackCapsLock(event);
            props.onKeyUp?.(event);
          }}
          onBlur={(event) => {
            setCapsLock(false);
            props.onBlur?.(event);
          }}
        />
      </FieldFrame>
    );
  },
);
