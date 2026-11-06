import { Clock, CornerUpLeft, Forward, Paperclip, Send } from "lucide-react";
import { AnimatedCheckIcon } from "../../components/ui/AnimatedCheckIcon";
import type { ComposerSendCelebrationKind } from "./useComposerSendCelebration";

export interface ComposerSendSuccessLayerProps {
  title: string;
  detail: string;
  kind?: ComposerSendCelebrationKind;
  subject?: string;
  attachmentsCount?: number;
  exiting?: boolean;
  showProgress?: boolean;
  /** Ocupa todo el panel del compositor (sin cabecera de asunto/código). */
  fillPanel?: boolean;
  /** Duración de la barra de progreso; por defecto ~3.85s (bandeja). */
  progressDurationMs?: number;
}

function resolveCelebrationKind(
  explicitKind: ComposerSendCelebrationKind | undefined,
  title: string,
): ComposerSendCelebrationKind {
  if (explicitKind) return explicitKind;
  const normalized = title.toLowerCase();
  if (normalized.includes("cola")) return "queued";
  if (normalized.includes("reenviad")) return "forward";
  if (normalized.includes("respuesta") || normalized.includes("respondid")) return "reply";
  return "compose";
}

const KIND_SUBTITLE: Record<ComposerSendCelebrationKind, string> = {
  compose: "Tu mensaje ya salió hacia el destinatario.",
  reply: "Tu respuesta quedó registrada en la conversación.",
  forward: "El mensaje fue reenviado al destinatario indicado.",
  queued: "El servidor reintentará la entrega de forma automática.",
};

const KIND_RECIPIENT_PREFIX: Record<ComposerSendCelebrationKind, string> = {
  compose: "Para",
  reply: "Para",
  forward: "Reenviado a",
  queued: "En cola",
};

