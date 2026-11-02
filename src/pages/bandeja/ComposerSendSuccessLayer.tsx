import { AnimatedCheckIcon } from "../../components/ui/AnimatedCheckIcon";

interface ComposerSendSuccessLayerProps {
  open: boolean;
  title: string;
  detail: string;
}

/** Confirmación de envío dentro del compositor, antes de cerrar la vista. */
export function ComposerSendSuccessLayer({ open, title, detail }: ComposerSendSuccessLayerProps) {
  if (!open) return null;

  return (
    <div
      className="absolute inset-0 z-50 flex flex-col items-center justify-center overflow-hidden bg-white animate-plf-composer-send-backdrop"
      role="status"
      aria-live="polite"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-emerald-50/70 to-transparent"
      />

      <div className="relative z-10 flex max-w-[19rem] flex-col items-center px-6 text-center">
        <div className="relative flex h-[4.5rem] w-[4.5rem] items-center justify-center">
          <span
            aria-hidden
            className="absolute inset-0 rounded-full border border-emerald-200/70 animate-plf-composer-send-ring"
          />
          <span
            aria-hidden
            className="absolute -inset-2 rounded-full border border-emerald-100/80 animate-plf-composer-send-ring"
            style={{ animationDelay: "0.14s" }}
          />
          <span className="animate-plf-composer-send-badge relative flex h-[4.5rem] w-[4.5rem] items-center justify-center rounded-full bg-gradient-to-b from-emerald-50 to-emerald-100/90 text-emerald-600 shadow-[inset_0_1px_0_rgba(255,255,255,0.85),0_10px_24px_-10px_rgba(16,185,129,0.55)]">
            <span className="plf-composer-send-check">
              <AnimatedCheckIcon size={32} strokeWidth={2.4} />
            </span>
          </span>
        </div>

        <p
          className="mt-6 font-heading text-[17px] font-bold tracking-[-0.02em] text-zinc-900 animate-plf-composer-send-copy"
          style={{ animationDelay: "0.52s" }}
        >
          {title}
        </p>
        <p
          className="mt-1.5 text-[12.5px] font-medium leading-relaxed text-zinc-500 animate-plf-composer-send-copy"
          style={{ animationDelay: "0.64s" }}
        >
          {detail}
        </p>
      </div>
    </div>
  );
}
