import { Bell, Hourglass, LoaderCircle, Mail, Ticket, UserRoundCheck, Volume2 } from "lucide-react";
import { useEffect, useState, type ComponentType, type ReactNode } from "react";
import { useModalAnimation } from "../../hooks/useModalAnimation";
import { useNotifyPrefs } from "../../hooks/useNotifyPrefs";
import {
  desktopState,
  markNotificationsOpened,
  playChime,
  requestDesktop,
  writePrefs,
  type DesktopState,
} from "../../lib/notifications";
import { Button } from "../ui/Button";
import { Modal } from "../ui/Modal";

type Glyph = ComponentType<{ className?: string; strokeWidth?: number }>;

/** Interruptor táctil de alta definición: pista nítida, aro interior y resorte suave. */
function Switch({
  checked,
  disabled,
  label,
  onChange,
}: {
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
      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border border-transparent p-0.5 transition-colors duration-200 ease-out outline-none focus-visible:ring-2 focus-visible:ring-brand-red/30 focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-40 motion-reduce:transition-none ${
        checked ? "bg-brand-red" : "bg-zinc-200 hover:bg-zinc-300"
      }`}
    >
      <span
        aria-hidden
        className={`pointer-events-none inline-block size-4 rounded-full bg-white shadow-xs ring-1 ring-black/5 transition-transform duration-200 ease-plf-spring motion-reduce:transition-none ${
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

/** Fila-canal: tarjeta con borde nítido, sello icónico Plastifar y switch táctil. */
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
      className={`group/row flex items-start gap-3.5 rounded-xl border p-4 shadow-2xs transition-all duration-150 motion-reduce:transition-none ${
        disabled
          ? "cursor-not-allowed opacity-60 bg-zinc-50/40 border-zinc-200"
          : "cursor-pointer"
      } ${
        checked
          ? "border-zinc-300/90 bg-white ring-1 ring-zinc-950/[0.02]"
          : "border-zinc-200/90 bg-zinc-50/30 hover:border-zinc-300 hover:bg-white"
      }`}
    >
      <span
        key={pulseKey}
        aria-hidden
        className={`mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg border transition-all duration-200 ease-out motion-reduce:transition-none ${
          pulseKey > 0 ? "animate-plf-seal-pop" : ""
        } ${
          checked
            ? "border-brand-red/25 bg-brand-red/10 text-brand-red shadow-2xs"
            : "border-zinc-200/80 bg-zinc-100 text-zinc-500 group-hover/row:border-zinc-300 group-hover/row:text-zinc-700"
        }`}
      >
        {busy ? (
          <LoaderCircle className="size-4 animate-spin" />
        ) : (
          <Icon className="size-4" strokeWidth={2} />
        )}
      </span>

      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[13.5px] font-semibold leading-none text-ink">
            {title}
          </span>
          {action}
        </div>
        <p className="text-[12px] leading-relaxed text-zinc-500">
          {description}
        </p>
        {status && <div className="mt-1">{status}</div>}
      </div>

      <div className="mt-0.5 shrink-0 pl-1">
        <Switch checked={checked} disabled={disabled} label={title} onChange={onChange} />
      </div>
    </div>
  );
}

/** Estado en una línea: píldora con borde sutil, punto de color y texto de alto contraste. */
function StatusLine({ tone, children }: { tone: "ok" | "warn" | "neutral"; children: ReactNode }) {
  const styles = {
    ok: "border-emerald-200/70 bg-emerald-50/80 text-emerald-700",
    warn: "border-rose-200/70 bg-rose-50/80 text-rose-700",
    neutral: "border-zinc-200/80 bg-zinc-50 text-zinc-600",
  }[tone];

  const dot = {
    ok: "bg-emerald-600",
    warn: "bg-rose-600",
    neutral: "bg-zinc-400",
  }[tone];

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[11px] font-medium leading-normal ${styles}`}>
      <span aria-hidden className={`size-1.5 shrink-0 rounded-full ${dot}`} />
      <span>{children}</span>
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
  { icon: Mail, title: "Correo nuevo", hint: "Entra a la bandeja de entrada" },
  { icon: UserRoundCheck, title: "Correo asignado", hint: "Alguien te pasa una conversación" },
  { icon: Ticket, title: "Ticket asignado", hint: "Queda bajo tu responsabilidad" },
  { icon: Hourglass, title: "SLA por vencer o vencido", hint: "De tus tickets asignados" },
];

/** Cómo avisar cuando llega algo: sonido con la pestaña a la vista y aviso del sistema fuera de ella. */
export function NotificationsModal({ onClose }: { onClose: () => void }) {
  const prefs = useNotifyPrefs();
  const [permission, setPermission] = useState<DesktopState>(desktopState);
  const [asking, setAsking] = useState(false);
  const [chimes, setChimes] = useState(0);
  const { isExiting, requestClose } = useModalAnimation();

  useEffect(() => {
    markNotificationsOpened();
  }, []);

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
  const status = asking ? { tone: "neutral" as const, text: "Esperando tu respuesta en el navegador…" } : desktopStatus[permission];

  return (
    <Modal
      eyebrow="Configuración"
      title="Avisos y notificaciones"
      description="Cómo te enteras de lo que llega. Se guardan en este navegador y cada persona decide los suyos."
      onClose={onClose}
      isExiting={isExiting}
      onRequestClose={requestClose}
      maxWidth="max-w-[500px]"
      footer={
        <div className="flex w-full items-center justify-between">
          <span className="inline-flex items-center gap-1.5 text-[11.5px] text-zinc-400">
            <kbd className="rounded border border-zinc-200 bg-white px-1.5 py-0.5 font-mono text-[10px] font-medium text-zinc-600 shadow-2xs">
              Esc
            </kbd>
            <span>para cerrar</span>
          </span>
          <Button size="sm" onClick={requestClose}>
            Listo
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-5">
        {/* Canales principales */}
        <div className="flex flex-col gap-2.5">
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
                className="inline-flex items-center gap-1 rounded-md border border-zinc-200/90 bg-zinc-50 px-2 py-0.5 text-[11px] font-medium text-zinc-600 shadow-2xs transition-colors hover:border-zinc-300 hover:bg-zinc-100 hover:text-zinc-900 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-red/25"
              >
                <Volume2 className="size-3 text-zinc-400" />
                <span>Probar sonido</span>
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

        {/* Bloque explicativo de eventos */}
        <section className="flex flex-col gap-3 border-t border-line pt-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span
                aria-hidden
                className="flex size-5 shrink-0 items-center justify-center rounded-md bg-brand-red/10 text-brand-red"
              >
                <Bell className="size-3" strokeWidth={2.25} />
              </span>
              <span className="font-heading text-[10.5px] font-bold uppercase tracking-[0.08em] text-ink">
                Qué dispara un aviso
              </span>
            </div>
            <span className="text-[11px] font-medium text-zinc-400">Canales activos</span>
          </div>

          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {EVENTS.map(({ icon: Icon, title, hint }) => (
              <li
                key={title}
                className="flex items-start gap-2.5 rounded-lg border border-zinc-200/80 bg-zinc-50/40 p-2.5 transition-colors hover:border-zinc-300 hover:bg-zinc-50"
              >
                <span
                  aria-hidden
                  className="mt-0.5 flex size-6.5 shrink-0 items-center justify-center rounded-md border border-zinc-200/70 bg-white text-zinc-600 shadow-2xs"
                >
                  <Icon className="size-3.5" strokeWidth={2} />
                </span>
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="truncate text-[12px] font-semibold leading-tight text-ink">
                    {title}
                  </span>
                  <span className="text-[11px] leading-snug text-zinc-500">
                    {hint}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </Modal>
  );
}
