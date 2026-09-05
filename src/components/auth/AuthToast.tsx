import { useEffect, useRef } from "react";
import { CircleAlert, ShieldCheck, X } from "lucide-react";
import { createPortal } from "react-dom";

interface AuthToastProps {
  message: string | null;
  onDismiss: () => void;
  variant?: "error" | "success";
  /** Milisegundos antes de autodescartarse. */
  duration?: number;
}

const DEFAULT_DURATION = 5000;

/**
 * Aviso flotante para errores/éxitos de formulario: no empuja el layout (fixed,
 * fuera del flujo) ni bloquea la pantalla como un modal. Se autodescarta solo
 * tras `duration`, pero el usuario también puede cerrarlo antes con la X.
 *
 * Se monta en un portal sobre document.body: si quedara anidado dentro del
 * formulario, los ancestros con `animate-plf-rise` (transform animado) lo
 * volverían a anclar dentro de esa caja en vez del viewport.
 *
 * Flota sobre la página, así que toma `shadow-panel` —una de las tres
 * elevaciones del sistema— y no una sombra propia en otra familia de gris.
 */
export function AuthToast({
  message,
  onDismiss,
  variant = "error",
  duration = DEFAULT_DURATION,
}: AuthToastProps) {
  // onDismiss suele ser una flecha nueva en cada render: se lee por ref para que
  // el temporizador dependa solo del mensaje y no se reinicie sin motivo.
  const onDismissRef = useRef(onDismiss);
  useEffect(() => {
    onDismissRef.current = onDismiss;
  });

  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => onDismissRef.current(), duration);
    return () => clearTimeout(timer);
  }, [message, duration]);

  if (!message) return null;

  const isError = variant === "error";

  return createPortal(
    <div className="pointer-events-none fixed inset-x-0 top-5 z-50 flex justify-center px-5 sm:px-6">
      <div
        role={isError ? "alert" : "status"}
        className={`animate-plf-toast-in pointer-events-auto relative flex w-full max-w-[408px] items-start gap-3 overflow-hidden rounded-edge border bg-white py-3 pl-3 pr-[15px] text-[13px] font-medium leading-relaxed shadow-panel ${
          isError ? "border-brand-red/20 text-brand-red-dark" : "border-brand-green/20 text-brand-green"
        }`}
      >
        <span
          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
            isError ? "bg-brand-red/10" : "bg-brand-green/10"
          }`}
        >
          {isError ? (
            <CircleAlert className="h-4 w-4" aria-hidden />
          ) : (
            <ShieldCheck className="h-4 w-4" aria-hidden />
          )}
        </span>

        <span className="flex-1 pt-1">{message}</span>

        <button
          type="button"
          onClick={onDismiss}
          aria-label="Cerrar aviso"
          className="-m-2 shrink-0 rounded-full p-2 text-current opacity-50 transition-opacity hover:opacity-100"
        >
          <X className="h-3.5 w-3.5" />
        </button>

        <span
          key={message}
          aria-hidden
          style={{ animationDuration: `${duration}ms` }}
          className={`animate-plf-toast-progress absolute inset-x-0 bottom-0 h-[3px] origin-left ${
            isError ? "bg-brand-red/35" : "bg-brand-green/35"
          }`}
        />
      </div>
    </div>,
    document.body,
  );
}
