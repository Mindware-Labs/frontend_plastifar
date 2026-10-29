import { AlertCircle, ChevronRight, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useDisclosureMotion } from "../../hooks/useDisclosureMotion";
import type { ValidationItem } from "../../lib/validationItems";
import { Button, type ButtonTone } from "../ui/Button";

export interface SubmitValidationButtonProps {
  ready: boolean;
  busy?: boolean;
  missingItems: ValidationItem[];
  children: ReactNode;
  /** Si se indica, `requestSubmit()` al estar listo. */
  formId?: string;
  onSubmit?: () => void;
  onFocusField?: (fieldId: string) => void;
  size?: "sm" | "md";
  variant?: "primary" | "secondary" | "danger" | "ghost";
  tone?: ButtonTone;
  toneLabel?: ReactNode;
  blockTitle?: string;
  hintText?: string;
  /** Atajo mostrado abajo del popover; `null` lo oculta. */
  shortcutLabel?: string | null;
  className?: string;
  /** Estilo bandeja (mayúsculas, rojo envío). */
  appearance?: "modal" | "send";
  sendIcon?: ReactNode;
  sendLabel?: string;
}

export function SubmitValidationButton({
  ready,
  busy = false,
  missingItems,
  children,
  formId,
  onSubmit,
  onFocusField,
  size = "sm",
  variant = "primary",
  tone = "primary",
  toneLabel,
  blockTitle = "No se puede guardar",
  hintText = "Para continuar, completa los siguientes requisitos:",
  shortcutLabel = "Ctrl + ↵",
  className = "",
  appearance = "modal",
  sendIcon,
  sendLabel,
}: SubmitValidationButtonProps) {
  const [hovered, setHovered] = useState(false);
  const closeTimerRef = useRef<number | null>(null);

  const handleOpen = useCallback(() => {
    if (closeTimerRef.current !== null) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
    if (!ready && !busy && missingItems.length > 0) setHovered(true);
  }, [ready, busy, missingItems.length]);

  const handleClose = useCallback(() => {
    if (closeTimerRef.current !== null) window.clearTimeout(closeTimerRef.current);
    closeTimerRef.current = window.setTimeout(() => {
      setHovered(false);
      closeTimerRef.current = null;
    }, 120);
  }, []);

  useEffect(() => {
    return () => {
      if (closeTimerRef.current !== null) window.clearTimeout(closeTimerRef.current);
    };
  }, []);

  function commit() {
    if (busy || !ready) return;
    if (formId) {
      const form = document.getElementById(formId);
      if (form instanceof HTMLFormElement) form.requestSubmit();
      return;
    }
    onSubmit?.();
  }

  const showPopover = hovered && !ready && !busy && missingItems.length > 0;
  const { mounted, exiting, ref: popoverRef } = useDisclosureMotion<HTMLDivElement>(showPopover, {
    direction: "up",
  });

  const trigger =
    appearance === "send" ? (
      <button
        type="button"
        onClick={(event) => {
          event.preventDefault();
          commit();
        }}
        disabled={busy}
        aria-disabled={!ready}
        className={`inline-flex items-center justify-center gap-2 rounded-lg font-heading
          font-semibold uppercase tracking-wider outline-none transition-all
          focus-visible:ring-2 focus-visible:ring-brand-red/30
          h-8 px-3 text-[11.5px]
          ${
            busy
              ? "cursor-wait bg-brand-red/70 text-white opacity-80"
              : ready
                ? "cursor-pointer bg-brand-red text-white shadow-2xs hover:bg-brand-red-dark active:scale-[0.98]"
                : "cursor-not-allowed bg-brand-red/40 text-white/90 shadow-none"
          } ${className}`}
      >
        {busy ? (
          <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
        ) : (
          sendIcon
        )}
        <span>{sendLabel ?? children}</span>
      </button>
    ) : (
      <Button
        type="button"
        size={size}
        variant={variant}
        tone={tone}
        toneLabel={toneLabel}
        isLoading={busy}
        aria-disabled={!ready}
        onClick={(event) => {
          event.preventDefault();
          commit();
        }}
        className={`${!ready && !busy ? "opacity-50" : ""} ${className}`}
      >
        {children}
      </Button>
    );

  return (
    <div
      className="relative inline-flex items-center"
      onMouseEnter={handleOpen}
      onMouseLeave={handleClose}
      onFocusCapture={handleOpen}
      onBlurCapture={handleClose}
    >
      {trigger}

      {mounted && (
        <div
          ref={popoverRef}
          role="tooltip"
          aria-hidden={exiting}
          style={{ transformOrigin: "calc(100% - 33px) bottom" }}
          className={`absolute bottom-full right-0 z-[90] mb-2.5 w-72 rounded-lg border border-zinc-200/90
            bg-white p-3 shadow-[0_10px_28px_-6px_rgba(24,24,27,0.18),0_4px_12px_-2px_rgba(24,24,27,0.08)]
            ${exiting ? "pointer-events-none" : ""}`}
          onMouseEnter={handleOpen}
          onMouseLeave={handleClose}
        >
          <div data-motion-item className="flex items-center justify-between gap-2 border-b border-zinc-100 pb-2">
            <div className="flex items-center gap-1.5">
              <span className="flex size-4.5 items-center justify-center rounded-full bg-brand-red/10 text-brand-red">
                <AlertCircle className="size-3 text-brand-red" />
              </span>
              <span className="font-heading text-[10.5px] font-bold uppercase tracking-wider text-zinc-900">
                {blockTitle}
              </span>
            </div>
            <span className="rounded-md bg-brand-red/10 px-1.5 py-0.5 font-heading text-[9.5px] font-bold tabular-nums text-brand-red">
              {missingItems.length} {missingItems.length === 1 ? "pendiente" : "pendientes"}
            </span>
          </div>

          <p data-motion-item className="mt-2 text-[11px] leading-snug text-zinc-500">
            {hintText}
          </p>

          <div className="mt-2 space-y-1.5">
            {missingItems.map((item) => (
              <button
                key={item.id}
                data-motion-item
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  onFocusField?.(item.id);
                  setHovered(false);
                }}
                title={onFocusField ? "Ir al campo" : undefined}
                className={`group flex w-full items-center gap-2 rounded-lg border border-zinc-200/80 bg-zinc-50/70
                  px-2.5 py-1.5 text-left text-[11.5px] shadow-2xs transition-all
                  ${onFocusField ? "cursor-pointer hover:border-brand-red/35 hover:bg-white" : "cursor-default"}`}
              >
                <span className="flex size-3.5 shrink-0 items-center justify-center rounded-full bg-brand-red/10 text-brand-red">
                  <X className="size-2.5 stroke-[2.5]" />
                </span>
                <span className="min-w-0 flex-1 truncate font-medium text-zinc-800 transition-colors group-hover:text-brand-red">
                  {item.label}
                </span>
                {onFocusField ? (
                  <ChevronRight className="size-3 shrink-0 text-zinc-400 opacity-0 transition-opacity group-hover:opacity-100" />
                ) : null}
              </button>
            ))}
          </div>

          {shortcutLabel ? (
            <div className="mt-2.5 flex items-center justify-between border-t border-zinc-100 pt-2 text-[10px] text-zinc-400">
              <span>Atajo de teclado</span>
              <span className="rounded-md border border-zinc-200 bg-zinc-50 px-1.5 py-0.5 font-mono text-[9.5px] font-semibold text-zinc-600 shadow-2xs">
                {shortcutLabel}
              </span>
            </div>
          ) : null}

          <div
            aria-hidden
            className="absolute -bottom-1.5 right-7 size-2.5 rotate-45 border-b border-r border-zinc-200/90 bg-white"
          />
        </div>
      )}
    </div>
  );
}
