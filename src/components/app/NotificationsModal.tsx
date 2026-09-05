import { Bell, Volume2 } from "lucide-react";
import { useState, type ComponentType } from "react";
import { useNotifyPrefs } from "../../hooks/useNotifyPrefs";
import {
  desktopState,
  playChime,
  requestDesktop,
  writePrefs,
  type DesktopState,
} from "../../lib/notifications";
import { Alert } from "../ui/Alert";
import { Button } from "../ui/Button";
import { Modal } from "../ui/Modal";

interface ToggleRowProps {
  icon: ComponentType<{ className?: string }>;
  title: string;
  description: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
}

/** Fila-interruptor: el bloque entero conmuta, y el estado se lee tambien sin color. */
function ToggleRow({ icon: Icon, title, description, checked, disabled, onChange }: ToggleRowProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="flex w-full items-center gap-3 rounded-edge border border-line px-3.5 py-3 text-left
        outline-none transition-colors hover:border-line-strong hover:bg-canvas
        focus-visible:border-brand-red/40 focus-visible:ring-3 focus-visible:ring-brand-red/12
        aria-checked:border-brand-red/35 aria-checked:bg-brand-red/[0.03]
        disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:bg-transparent"
    >
      <span
        aria-hidden
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-edge transition-colors ${
          checked ? "bg-brand-red/10 text-brand-red" : "bg-fill text-subtle"
        }`}
      >
        <Icon className="h-[18px] w-[18px]" />
      </span>

      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-[13px] font-semibold leading-tight text-ink">{title}</span>
        <span className="text-[11.5px] leading-relaxed text-subtle">{description}</span>
      </span>

      <span
        aria-hidden
        className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${
          checked ? "bg-brand-red" : "bg-line-strong"
        }`}
      >
        <span
          className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-[0_1px_2px_rgba(27,27,29,0.25)]
            transition-transform ${checked ? "translate-x-[18px]" : "translate-x-0.5"}`}
        />
      </span>
    </button>
  );
}

const permissionHelp: Partial<Record<DesktopState, string>> = {
  denied:
    "El navegador tiene bloqueados los avisos de este sitio. Actívalos desde el candado de la barra de direcciones y vuelve a intentarlo.",
  unsupported: "Este navegador no permite avisos de escritorio.",
};

/** Como avisar cuando entra correo: sonido en la pestana y notificacion del sistema fuera de ella. */
export function NotificationsModal({ onClose }: { onClose: () => void }) {
  const prefs = useNotifyPrefs();
  const [permission, setPermission] = useState<DesktopState>(desktopState);
  const [asking, setAsking] = useState(false);

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
    if (enabled) playChime(true);
  }

  const desktopOn = prefs.desktop && permission === "granted";
  const help = permissionHelp[permission];

  return (
    <Modal
      eyebrow="Correo"
      title="Avisos de correo nuevo"
      description="Se aplican en este navegador. Cada persona decide los suyos."
      onClose={onClose}
      footer={
        <Button size="sm" onClick={onClose}>
          Listo
        </Button>
      }
    >
      <div className="flex flex-col gap-2.5">
        <ToggleRow
          icon={Volume2}
          title="Sonido"
          description="Un tono corto cada vez que entra un correo, con el panel abierto."
          checked={prefs.sound}
          onChange={toggleSound}
        />

        <ToggleRow
          icon={Bell}
          title="Aviso de escritorio"
          description="Notificación del sistema cuando estás en otra ventana o pestaña. Al tocarla se abre el correo."
          checked={desktopOn}
          disabled={asking || permission === "unsupported"}
          onChange={toggleDesktop}
        />

        {help && <Alert variant="info">{help}</Alert>}
      </div>
    </Modal>
  );
}
