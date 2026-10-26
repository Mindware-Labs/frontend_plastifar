import type { CSSProperties } from "react";
import { Skeleton } from "../../../components/ui/Skeleton";
import { CARD_PAD, S } from "../styles";

/**
 * El tablero mientras llega su unica lectura.
 *
 * Tiene la forma del tablero —cinco cifras, dos bandas de tarjetas— y no la de
 * una tabla. El esqueleto anterior era el de un listado, y al llegar los datos
 * la pantalla entera cambiaba de forma: la persona perdia el sitio donde iba a
 * mirar justo cuando aparecia lo que vino a mirar.
 *
 * Ninguna cifra: un cero en un tablero es una afirmacion («no hay vencidos»),
 * no un «todavia no se».
 */

const PAIR: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(0,1.85fr) minmax(0,1fr)",
  gap: S.md,
};

export function DashboardSkeleton() {
  return (
    <div
      role="status"
      aria-label="Cargando el tablero de operaciones"
      style={{ display: "flex", flexDirection: "column", gap: S.xl, paddingTop: 2 }}
    >
      <div
        className="cx-kpis"
        style={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(0, 1fr))", gap: S.md }}
      >
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="cx-card" style={{ padding: "13px 15px", display: "grid", gap: 10 }}>
            <Skeleton className="h-3 w-24" delay={i * 60} />
            <Skeleton className="h-6 w-12" delay={i * 60} />
            <Skeleton className="h-1 w-full" delay={i * 60} />
            <Skeleton className="h-2.5 w-28" delay={i * 60} />
          </div>
        ))}
      </div>

      {[0, 1].map((band) => (
        <div key={band} className="cx-pair" style={PAIR}>
          <div className="cx-card" style={{ padding: CARD_PAD, display: "grid", gap: 14 }}>
            <Skeleton className="h-4 w-40" delay={band * 120} />
            <Skeleton className="h-[220px] w-full" delay={band * 120} />
          </div>
          <div className="cx-card" style={{ padding: CARD_PAD, display: "grid", gap: 14 }}>
            <Skeleton className="h-4 w-32" delay={band * 120 + 60} />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              {Array.from({ length: 4 }, (_, i) => (
                <Skeleton key={i} className="h-[100px] w-full" delay={band * 120 + 60} />
              ))}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
