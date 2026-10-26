import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

interface DetailCardProps {
  icon: LucideIcon;
  title: ReactNode;
  /** Lo que va a la derecha de la cabecera (accion, codigo, estado). */
  aside?: ReactNode;
  id?: string;
  children: ReactNode;
}

/** Tarjeta de ficha de detalle: cabecera gris con icono y titulo en versalitas, y el cuerpo debajo. */
export function DetailCard({ icon: Icon, title, aside, id, children }: DetailCardProps) {
  return (
    <div id={id} className="rounded-card border border-line bg-white shadow-card overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-zinc-100 bg-zinc-50/50">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-zinc-500" />
          <h3 className="font-heading text-[11.5px] font-bold uppercase tracking-wider text-zinc-800">{title}</h3>
        </div>
        {aside}
      </div>
      {children}
    </div>
  );
}
