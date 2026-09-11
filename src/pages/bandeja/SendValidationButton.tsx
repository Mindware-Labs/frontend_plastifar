import { AlertCircle, ChevronRight, Send, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useDisclosureMotion } from "../../hooks/useDisclosureMotion";
import { type ValidationItem } from "./sendValidation";

interface SendValidationButtonProps {
  /** Indica si todos los campos requeridos fueron completados. */
  ready: boolean;
  /** En proceso de envío al servidor. */
  sending?: boolean;
  /** Lista de validaciones o campos que faltan por completar. */
  missingItems: ValidationItem[];
  /** Acción a ejecutar al hacer clic estando listo. */
  onSend: () => void;
  /** Enfocar el campo correspondiente al hacer clic en un ítem pendiente. */
  onFocusField?: (fieldId: string) => void;
  /** Texto del botón. Por defecto "Enviar". */
  label?: string;
  /** Ícono personalizado. Por defecto <Send className="h-[15px] w-[15px]" />. */
  icon?: ReactNode;
  /** Tamaño del botón. */
  size?: "sm" | "md";
  className?: string;
}

const sizeClasses = {
  sm: "h-8 px-3 text-[11.5px]",
  md: "h-8 px-3.5 text-[12px]",
};

export function SendValidationButton({
  ready,
  sending = false,
  missingItems,
  onSend,
  onFocusField,
  label = "Enviar",
  icon = <Send className="h-[14px] w-[14px]" />,
  size = "sm",
  className = "",
}: SendValidationButtonProps) {
  const [isHovered, setIsHovered] = useState(false);
  const closeTimerRef = useRef<number | null>(null);

  const handleOpen = useCallback(() => {
    if (closeTimerRef.current !== null) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
    if (!ready && !sending && missingItems.length > 0) {
      setIsHovered(true);
    }
  }, [ready, sending, missingItems.length]);

  const handleClose = useCallback(() => {
    if (closeTimerRef.current !== null) {
      window.clearTimeout(closeTimerRef.current);
    }
    // Breve lapso para permitir transicionar el puntero entre el botón y el popover sin parpadeos
    closeTimerRef.current = window.setTimeout(() => {
      setIsHovered(false);
      closeTimerRef.current = null;
    }, 120);
  }, []);

  useEffect(() => {
    return () => {
      if (closeTimerRef.current !== null) window.clearTimeout(closeTimerRef.current);
    };
  }, []);

  function handleClick(event: React.MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    if (sending || !ready) return;
    onSend();
  }

  const showTooltip = isHovered && !ready && !sending && missingItems.length > 0;
  const { mounted, exiting, ref: tooltipRef } = useDisclosureMotion<HTMLDivElement>(showTooltip, { direction: "up" });

  return (
    <div
      className="relative inline-flex items-center"
      onMouseEnter={handleOpen}
      onMouseLeave={handleClose}
      onFocusCapture={handleOpen}
      onBlurCapture={handleClose}
    >
      <button
        type="button"
        onClick={handleClick}
        disabled={sending}
        aria-disabled={!ready}
        className={`inline-flex items-center justify-center gap-2 rounded-lg font-heading
          font-semibold uppercase tracking-wider outline-none
          transition-all focus-visible:ring-2 focus-visible:ring-brand-red/30
          ${sizeClasses[size]}
          ${
            sending
              ? "cursor-wait bg-brand-red/70 text-white opacity-80"
              : ready
              ? "bg-brand-red text-white shadow-2xs hover:bg-brand-red-dark active:scale-[0.98] cursor-pointer"
              : "cursor-not-allowed bg-brand-red/40 text-white/90 shadow-none"
          }
          ${className}`}
      >
        {sending ? (
          <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
        ) : (
          icon
        )}
        <span>{label}</span>
      </button>

      {mounted && (
        <div
          ref={tooltipRef}
          role="tooltip"
          aria-hidden={exiting}
          style={{ transformOrigin: "calc(100% - 33px) bottom" }}
          className={`absolute bottom-full right-0 z-40 mb-2.5 w-72 rounded-lg
            border border-zinc-200/90 bg-white p-3 shadow-[0_10px_28px_-6px_rgba(24,24,27,0.18),0_4px_12px_-2px_rgba(24,24,27,0.08)] ${
              exiting ? "pointer-events-none" : ""
            }`}
          onMouseEnter={handleOpen}
          onMouseLeave={handleClose}
        >
          {/* Cabecera con alerta y contador */}
          <div data-motion-item className="flex items-center justify-between gap-2 border-b border-zinc-100 pb-2">
            <div className="flex items-center gap-1.5">
              <span className="flex size-4.5 items-center justify-center rounded-full bg-brand-red/10 text-brand-red">
                <AlertCircle className="size-3 text-brand-red" />
              </span>
              <span className="font-heading text-[10.5px] font-bold uppercase tracking-wider text-zinc-900">
                No se puede enviar
              </span>
            </div>
            <span className="rounded-md bg-brand-red/10 px-1.5 py-0.5 font-heading text-[9.5px] font-bold tabular-nums text-brand-red">
              {missingItems.length} {missingItems.length === 1 ? "pendiente" : "pendientes"}
            </span>
          </div>

          {/* Texto explicativo */}
          <p data-motion-item className="mt-2 text-[11px] leading-snug text-zinc-500">
            Para poder enviar el correo, completa los siguientes requisitos:
          </p>

          {/* Lista de requisitos pendientes */}
          <div className="mt-2 space-y-1.5">
            {missingItems.map((item) => (
              <button
                key={item.id}
                data-motion-item
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onFocusField?.(item.id);
                  setIsHovered(false);
                }}
                title={onFocusField ? "Hacer clic para completar este campo" : undefined}
                className={`group flex w-full items-center gap-2 rounded-lg border border-zinc-200/80 bg-zinc-50/70
                  px-2.5 py-1.5 text-left text-[11.5px] transition-all shadow-2xs
                  ${
                    onFocusField
                      ? "cursor-pointer hover:border-brand-red/35 hover:bg-white"
                      : "cursor-default"
                  }`}
              >
                <span className="flex size-3.5 shrink-0 items-center justify-center rounded-full bg-brand-red/10 text-brand-red">
                  <X className="size-2.5 stroke-[2.5]" />
                </span>
                <span className="min-w-0 flex-1 truncate font-medium text-zinc-800 transition-colors group-hover:text-brand-red">
                  {item.label}
                </span>
                {onFocusField && (
                  <ChevronRight className="size-3 shrink-0 text-zinc-400 opacity-0 transition-opacity group-hover:opacity-100" />
                )}
              </button>
            ))}
          </div>

          {/* Pie informativo */}
          <div className="mt-2.5 flex items-center justify-between border-t border-zinc-100 pt-2 text-[10px] text-zinc-400">
            <span>Atajo de teclado</span>
            <span className="rounded-md border border-zinc-200 bg-zinc-50 px-1.5 py-0.5 font-mono text-[9.5px] font-semibold text-zinc-600 shadow-2xs">
              Ctrl + ↵
            </span>
          </div>

          {/* Flecha indicadora apuntando hacia el botón Enviar */}
          <div
            aria-hidden
            className="absolute -bottom-1.5 right-7 size-2.5 rotate-45 border-b border-r border-zinc-200/90 bg-white"
          />
        </div>
      )}
    </div>
  );
}
