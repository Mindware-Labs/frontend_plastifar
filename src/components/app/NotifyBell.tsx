import { Bell, BellOff, X } from "lucide-react";
import { useState } from "react";
import { useHasOpenedNotifications, useNotifyPrefs } from "../../hooks/useNotifyPrefs";
import { markNotificationsOpened } from "../../lib/notifications";
import { NotificationsModal } from "./NotificationsModal";

/**
 * Avisos de sonido y escritorio.
 *
 * ==================================================================
 * POR QUE ESTA EN LA BARRA Y NO EN LA BANDEJA
 * ==================================================================
 * Nacio dentro de la cabecera de Correo, y ahi solo existia mientras la
 * persona estuviera en esa pantalla. Pero lo que configura no es de Correo:
 * son los avisos del sistema —correo nuevo Y tickets asignados—, y quien esta
 * trabajando en Calidad o en el tablero tambien los recibe. Un ajuste global
 * escondido detras de una pantalla concreta es un ajuste que la mayoria no
 * encuentra.
 *
 * En la barra superior esta a la vista desde cualquier sitio, que es donde
 * todo el mundo busca una campana.
 *
 * ==================================================================
 * REEMPLAZA A UNA CAMPANA QUE NO HACIA NADA
 * ==================================================================
 * La barra ya tenia una: abria un desplegable con una lista de avisos que
 * nadie alimentaba nunca —`notifications = []` por omision, y ningun sitio
 * pasaba la prop—. Estaba siempre vacia. Dos campanas, y la unica que servia
 * era la que estaba escondida.
 */
export function NotifyBell() {
  const prefs = useNotifyPrefs();
  const hasOpenedAlerts = useHasOpenedNotifications();
  const [editingAlerts, setEditingAlerts] = useState(false);

  const alertsOn = prefs.sound || prefs.desktop;

  return (
    <div className="relative">
      {/* `title` y no un Tooltip de Radix: este componente vive en la barra
          superior, fuera de cualquier `TooltipProvider`, y depender de un
          proveedor que quiza no este es una dependencia escondida que revienta
          el dia que alguien lo monte en otro sitio. El texto es el mismo. */}
      <button
            type="button"
            onClick={() => {
              markNotificationsOpened();
              setEditingAlerts(true);
            }}
            aria-label="Avisos de correo nuevo"
            title={
              !hasOpenedAlerts
                ? "Configura tus avisos de sonido y escritorio"
                : alertsOn
                  ? "Avisos activados"
                  : "Avisos desactivados"
            }
            className={`relative flex h-8 w-8 items-center justify-center rounded-edge border bg-white
              shadow-2xs transition-all outline-none focus-visible:ring-2 focus-visible:ring-brand-red/20
              active:scale-95 cursor-pointer ${
                !hasOpenedAlerts
                  ? "border-brand-red/50 text-brand-red ring-2 ring-brand-red/15 hover:border-brand-red hover:bg-brand-red/[0.04]"
                  : "border-line text-subtle hover:border-line-strong hover:bg-fill hover:text-ink"
              }`}
          >
            {alertsOn ? (
              <Bell className="h-4 w-4 text-brand-red" />
            ) : (
              <BellOff className={`h-4 w-4 ${!hasOpenedAlerts ? "text-brand-red" : "text-faint"}`} />
            )}

            {!hasOpenedAlerts && (
              <span className="absolute -top-1 -right-1 flex size-2.5 pointer-events-none">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand-red opacity-75" />
                <span className="relative inline-flex size-2.5 rounded-full bg-brand-red ring-2 ring-white" />
              </span>
            )}
      </button>

      {/* Llamada de atención mientras nunca se haya abierto la configuración. */}
      {!hasOpenedAlerts && (
        <div
          className="group absolute right-0 top-full z-30 mt-2.5 w-72 rounded-card border border-brand-red/25
            bg-white shadow-[0_10px_28px_rgba(228,0,43,0.14)] transition-all
            hover:border-brand-red/40 animate-in fade-in slide-in-from-top-2 duration-200"
        >
          <div
            aria-hidden
            className="absolute -top-1.5 right-3 size-3 rotate-45 border-t border-l border-brand-red/25 bg-white"
          />

          {/* Botón de verdad: se llega con Tab y se activa con Enter, no sólo con el ratón. */}
          <button
            type="button"
            onClick={() => {
              markNotificationsOpened();
              setEditingAlerts(true);
            }}
            className="relative block w-full cursor-pointer rounded-card p-3.5 text-left outline-none
              focus-visible:ring-2 focus-visible:ring-brand-red/30"
          >
            <div className="flex items-center gap-2 pr-6">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-brand-red/10 text-brand-red">
                <Bell className="size-3.5" />
              </span>
              <span className="font-heading text-[12px] font-bold text-ink">¡Activa tus avisos!</span>
            </div>

            <p className="mt-1.5 text-[11.5px] leading-relaxed text-subtle">
              Entérate al instante con <strong>sonido</strong> y{" "}
              <strong>alertas de escritorio</strong> cuando lleguen nuevos correos o se te asignen
              tickets.
            </p>

            <div className="mt-2.5 flex items-center justify-between border-t border-line-soft pt-2 text-[11px] font-semibold text-brand-red">
              <span>Configurar ahora</span>
              <span aria-hidden className="transition-transform group-hover:translate-x-0.5">
                →
              </span>
            </div>
          </button>

          <button
            type="button"
            onClick={() => markNotificationsOpened()}
            aria-label="Cerrar sugerencia"
            title="Cerrar sugerencia"
            className="absolute right-2.5 top-2.5 flex size-5 items-center justify-center rounded
              text-faint transition-colors hover:bg-fill hover:text-ink"
          >
            <X className="size-3" />
          </button>
        </div>
      )}

      {editingAlerts && <NotificationsModal onClose={() => setEditingAlerts(false)} />}
    </div>
  );
}
