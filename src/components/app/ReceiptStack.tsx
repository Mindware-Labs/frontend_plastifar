import { Check, CircleAlert, RotateCcw, Undo2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useReceipts } from "../../context/useReceipts";
import type { Receipt } from "../../context/useReceipts";

/** Con algo que revertir hace falta leer, decidir y llegar al botón; sin eso, basta con enterarse. */
const WITH_ACTION = 7000;
const PLAIN = 4500;

/** Respaldo del desmontaje tras la animación de salida Apple (280ms). */
const EXIT_FALLBACK = 290;

/** Un solo latido baja la cifra y encoge la barra: así no pueden desincronizarse. */
const TICK = 150;

const shellBaseClass =
  "group pointer-events-auto relative flex w-fit max-w-full items-center gap-3 overflow-hidden rounded-xl border bg-white/98 " +
  "px-3 py-2.5 backdrop-blur-md transition-shadow duration-200 " +
  "shadow-[0_2px_6px_-1px_rgba(24,24,27,0.06),0_14px_32px_-10px_rgba(24,24,27,0.16),inset_0_1px_0_rgba(255,255,255,0.9)]";

export function ReceiptCard({
  receipt,
  onDismiss,
  staticPreview = false,
}: {
  receipt: Receipt;
  onDismiss: () => void;
  /** Cuando es true (en la vista de laboratorio), no corre el temporizador de cierre automático. */
  staticPreview?: boolean;
}) {
  const { failed: reportFailure } = useReceipts();
  const [leaving, setLeaving] = useState(false);
  const [busy, setBusy] = useState(false);
  const timer = useRef<number | null>(null);
  const tick = useRef<number | null>(null);
  const left = useRef(receipt.action2 ? WITH_ACTION : PLAIN);
  const startedAt = useRef(0);

  const failed = receipt.kind === "failed";
  const duration = receipt.action2 ? WITH_ACTION : PLAIN;

  const [remaining, setRemaining] = useState(staticPreview ? Math.round(duration * 0.72) : duration);
  const seconds = Math.max(0, Math.ceil(remaining / 1000));
  const ratio = Math.max(0, Math.min(1, remaining / duration));

  useEffect(() => {
    if (failed || staticPreview) return;

    left.current = duration;
    // oxlint-disable-next-line react/set-state-in-effect
    setRemaining(duration);

    startedAt.current = performance.now();
    timer.current = window.setTimeout(() => setLeaving(true), left.current);
    tick.current = window.setInterval(() => {
      setRemaining(Math.max(0, left.current - (performance.now() - startedAt.current)));
    }, TICK);

    return () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
      if (tick.current !== null) window.clearInterval(tick.current);
    };
  }, [failed, duration, receipt.count, staticPreview]);

  function hold() {
    if (failed || staticPreview || timer.current === null) return;

    window.clearTimeout(timer.current);
    timer.current = null;

    if (tick.current !== null) {
      window.clearInterval(tick.current);
      tick.current = null;
    }

    left.current = Math.max(400, left.current - (performance.now() - startedAt.current));
    setRemaining(left.current);
  }

  function resume() {
    if (failed || staticPreview || timer.current !== null || leaving) return;

    startedAt.current = performance.now();
    timer.current = window.setTimeout(() => setLeaving(true), left.current);
    tick.current = window.setInterval(() => {
      setRemaining(Math.max(0, left.current - (performance.now() - startedAt.current)));
    }, TICK);
  }

  useEffect(() => {
    if (!leaving || staticPreview) return;
    const fallback = window.setTimeout(onDismiss, EXIT_FALLBACK);
    return () => window.clearTimeout(fallback);
  }, [leaving, onDismiss, staticPreview]);

  async function runAction() {
    if (!receipt.action2 || busy) return;
    setBusy(true);
    try {
      await receipt.action2.run();
      if (!staticPreview) setLeaving(true);
    } catch (err) {
      reportFailure({
        action: receipt.action,
        title: `No se pudo ${receipt.action2.label.toLowerCase()}`,
        detail: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setBusy(false);
    }
  }

  const detail = receipt.detail?.trim();
  const isShortTitle = receipt.title.length <= 75;
  const isShortDetail = Boolean(detail && detail.length <= 75);

  return (
    <div
      role={failed ? "alert" : "status"}
      onAnimationEnd={(event) => {
        if (!staticPreview && event.animationName === "plf-receipt-out") onDismiss();
      }}
      onMouseEnter={hold}
      onMouseLeave={resume}
      onFocusCapture={hold}
      onBlurCapture={resume}
      className={`${shellBaseClass} border-zinc-200/90 ${
        staticPreview ? "" : leaving ? "animate-plf-receipt-out" : "animate-plf-receipt-in"
      }`}
    >
      {/* 1. Sello icónico simétrico (32×32px) */}
      <span
        key={receipt.count}
        aria-hidden
        className={`flex size-8 shrink-0 items-center justify-center rounded-lg border shadow-2xs ${
          staticPreview ? "" : "animate-plf-seal-pop"
        } ${
          failed
            ? "border-brand-red/20 bg-brand-red/[0.08] text-brand-red"
            : "border-emerald-200/80 bg-emerald-50 text-emerald-600"
        }`}
      >
        {failed ? (
          <CircleAlert className="size-4" strokeWidth={2.25} />
        ) : (
          <Check className="size-4" strokeWidth={2.75} />
        )}
      </span>

      {/* 2. Bloque tipográfico central (en una sola línea cuando el texto es corto) */}
      <div className="flex min-h-[32px] min-w-0 flex-1 flex-col justify-center pr-1">
        <div className="flex items-center gap-1.5">
          <p
            className={`font-heading text-[12.5px] font-semibold leading-snug tracking-[-0.01em] text-zinc-900 ${
              isShortTitle ? "whitespace-nowrap" : "break-words"
            }`}
          >
            {receipt.title}
          </p>
          {receipt.count > 1 && (
            <span className="inline-flex h-4 shrink-0 items-center justify-center rounded-full border border-zinc-200/90 bg-zinc-100 px-1.5 font-heading text-[10px] font-bold leading-none tabular-nums text-zinc-700">
              ×{receipt.count}
            </span>
          )}
        </div>

        {detail && (
          <p
            className={`mt-0.5 text-[11.5px] font-normal leading-snug text-zinc-500 ${
              isShortDetail ? "whitespace-nowrap" : "break-words"
            }`}
          >
            {detail}
          </p>
        )}

        {receipt.action2 && !failed && (
          <span className="sr-only">
            Puedes deshacerlo durante los próximos {Math.ceil(duration / 1000)} segundos.
          </span>
        )}
      </div>

      {/* 3. Controles simétricos a la derecha (Acción + divisor + Cerrar) */}
      <div className="flex shrink-0 items-center gap-1.5">
        {receipt.action2 && (
          <>
            <button
              type="button"
              onClick={runAction}
              disabled={busy}
              className={`inline-flex h-7 shrink-0 items-center gap-1.5 rounded-lg border px-2.5 font-heading text-[11px] font-semibold leading-none shadow-2xs outline-none transition-all active:scale-[0.97] disabled:opacity-50 ${
                failed
                  ? "border-brand-red/25 bg-brand-red/[0.06] text-brand-red hover:border-brand-red/35 hover:bg-brand-red/12 focus-visible:ring-2 focus-visible:ring-brand-red/25"
                  : "border-zinc-200/90 bg-zinc-50/90 text-zinc-800 hover:border-zinc-300 hover:bg-zinc-100 hover:text-zinc-950 focus-visible:ring-2 focus-visible:ring-brand-red/25"
              }`}
            >
              {failed ? (
                <RotateCcw className="size-3 shrink-0" strokeWidth={2.25} />
              ) : (
                <Undo2 className="size-3 shrink-0 text-zinc-500" strokeWidth={2.25} />
              )}
              <span>{receipt.action2.label}</span>
              {!failed && (
                <>
                  <span aria-hidden className="h-2.5 w-px bg-zinc-300/80" />
                  <span
                    aria-hidden
                    data-urgent={seconds <= 3}
                    className="font-mono text-[10px] font-semibold tabular-nums text-zinc-500 data-[urgent=true]:text-brand-red"
                  >
                    {seconds}s
                  </span>
                </>
              )}
            </button>
            <span aria-hidden className="h-4 w-px bg-zinc-200/80" />
          </>
        )}

        <button
          type="button"
          onClick={() => (staticPreview ? onDismiss() : setLeaving(true))}
          aria-label="Cerrar el aviso"
          className="flex size-7 shrink-0 items-center justify-center rounded-lg text-faint outline-none
            transition-colors hover:bg-zinc-100 hover:text-zinc-700 focus-visible:ring-2 focus-visible:ring-brand-red/25"
        >
          <X className="size-3.5" strokeWidth={2.25} />
        </button>
      </div>

      {/* 4. Pista de progreso inferior integrada (2px) */}
      {!failed && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 hidden h-[2px] bg-zinc-100 motion-safe:block"
        >
          <span
            style={{ transform: `scaleX(${ratio})` }}
            data-urgent={Boolean(receipt.action2 && seconds <= 3)}
            className="block h-full w-full origin-left bg-emerald-500/80 transition-transform duration-150 ease-linear data-[urgent=true]:bg-brand-red/85"
          />
        </div>
      )}
    </div>
  );
}

/** Región accesible permanente para notificaciones y recibos de acción. */
export function ReceiptStack() {
  const { receipts, dismiss, inset } = useReceipts();

  return (
    <div
      aria-live="polite"
      aria-atomic="false"
      style={{ bottom: `${16 + inset}px` }}
      className="pointer-events-none absolute right-4 z-30 flex max-w-[calc(100vw-2rem)]
        flex-col-reverse items-end gap-2"
    >
      {receipts.map((receipt) => (
        <ReceiptCard key={receipt.id} receipt={receipt} onDismiss={() => dismiss(receipt.id)} />
      ))}
    </div>
  );
}