/** Vista de confirmación de envío: ocupa el cuerpo del compositor con sello cinético y resumen simétrico. */
export function ComposerSendSuccessLayer({
  title,
  detail,
  kind: explicitKind,
  subject,
  attachmentsCount,
  exiting = false,
  showProgress = true,
  fillPanel = false,
  progressDurationMs = 3850,
}: ComposerSendSuccessLayerProps) {
  const kind = resolveCelebrationKind(explicitKind, title);
  const isQueued = kind === "queued";

  const trimmedDetail = detail.trim();
  const trimmedSubject = subject?.trim() ?? "";

  let primaryText = trimmedDetail;
  let secondaryText = trimmedSubject;

  if (!secondaryText && trimmedDetail.includes(" · ")) {
    const splitAt = trimmedDetail.indexOf(" · ");
    primaryText = trimmedDetail.slice(0, splitAt).trim();
    secondaryText = trimmedDetail.slice(splitAt + 3).trim();
  }

  const defaultSubtitle = KIND_SUBTITLE[kind];
  const isGenericSentence =
    !primaryText ||
    primaryText.toLowerCase() === defaultSubtitle.toLowerCase() ||
    (primaryText.endsWith(".") && !primaryText.includes("@") && !secondaryText);

  const subtitleText = isGenericSentence && primaryText ? primaryText : defaultSubtitle;
  const showCapsule = Boolean((!isGenericSentence && primaryText) || secondaryText || (attachmentsCount && attachmentsCount > 0));

  const SatelliteIcon =
    kind === "forward"
      ? Forward
      : kind === "reply"
        ? CornerUpLeft
        : kind === "queued"
          ? Clock
          : Send;

  return (
    <div
      className={`${
        fillPanel ? "absolute inset-0 z-30" : "relative"
      } flex h-full w-full flex-1 min-h-0 flex-col items-center justify-center overflow-hidden bg-white px-6 py-8 select-none ${
        exiting ? "animate-plf-composer-send-out" : "animate-plf-composer-send-backdrop"
      }`}
      role="status"
      aria-live="polite"
    >
      {/* Resplandor radial centrado detrás del sello (sin bordes ni franjas superiores) */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background: isQueued
            ? "radial-gradient(circle at 50% 44%, rgba(245, 158, 11, 0.075) 0%, rgba(245, 158, 11, 0.018) 38%, transparent 68%)"
            : "radial-gradient(circle at 50% 44%, rgba(16, 185, 129, 0.085) 0%, rgba(16, 185, 129, 0.02) 38%, transparent 68%)",
        }}
      />

      <div className="relative z-10 my-auto flex w-full max-w-lg flex-col items-center justify-center text-center">
        {/* Sello concéntrico estilo Apple con trazo perimetral y satélite de acción */}
        <div className="relative flex size-[72px] items-center justify-center">
          <span
            aria-hidden
            className={`pointer-events-none absolute inset-0 rounded-full border animate-plf-composer-send-wave ${
              isQueued ? "border-amber-400/40" : "border-emerald-400/40"
            }`}
          />
          <span
            aria-hidden
            className={`pointer-events-none absolute -inset-2 rounded-full border animate-plf-composer-send-ring ${
              isQueued
                ? "border-amber-500/14 bg-amber-500/[0.025]"
                : "border-emerald-500/14 bg-emerald-500/[0.025]"
            }`}
          />

          <span
            className={`animate-plf-composer-send-badge relative flex size-[72px] items-center justify-center rounded-full ${
              isQueued
                ? "bg-gradient-to-b from-white via-amber-50/40 to-amber-100/60 shadow-[inset_0_1px_0_rgba(255,255,255,0.95),0_1px_2px_rgba(217,119,6,0.08),0_12px_28px_-8px_rgba(217,119,6,0.22)]"
                : "bg-gradient-to-b from-white via-emerald-50/40 to-emerald-100/60 shadow-[inset_0_1px_0_rgba(255,255,255,0.95),0_1px_2px_rgba(16,185,129,0.08),0_12px_28px_-8px_rgba(16,185,129,0.25)]"
            }`}
          >
            {/* Anillo vectorial perimetral que se dibuja en sincronía con el check */}
            <svg
              aria-hidden
              viewBox="0 0 72 72"
              className="pointer-events-none absolute inset-0 size-full -rotate-90"
            >
              <circle
                cx="36"
                cy="36"
                r="33"
                fill="none"
                strokeWidth="1.25"
                className={isQueued ? "stroke-amber-500/15" : "stroke-emerald-500/15"}
              />
              <circle
                cx="36"
                cy="36"
                r="33"
                fill="none"
                strokeWidth="1.6"
                strokeLinecap="round"
                className={`animate-plf-composer-send-arc ${
                  isQueued ? "stroke-amber-500/50" : "stroke-emerald-500/50"
                }`}
              />
            </svg>

            {/* Núcleo esmeralda con relieve especular y check vectorial */}
            <span
              className={`relative flex size-12 items-center justify-center rounded-full text-white ${
                isQueued
                  ? "bg-gradient-to-b from-amber-500 to-amber-600 shadow-[inset_0_1px_1px_rgba(255,255,255,0.35),0_6px_14px_-3px_rgba(217,119,6,0.45)]"
                  : "bg-gradient-to-b from-emerald-500 to-emerald-600 shadow-[inset_0_1px_1px_rgba(255,255,255,0.35),0_6px_14px_-3px_rgba(5,150,105,0.48)]"
              }`}
            >
              <span className="plf-composer-send-check flex items-center justify-center">
                <AnimatedCheckIcon size={24} strokeWidth={2.75} />
              </span>
            </span>
          </span>

          {/* Insignia satélite que identifica Enviar / Responder / Reenviar / Cola */}
          <span
            aria-hidden
            className={`animate-plf-composer-send-satellite absolute -bottom-0.5 -right-0.5 flex size-6 items-center justify-center rounded-full border bg-white ring-2 ring-white ${
              isQueued
                ? "border-amber-200/90 text-amber-600"
                : "border-emerald-200/90 text-emerald-600"
            }`}
          >
            <SatelliteIcon
              className={`size-3 ${kind === "compose" ? "-translate-x-[0.5px] translate-y-[0.5px]" : ""}`}
              strokeWidth={2.35}
            />
          </span>
        </div>

        {/* Jerarquía tipográfica limpia y simétrica */}
        <h3
          className="mt-5 font-heading text-[17.5px] font-bold tracking-[-0.02em] text-ink animate-plf-composer-send-copy"
          style={{ animationDelay: "0.11s" }}
        >
          {title}
        </h3>

        <p
          className="mt-1 max-w-md text-[13px] font-medium leading-snug text-subtle animate-plf-composer-send-copy"
          style={{ animationDelay: "0.18s" }}
        >
          {subtitleText}
        </p>

        {/* Cápsula de destinatario, asunto y adjuntos */}
        {showCapsule && (
          <div
            className="mt-3.5 inline-flex max-w-full flex-wrap items-center justify-center gap-x-2 gap-y-1 rounded-full border border-zinc-200/90 bg-zinc-50/85 px-3.5 py-1.5 text-[12px] animate-plf-composer-send-copy"
            style={{ animationDelay: "0.24s" }}
          >
            <span className="inline-flex items-center gap-1.5">
              <span
                aria-hidden
                className={`size-1.5 shrink-0 rounded-full ${
                  isQueued ? "bg-amber-500" : "bg-emerald-500"
                }`}
              />
              <span className="font-heading text-[10px] font-bold uppercase tracking-[0.06em] text-faint">
                {KIND_RECIPIENT_PREFIX[kind]}
              </span>
            </span>

            {!isGenericSentence && primaryText && (
              <>
                <span aria-hidden className="h-3 w-px bg-zinc-200/90" />
                <span className="font-semibold text-ink">{primaryText}</span>
              </>
            )}

            {secondaryText && (
              <>
                <span aria-hidden className="text-zinc-300">
                  ·
                </span>
                <span className="font-semibold text-ink">{secondaryText}</span>
              </>
            )}

            {attachmentsCount !== undefined && attachmentsCount > 0 && (
              <>
                <span aria-hidden className="h-3 w-px bg-zinc-200/90" />
                <span className="inline-flex items-center gap-1 font-medium text-subtle tabular-nums">
                  <Paperclip className="size-3 text-faint" strokeWidth={2.2} />
                  {attachmentsCount} {attachmentsCount === 1 ? "adjunto" : "adjuntos"}
                </span>
              </>
            )}
          </div>
        )}

        {/* Indicador sutil de progreso de cierre */}
        {showProgress && (
          <div
            aria-hidden
            className="mt-4 h-[3px] w-24 overflow-hidden rounded-full bg-zinc-100 animate-plf-composer-send-copy"
            style={{ animationDelay: "0.28s" }}
          >
            <div
              className={`h-full w-full origin-left rounded-full animate-plf-composer-send-progress ${
                isQueued ? "bg-amber-500/75" : "bg-emerald-500/80"
              }`}
              style={{ animationDuration: `${progressDurationMs}ms` }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
