import { ChevronRight } from "lucide-react";

/**
 * Cabecera de pagina: breadcrumb + titulo + descripcion. Notificaciones y
 * perfil ya viven en el TopBar global — repetirlos aqui seria la misma
 * informacion dos veces en la misma pantalla. La accion principal ("Nuevo
 * ticket") vive pegada a la bandeja, que es donde tiene sentido, no suelta
 * arriba de todo.
 */
export function DashboardHeader() {
  return (
    <div className="mb-1 flex flex-col gap-1.5">
      <nav aria-label="Ubicación actual" className="flex items-center gap-1.5 text-[12px] text-faint">
        <span>Plastifar</span>
        <ChevronRight aria-hidden className="h-3 w-3" />
        <span className="font-medium text-muted">Dashboard</span>
      </nav>

      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h1 className="font-heading text-[24px] font-bold tracking-[-0.02em] text-ink">Dashboard</h1>
          <p className="mt-0.5 text-[13px] text-muted">
            Vista general de la operación de soporte — volumen, cumplimiento de SLA y la bandeja completa.
          </p>
        </div>
      </div>
    </div>
  );
}
