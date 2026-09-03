import { RefreshCcw, Sparkles } from "lucide-react";
import { useState } from "react";
import { DashboardCard } from "./DashboardCard";

interface SystemStatusCardProps {
  onRefresh: () => void;
  isRefreshing: boolean;
}

/**
 * Contrapunto oscuro deliberado: el resto de la pagina es blanco sobre
 * `bg-fill`, asi que una franja `ink` en la base de esta tarjeta es lo que
 * rompe la monotonia sin inventar un color nuevo — mismo `ink` que ya usan
 * los avatares y el estado activo del Sidebar. "Actualizar" es real: vuelve
 * a pedir los datos de demostracion, no es un boton decorativo.
 */
export function SystemStatusCard({ onRefresh, isRefreshing }: SystemStatusCardProps) {
  const [lastSync] = useState(() => new Date());

  return (
    <DashboardCard padding="sm" className="flex flex-col overflow-hidden !p-0">
      <div className="flex flex-1 flex-col gap-3 p-4">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-red/10 text-brand-red">
          <Sparkles className="h-4 w-4" />
        </span>

        <div>
          <p className="text-[12px] font-medium text-muted">Estado del panel</p>
          <p className="mt-0.5 font-heading text-[20px] font-bold tracking-[-0.02em] text-ink">
            Datos de demostración
          </p>
        </div>

        <p className="text-[12px] leading-relaxed text-muted">
          Todo lo que ves aquí es generado localmente. Cuando la Bandeja de tickets exista, este panel
          se conecta a datos reales sin cambiar de lugar.
        </p>
      </div>

      <div className="flex items-center justify-between gap-3 bg-ink px-4 py-3">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-white/50">Estado</p>
          <p className="truncate text-[12.5px] font-medium text-white">
            Última actualización: {lastSync.toLocaleTimeString("es-DO", { hour: "2-digit", minute: "2-digit" })}
          </p>
        </div>

        <button
          type="button"
          onClick={onRefresh}
          disabled={isRefreshing}
          className="flex shrink-0 items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-[11.5px] font-semibold
            text-ink outline-none transition-colors hover:bg-white/90 focus-visible:ring-3
            focus-visible:ring-white/40 disabled:cursor-wait disabled:opacity-70"
        >
          <RefreshCcw className={`h-3.5 w-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
          Actualizar
        </button>
      </div>
    </DashboardCard>
  );
}
