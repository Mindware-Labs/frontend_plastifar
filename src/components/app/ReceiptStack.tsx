import { AlertTriangle, Check, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useReceipts } from "../../context/useReceipts";
import type { Receipt } from "../../context/ReceiptContext";

/** Con algo que revertir hace falta leer, decidir y llegar al boton; sin eso, basta con enterarse. */
const WITH_ACTION = 7000;
const PLAIN = 4500;

/** Respaldo del desmontaje: con movimiento reducido la salida dura 1ms y el evento puede no llegar. */
const EXIT_FALLBACK = 200;

/** Un solo latido baja la cifra y encoge el filete: asi no pueden desincronizarse. */
const TICK = 200;

const cardClass =
  "group pointer-events-auto relative flex flex-col rounded-edge bg-white " +
  "shadow-[0_1px_2px_-1px_rgba(27,27,29,0.06),0_12px_28px_-16px_rgba(27,27,29,0.32)]";

function ReceiptCard({ receipt, onDismiss }: { receipt: Receipt; onDismiss: () => void }) {
  const [leaving, setLeaving] = useState(false);
  const [busy, setBusy] = useState(false);
  const timer = useRef<number | null>(null);
  const tick = useRef<number | null>(null);
  const left = useRef(receipt.action2 ? WITH_ACTION : PLAIN);
  const startedAt = useRef(0);

  const failed = receipt.kind === "failed";
  const duration = receipt.action2 ? WITH_ACTION : PLAIN;

  const [remaining, setRemaining] = useState(duration);
  const seconds = Math.max(0, Math.ceil(remaining / 1000));
  const ratio = Math.max(0, Math.min(1, remaining / duration));

  useEffect(() => {
    // El fallo se queda: nadie deberia enterarse de que algo se rompio por casualidad.
    if (failed) return;

    // Al fundirse, el recibo vuelve a estar recien llegado y la ventana se cuenta entera otra vez.
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
  }, [failed, duration, receipt.count]);

  function hold() {
    if (failed || timer.current === null) return;

    window.clearTimeout(timer.current);
    timer.current = null;

    if (tick.current !== null) {
      window.clearInterval(tick.current);
      tick.current = null;
    }

    left.current = Math.max(400, left.current - (performance.now() - startedAt.current));
    // La pausa se ve: la cifra se congela en el tiempo que de verdad queda.
    setRemaining(left.current);
  }

  function resume() {
    if (failed || timer.current !== null || leaving) return;

    startedAt.current = performance.now();
    timer.current = window.setTimeout(() => setLeaving(true), left.current);
    tick.current = window.setInterval(() => {
      setRemaining(Math.max(0, left.current - (performance.now() - startedAt.current)));
    }, TICK);
  }

  useEffect(() => {
    if (!leaving) return;
    const fallback = window.setTimeout(onDismiss, EXIT_FALLBACK);
    return () => window.clearTimeout(fallback);
  }, [leaving, onDismiss]);

  async function runAction() {
    if (!receipt.action2 || busy) return;
    setBusy(true);
    try {
      await receipt.action2.run();
      setLeaving(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      role={failed ? "alert" : "status"}
      onAnimationEnd={(event) => {
        if (event.animationName === "plf-receipt-out") onDismiss();
      }}
      onMouseEnter={hold}
      onMouseLeave={resume}
      onFocusCapture={hold}
      onBlurCapture={resume}
      className={`${cardClass} ${failed ? "border border-line-strong" : "border border-line"} ${
        leaving ? "animate-plf-receipt-out" : "animate-plf-modal-in"
      }`}
    >
      <div className="flex h-8 shrink-0 items-center gap-2 pl-3.5 pr-2">
        {failed ? (
          <AlertTriangle aria-hidden className="h-3.5 w-3.5 shrink-0 text-brand-red-dark" />
        ) : (
          <Check aria-hidden className="h-3.5 w-3.5 shrink-0 text-brand-green" />
        )}

        <span className="font-heading text-[10px] font-bold uppercase leading-none tracking-[0.11em] text-ink">
          {failed ? "No se pudo" : "Listo"}
        </span>

        {/* Punteado contra continuo: el fallo se distingue tambien en blanco y negro. */}
        <span aria-hidden className={`h-px flex-1 ${failed ? "plf-rule-broken" : "bg-line-strong"}`} />

        {receipt.count > 1 && (
          <span className="font-heading text-[10px] font-semibold leading-none tabular-nums text-brand-gray">
            ×{receipt.count}
          </span>
        )}

        <button
          type="button"
          onClick={() => setLeaving(true)}
          aria-label="Cerrar el aviso"
          className="shrink-0 rounded-edge p-1.5 text-subtle outline-none transition-colors
            hover:bg-fill hover:text-ink focus-visible:ring-3 focus-visible:ring-brand-red/25"
        >
          <X className="h-3 w-3" />
        </button>
      </div>

      <div className="border-t border-line px-3.5 pb-3 pt-2">
        {/* El verbo no se trunca: es lo unico que el recibo tiene que decir entero. */}
        <p className="text-[12.5px] font-semibold leading-[1.35] text-ink">{receipt.title}</p>

        {receipt.detail && (
          <p className="mt-1 truncate text-[11.5px] leading-[1.4] text-brand-gray">{receipt.detail}</p>
        )}

        {/* La ventana se anuncia una vez; la cifra va oculta para no repetirse cada segundo. */}
        {receipt.action2 && !failed && (
          <span className="sr-only">
            Puedes deshacerlo durante los próximos {Math.ceil(duration / 1000)} segundos.
          </span>
        )}
      </div>

      {receipt.action2 && !failed && (
        <div className="relative flex h-10 shrink-0 items-center justify-between gap-3 border-t border-line pl-3.5 pr-1">
          {/* El filete que separa ES el reloj: se retira hacia la derecha y muere bajo el boton. */}
          <span
            aria-hidden
            style={{ transform: `scaleX(${ratio})` }}
            className="plf-clock pointer-events-none absolute inset-x-0 -top-px hidden h-px
              origin-right bg-brand-red transition-transform duration-200 ease-linear
              motion-safe:block"
          />

          <span
            aria-hidden
            data-urgent={seconds <= 3}
            className="shrink-0 text-[11px] font-medium leading-none tabular-nums text-brand-gray
              data-[urgent=true]:font-semibold data-[urgent=true]:text-ink"
          >
            Quedan {seconds} s
          </span>

          <button
            type="button"
            onClick={runAction}
            disabled={busy}
            className="h-8 shrink-0 rounded-edge px-2.5 font-heading text-[10.5px] font-bold
              uppercase leading-none tracking-[0.07em] text-brand-red outline-none
              transition-colors hover:bg-fill hover:text-brand-red-dark
              focus-visible:ring-3 focus-visible:ring-brand-red/25 disabled:opacity-50"
          >
            {receipt.action2.label}
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * Los recibos se anclan al area de contenido, no al viewport: asi sobreviven al
 * colapso de la barra lateral sin recalcular nada. La region viva se monta vacia
 * y permanente; insertar un nodo que ya trae aria-live se anuncia de forma dispar.
 */
export function ReceiptStack() {
  const { receipts, dismiss, inset } = useReceipts();

  return (
    <div
      aria-live="polite"
      aria-atomic="false"
      style={{ bottom: `${16 + inset}px` }}
      className="pointer-events-none absolute right-4 z-30 flex w-[min(340px,100%-2rem)]
        flex-col-reverse gap-2"
    >
      {receipts.map((receipt) => (
        <ReceiptCard key={receipt.id} receipt={receipt} onDismiss={() => dismiss(receipt.id)} />
      ))}
    </div>
  );
}
