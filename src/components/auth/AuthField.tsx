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
 * Sin etiqueta visible: el nombre del campo viaja en el placeholder y en el
 * aria-label, y el icono de la izquierda lo identifica de un vistazo. Es lo que
 * permite que la columna quede en 408px sin apretarse. El icono se tine del
 * 185 C al enfocar —la unica senal de color del formulario en reposo—.
 */

const shellBase =
  "group relative flex h-12 cursor-text items-center gap-[11px] rounded-edge border bg-gradient-to-b from-white to-zinc-50/70 shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_1px_2px_rgba(15,23,42,0.04)] transition-[border-color,box-shadow,background-color] duration-200 ease-out";

const shellIdle =
  "border-line hover:border-zinc-300 hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_2px_6px_-1px_rgba(15,23,42,0.07)] focus-within:border-brand-red focus-within:bg-white focus-within:shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_0_0_4px_color-mix(in_srgb,var(--color-brand-red)_8%,transparent),0_6px_16px_-8px_color-mix(in_srgb,var(--color-brand-red)_35%,transparent)]";

const shellError =
  "border-brand-red bg-white shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_0_0_4px_color-mix(in_srgb,var(--color-brand-red)_8%,transparent),0_6px_16px_-8px_color-mix(in_srgb,var(--color-brand-red)_35%,transparent)]";

const inputBase =
  "h-full w-full min-w-0 bg-transparent p-0 text-[15px] font-medium tracking-[-0.01em] text-ink caret-brand-red outline-none placeholder:font-normal placeholder:tracking-normal placeholder:text-zinc-400";

interface FieldFrameProps {
  inputId: string;
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
  error,
  hint,
  action,
  icon,
  padded,
  children,
  trailing,
}: FieldFrameProps) {
  return (
    <div>
      {/* El <label> envuelve al input: pulsar en cualquier punto de la pieza lo enfoca */}
      <label
        htmlFor={inputId}
        className={`${shellBase} ${padded} ${error ? shellError : shellIdle}`}
      >
        <span
          className={`shrink-0 transition-[color,transform] duration-200 ${
            error
              ? "text-brand-red"
              : "text-zinc-400 group-focus-within:scale-[1.08] group-focus-within:text-brand-red"
          }`}
        >
          {icon}
        </span>

        {children}
        {trailing}
      </label>

      {error && (
        <p
          id={`${inputId}-error`}
          className="animate-plf-rise mt-2.5 flex items-center gap-1.5 text-[12.5px] font-medium text-brand-red"
        >
          <CircleAlert className="h-3.5 w-3.5 shrink-0" aria-hidden />
          {error}
        </p>
      )}

      {(hint || action) && (
        <div className="mt-2.5 flex min-h-[18px] items-center justify-between gap-4">
          {hint ? (
            <span className="animate-plf-rise text-[12.5px] text-zinc-500">{hint}</span>
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
  /** Nombre del campo: se usa como placeholder y como etiqueta accesible. */
  label: string;
  icon: ReactNode;
  error?: string;
  action?: ReactNode;
}

export const AuthField = forwardRef<HTMLInputElement, AuthFieldProps>(function AuthField(
  { label, icon, error, action, id, className = "", placeholder, ...props },
  ref,
) {
  const fallbackId = useId();
  const inputId = id ?? props.name ?? fallbackId;

  return (
    <FieldFrame inputId={inputId} error={error} action={action} icon={icon} padded="px-4">
      <input
        ref={ref}
        id={inputId}
        aria-label={label}
        placeholder={placeholder ?? label}
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
  action?: ReactNode;
}

export const AuthPasswordField = forwardRef<HTMLInputElement, AuthPasswordFieldProps>(
  function AuthPasswordField(
    { label, icon, error, action, id, className = "", placeholder, ...props },
    ref,
  ) {
    const [visible, setVisible] = useState(false);
    const [capsLock, setCapsLock] = useState(false);
    const fallbackId = useId();
    const inputId = id ?? props.name ?? fallbackId;

    // Bloq Mayus activo es la primera causa de un "credenciales incorrectas"
    // que no lo es: avisar antes de enviar ahorra el intento fallido.
    function trackCapsLock(event: KeyboardEvent<HTMLInputElement>) {
      setCapsLock(event.getModifierState?.("CapsLock") ?? false);
    }

    return (
      <FieldFrame
        inputId={inputId}
        error={error}
        hint={capsLock ? "Bloq Mayús está activado" : undefined}
        action={action}
        icon={icon}
        padded="pl-4 pr-2.5"
        trailing={
          <button
            type="button"
            onClick={() => setVisible((v) => !v)}
            tabIndex={-1}
            aria-label={visible ? "Ocultar contraseña" : "Mostrar contraseña"}
            className="flex h-[30px] w-[30px] shrink-0 cursor-pointer items-center justify-center rounded-full text-zinc-400 transition-all duration-150 hover:bg-zinc-100 hover:text-ink active:scale-90"
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
          aria-label={label}
          placeholder={placeholder ?? label}
          className={`${inputBase} ${visible ? "" : "tracking-[0.18em]"} ${className}`}
          aria-invalid={!!error}
          aria-describedby={error ? `${inputId}-error` : undefined}
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
