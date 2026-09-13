import { useEffect, useRef } from "react";
import { CircleAlert, Info, ShieldCheck, X } from "lucide-react";
import { createPortal } from "react-dom";

export interface ToastProps {
  message: string | null;
  onDismiss: () => void;
  variant?: "error" | "success" | "info";
  /** Milisegundos antes de autodescartarse (por defecto 5000ms). */
  duration?: number;
}

const DEFAULT_DURATION = 5000;

/** Notificación flotante montada en portal para avisos del sistema. */
export function Toast({
  message,
  onDismiss,
  variant = "error",
  duration = DEFAULT_DURATION,
}: ToastProps) {
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
  const isSuccess = variant === "success";

  return createPortal(
    <div className="pointer-events-none fixed inset-x-0 top-5 z-[100] flex justify-center px-5 sm:px-6">
      <div
        role={isError ? "alert" : "status"}
        className={`animate-plf-toast-in pointer-events-auto relative flex w-full max-w-[420px] items-start gap-3 overflow-hidden rounded-xl border bg-white py-3 pl-3.5 pr-4 text-[13px] font-medium leading-relaxed shadow-[0_4px_16px_-2px_rgba(15,23,42,0.12),0_16px_36px_-12px_rgba(15,23,42,0.28)] ${
          isError
            ? "border-red-200 text-red-800"
            : isSuccess
              ? "border-emerald-200 text-emerald-900"
              : "border-sky-200 text-sky-950"
        }`}
      >
        <span
          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
            isError
              ? "bg-red-50 text-brand-red"
              : isSuccess
                ? "bg-emerald-50 text-emerald-600"
                : "bg-sky-50 text-sky-600"
          }`}
        >
          {isError ? (
            <CircleAlert className="h-4 w-4" aria-hidden />
          ) : isSuccess ? (
            <ShieldCheck className="h-4 w-4" aria-hidden />
          ) : (
            <Info className="h-4 w-4" aria-hidden />
          )}
        </span>

        <span className="flex-1 pt-0.5">{message}</span>

        <button
          type="button"
          onClick={onDismiss}
          aria-label="Cerrar aviso"
          className="-mr-1.5 -mt-0.5 shrink-0 rounded-full p-1.5 text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition-colors cursor-pointer"
        >
          <X className="h-3.5 w-3.5" />
        </button>

        <span
          key={message}
          aria-hidden
          style={{ animationDuration: `${duration}ms` }}
          className={`animate-plf-toast-progress absolute inset-x-0 bottom-0 hidden h-[3px] origin-left motion-safe:block ${
            isError
              ? "bg-brand-red/40"
              : isSuccess
                ? "bg-emerald-600/40"
                : "bg-sky-500/40"
          }`}
        />
      </div>
    </div>,
    document.body,
  );
}
