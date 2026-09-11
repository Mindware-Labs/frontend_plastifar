import { Bell, Hourglass, LoaderCircle, Mail, Ticket, UserRoundCheck, Volume2 } from "lucide-react";
import { useState, type ComponentType, type ReactNode } from "react";
import { useModalAnimation } from "../../hooks/useModalAnimation";
import { useNotifyPrefs } from "../../hooks/useNotifyPrefs";
import {
  desktopState,
  playChime,
  requestDesktop,
  writePrefs,
  type DesktopState,
} from "../../lib/notifications";
import { Button } from "../ui/Button";
import { Modal } from "../ui/Modal";

type Glyph = ComponentType<{ className?: string; strokeWidth?: number }>;

/** Interruptor: pista gris o roja, botón que viaja con la curva de resorte del tema. */
function Switch({ checked, disabled, label, onChange }: {
  checked: boolean;
  disabled?: boolean;
  label: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={(event) => {
        event.stopPropagation();
        onChange(!checked);
      }}
      className={`relative h-5 w-9 shrink-0 cursor-pointer rounded-full outline-none transition-colors duration-200 ease-out
        focus-visible:ring-2 focus-visible:ring-brand-red/25 focus-visible:ring-offset-2
        disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none ${
          checked ? "bg-brand-red" : "bg-zinc-300 hover:bg-zinc-400/80"
        }`}
    >
      <span
        aria-hidden
        className={`absolute top-0.5 left-0.5 size-4 rounded-full bg-white shadow-[0_1px_2px_rgba(27,27,29,0.3)]
          transition-transform duration-280 ease-plf-spring motion-reduce:transition-none ${
            checked ? "translate-x-4" : "translate-x-0"
          }`}
      />
    </button>
  );
}

interface ChannelRowProps {
  icon: Glyph;
  title: string;
  description: string;
  /** Línea de estado bajo la descripción: permiso, prueba, espera. */
  status?: ReactNode;
  checked: boolean;
  disabled?: boolean;
  busy?: boolean;
  /** Acción secundaria a la derecha del título, como "Probar". */
  action?: ReactNode;
  /** Vuelve a lanzar el rebote del sello: sube con cada prueba de sonido. */
  pulseKey?: number;
  onChange: (checked: boolean) => void;
}

/** Fila-canal: el bloque entero conmuta, el interruptor es el control real y el sello dice el estado sin color. */
function ChannelRow({
  icon: Icon,
  title,
  description,
  status,
  checked,
  disabled,
  busy,
  action,
  pulseKey = 0,
  onChange,
}: ChannelRowProps) {
  return (
    <div
      data-checked={checked}
      onClick={() => !disabled && onChange(!checked)}
      className={`group/row flex items-start gap-3 rounded-lg border bg-white py-3 pl-3 pr-3.5 shadow-2xs transition-[border-color,background-color] duration-200 ease-out motion-reduce:transition-none ${
        disabled ? "cursor-not-allowed" : "cursor-pointer hover:border-zinc-300 hover:bg-zinc-50/60"
      } ${checked ? "border-zinc-300" : "border-zinc-200"}`}
    >
      <span
        key={pulseKey}
        aria-hidden
        className={`mt-px flex size-6 shrink-0 items-center justify-center rounded-md transition-colors duration-200 ease-out motion-reduce:transition-none ${
          pulseKey > 0 ? "animate-plf-seal-pop" : ""
        } ${checked ? "bg-brand-red text-white" : "bg-zinc-100 text-zinc-500 group-hover/row:text-zinc-700"}`}
      >
        {busy ? <LoaderCircle className="size-3.5 animate-spin" /> : <Icon className="size-3.5" strokeWidth={2.25} />}
      </span>

      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex items-center gap-2">
          <span className="text-[12.5px] font-semibold leading-none text-ink">{title}</span>
          {action}
        </div>
        <p className="text-[11.5px] leading-relaxed text-zinc-500">{description}</p>
        {status && <div className="mt-0.5 text-[11px] leading-none">{status}</div>}
      </div>

      <div className="mt-0.5">
        <Switch checked={checked} disabled={disabled} label={title} onChange={onChange} />
      </div>
    </div>
  );
}

/** Estado en una línea: punto y texto, legible también en gris. */
function StatusLine({ tone, children }: { tone: "ok" | "warn" | "neutral"; children: ReactNode }) {
  const dot = { ok: "bg-brand-green", warn: "bg-brand-red", neutral: "bg-zinc-300" }[tone];
  const text = { ok: "text-brand-green", warn: "text-brand-red-dark", neutral: "text-zinc-400" }[tone];
  return (
    <span className={`inline-flex items-center gap-1.5 font-medium ${text}`}>
      <span aria-hidden className={`size-1.5 shrink-0 rounded-full ${dot}`} />
      {children}
    </span>
  );
}

