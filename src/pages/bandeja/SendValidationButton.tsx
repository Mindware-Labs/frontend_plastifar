import { AlertCircle, ChevronRight, Send, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
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
  sm: "h-7 px-3 text-[11px]",
  md: "h-8 px-3.5 text-[11.5px]",
};

export function SendValidationButton({
  ready,
  sending = false,
  missingItems,
  onSend,
  onFocusField,
  label = "Enviar",
  icon = <Send className="h-[15px] w-[15px]" />,
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
        className={`inline-flex items-center justify-center gap-2 rounded-edge font-heading
          font-semibold uppercase tracking-[0.06em] outline-none
          transition-[background-color,border-color,color,box-shadow,transform]
          focus-visible:ring-3 focus-visible:ring-brand-red/25
          ${sizeClasses[size]}
          ${
            sending
              ? "cursor-wait bg-brand-red/70 text-white opacity-80"
              : ready
              ? "bg-brand-red text-white shadow-[0_10px_20px_-12px_rgba(228,0,43,0.55)] hover:bg-brand-red-dark hover:shadow-[0_14px_24px_-10px_rgba(228,0,43,0.7)] active:translate-y-px active:bg-brand-red-dark active:shadow-[0_6px_12px_-9px_rgba(228,0,43,0.6)]"
              : "cursor-not-allowed bg-brand-red/50 text-white/90 shadow-none hover:bg-brand-red/60"
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

      {showTooltip && (
        <div
          role="tooltip"
          className="animate-plf-popover-in absolute bottom-full right-0 z-40 mb-2.5 w-72 rounded-edge
            border border-line-strong bg-white p-3 shadow-[0_8px_30px_-6px_rgba(27,27,29,0.2),0_2px_8px_-2px_rgba(27,27,29,0.08)]"
          onMouseEnter={handleOpen}
          onMouseLeave={handleClose}
        >
          {/* Cabecera con alerta y contador */}
          <div className="flex items-center justify-between gap-2 border-b border-line pb-2">
            <div className="flex items-center gap-1.5">
              <span className="flex size-4.5 items-center justify-center rounded-full bg-brand-red/10 text-brand-red">
                <AlertCircle className="size-3 text-brand-red" />
              </span>
              <span className="font-heading text-[10.5px] font-bold uppercase tracking-[0.08em] text-ink">
                No se puede enviar
              </span>
            </div>
            <span className="rounded-edge bg-brand-red/[0.08] px-1.5 py-0.5 font-heading text-[9.5px] font-semibold tabular-nums text-brand-red">
              {missingItems.length} {missingItems.length === 1 ? "pendiente" : "pendientes"}
            </span>
          </div>

          {/* Texto explicativo */}
          <p className="mt-2 text-[11px] leading-snug text-brand-gray">
            Para poder enviar el correo, completa los siguientes requisitos:
          </p>

          {/* Lista de requisitos pendientes */}
          <div className="mt-2 space-y-1.5">
            {missingItems.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onFocusField?.(item.id);
                  setIsHovered(false);
                }}
                title={onFocusField ? "Hacer clic para completar este campo" : undefined}
                className={`group flex w-full items-center gap-2 rounded-edge border border-line-soft bg-canvas/70
                  px-2 py-1.5 text-left text-[11.5px] transition-all
                  ${
                    onFocusField
                      ? "cursor-pointer hover:border-brand-red/35 hover:bg-white hover:shadow-xs"
                      : "cursor-default"
                  }`}
              >
                <span className="flex size-3.5 shrink-0 items-center justify-center rounded-full bg-brand-red/15 text-brand-red">
                  <X className="size-2.5 stroke-[2.5]" />
                </span>
                <span className="min-w-0 flex-1 truncate font-medium text-ink transition-colors group-hover:text-brand-red-dark">
                  {item.label}
                </span>
                {onFocusField && (
                  <ChevronRight className="size-3 shrink-0 text-faint opacity-0 transition-opacity group-hover:opacity-100" />
                )}
              </button>
            ))}
          </div>

          {/* Pie informativo */}
          <div className="mt-2.5 flex items-center justify-between border-t border-line pt-2 text-[10px] text-faint">
            <span>Atajo de teclado</span>
            <span className="rounded-edge border border-line bg-fill px-1 py-0.5 font-mono text-[9.5px] font-semibold text-brand-gray">
              Ctrl + ↵
            </span>
          </div>

          {/* Flecha indicadora apuntando hacia el botón Enviar */}
          <div
            aria-hidden
            className="absolute -bottom-1.5 right-7 size-2.5 rotate-45 border-b border-r border-line-strong bg-white"
          />
        </div>
      )}
    </div>
  );
}
