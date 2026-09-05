import { AlertTriangle } from "lucide-react";
import type { ComponentType, ReactNode } from "react";
import { Alert } from "../../components/ui/Alert";
import { Button } from "../../components/ui/Button";
import { Modal } from "../../components/ui/Modal";

/**
 * Piezas comunes a los ocho catalogos de Configuracion.
 *
 * Son ocho pantallas casi identicas y el usuario no debe poder distinguir cual
 * esta mirando: la carga, el refresco, el vacio, el error y el aviso ambar viven
 * aqui una sola vez para que ninguna seccion invente su propia version.
 */

/** Error de carga con su salida: un mensaje sin reintento es un callejon. */
export function LoadErrorAlert({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="mb-3">
      <Alert variant="error">
        <span className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
          {message}
          <button
            type="button"
            onClick={onRetry}
            className="rounded-edge font-heading text-[11px] font-semibold uppercase tracking-[0.06em]
              underline underline-offset-2 outline-none transition-colors hover:text-brand-red
              focus-visible:ring-3 focus-visible:ring-brand-red/25"
          >
            Reintentar
          </button>
        </span>
      </Alert>
    </div>
  );
}

/**
 * Aviso de configuracion incompleta. Ambar, no rojo: DESIGN.md reserva el rojo
 * para el error y la accion primaria, y esto es un «todavia no», no un fallo.
 */
export function WarnNotice({ children }: { children: ReactNode }) {
  return (
    <div
      role="status"
      className="relative flex items-start gap-2.5 overflow-hidden rounded-edge border border-warn/25
        bg-warn/[0.06] py-2.5 pl-4 pr-3.5 text-[12.5px] font-medium leading-relaxed text-warn"
    >
      <span aria-hidden className="absolute inset-y-0 left-0 w-[3px] bg-warn" />
      <AlertTriangle className="mt-px h-4 w-4 shrink-0" />
      <span>{children}</span>
    </div>
  );
}

/**
 * Mensaje que solo informa: una sola salida. Pasarlo por un dialogo de
 * confirmacion obligaria a inventar un «si» para algo que no se puede aceptar
 * ni rechazar.
 */
export function NoticeDialog({
  title,
  icon: Icon = AlertTriangle,
  children,
  onClose,
}: {
  title: string;
  icon?: ComponentType<{ className?: string }>;
  children: ReactNode;
  onClose: () => void;
}) {
  return (
    <Modal
      title={title}
      onClose={onClose}
      footer={
        <Button type="button" onClick={onClose}>
          Entendido
        </Button>
      }
    >
      <div className="flex gap-4">
        <span
          aria-hidden
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-edge bg-warn/10 text-warn"
        >
          <Icon className="h-5 w-5" />
        </span>
        <div className="text-[13.5px] leading-relaxed text-brand-gray">{children}</div>
      </div>
    </Modal>
  );
}

/** Grupo de pastillas con nombre accesible: sueltas no dicen que filtran. */
/**
 * Grupo de pastillas de filtro.
 *
 * Con `ready` en false pinta esqueletos en vez de las pastillas: los contadores
 * se derivan de la lista cargada, asi que antes de la primera respuesta -o
 * despues de un fallo- valdrian cero, y un cero no es "todavia no se sabe", es
 * la afirmacion de que no hay ninguno.
 */
export function ChipGroup({
  label,
  ready = true,
  skeletonCount = 3,
  children,
}: {
  label: string;
  ready?: boolean;
  skeletonCount?: number;
  children: ReactNode;
}) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap items-center gap-2">
      {ready
        ? children
        : Array.from({ length: skeletonCount }, (_, index) => (
            <span key={index} aria-hidden className="h-8 w-[104px] animate-pulse rounded-full bg-fill" />
          ))}
    </div>
  );
}