const desktopStatus: Record<DesktopState, { tone: "ok" | "warn" | "neutral"; text: string }> = {
  granted: { tone: "ok", text: "Permitido por el navegador" },
  default: { tone: "neutral", text: "Al activarlo, el navegador pedirá permiso" },
  denied: { tone: "warn", text: "Bloqueado en el navegador: actívalo desde el candado de la barra de direcciones" },
  unsupported: { tone: "neutral", text: "No disponible en este navegador" },
};

/** Lo que dispara un aviso hoy, tal como lo escucha InboxAlerts. */
const EVENTS: Array<{ icon: Glyph; title: string; hint: string }> = [
  { icon: Mail, title: "Correo nuevo", hint: "Entra a la bandeja" },
  { icon: UserRoundCheck, title: "Correo asignado", hint: "Alguien te lo pasa" },
  { icon: Ticket, title: "Ticket asignado", hint: "Queda a tu cargo" },
  { icon: Hourglass, title: "SLA por vencer o vencido", hint: "De tus tickets" },
];

/** Cómo avisar cuando llega algo: sonido con la pestaña a la vista y aviso del sistema fuera de ella. */
export function NotificationsModal({ onClose }: { onClose: () => void }) {
  const prefs = useNotifyPrefs();
  const [permission, setPermission] = useState<DesktopState>(desktopState);
  const [asking, setAsking] = useState(false);
  const [chimes, setChimes] = useState(0);
  const { isExiting, requestClose } = useModalAnimation();

  async function toggleDesktop(enabled: boolean) {
    if (!enabled) {
      writePrefs({ ...prefs, desktop: false });
      return;
    }

    setAsking(true);
    const result = await requestDesktop();
    setAsking(false);
    setPermission(result);

    // Sin permiso el interruptor no se enciende: lo que se ve es lo que va a pasar.
    if (result === "granted") writePrefs({ ...prefs, desktop: true });
  }

  function toggleSound(enabled: boolean) {
    writePrefs({ ...prefs, sound: enabled });
    if (enabled) chime();
  }

  function chime() {
    playChime(true);
    setChimes((n) => n + 1);
  }

  const desktopOn = prefs.desktop && permission === "granted";
  const status = asking ? { tone: "neutral" as const, text: "Esperando tu respuesta…" } : desktopStatus[permission];

  return (
    <Modal
      eyebrow="Tu cuenta"
      title="Avisos"
      description="Cómo te enteras de lo que llega. Se guardan en este navegador y cada persona decide los suyos."
      onClose={onClose}
      isExiting={isExiting}
      onRequestClose={requestClose}
      footer={
        <Button size="sm" onClick={requestClose}>
          Listo
        </Button>
      }
    >
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-2">
          <ChannelRow
            icon={Volume2}
            title="Sonido"
            description="Dos notas cortas cada vez que llega algo, con el panel a la vista."
            checked={prefs.sound}
            pulseKey={chimes}
            action={
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  chime();
                }}
                className="cursor-pointer rounded font-heading text-[9.5px] font-bold uppercase leading-none tracking-[0.08em] text-zinc-400 underline-offset-4 transition-colors hover:text-brand-red hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-red"
              >
                Probar
              </button>
            }
            onChange={toggleSound}
          />

          <ChannelRow
            icon={Bell}
            title="Aviso de escritorio"
            description="Notificación del sistema cuando estás en otra ventana o pestaña. Al tocarla se abre lo que llegó."
            status={<StatusLine tone={status.tone}>{status.text}</StatusLine>}
            checked={desktopOn}
            disabled={asking || permission === "unsupported"}
            busy={asking}
            onChange={toggleDesktop}
          />
        </div>

        <section className="flex flex-col gap-2.5 border-t border-line-soft pt-4">
          <div className="flex h-5 items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span
                aria-hidden
                className="flex size-5 shrink-0 items-center justify-center rounded-md bg-brand-red/10 text-brand-red"
              >
                <Bell className="size-3" strokeWidth={2.25} />
              </span>
              <span className="font-heading text-[10.5px] font-bold uppercase tracking-[0.08em] text-ink">
                Qué avisa
              </span>
            </div>
            <span className="text-[11px] text-zinc-400">Con ambos canales</span>
          </div>

          <ul className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
            {EVENTS.map(({ icon: Icon, title, hint }) => (
              <li
                key={title}
                className="flex items-center gap-2.5 rounded-lg border border-zinc-200 bg-white py-1.5 pl-1.5 pr-2.5"
              >
                <span
                  aria-hidden
                  className="flex size-5 shrink-0 items-center justify-center rounded-md bg-zinc-100 text-zinc-500"
                >
                  <Icon className="size-3" strokeWidth={2.25} />
                </span>
                <span className="flex min-w-0 flex-col gap-[3px]">
                  <span className="truncate text-[12px] font-medium leading-none text-ink">{title}</span>
                  <span className="font-heading text-[8.5px] font-bold uppercase leading-none tracking-[0.08em] text-zinc-400">
                    {hint}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </Modal>
  );
}
