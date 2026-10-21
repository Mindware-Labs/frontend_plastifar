import { Flag, UserCheck } from "lucide-react";
import { TableSelectionBar } from "../../components/ui/TableSelectionBar";

interface TicketSelectionBarProps {
  count: number;
  pageState: boolean | "mixed";
  busy: boolean;
  isExiting?: boolean;
  onTogglePage: () => void;
  onClear: () => void;
  onAssign: () => void;
  onPriority: () => void;
}

/** Barra de selección de tickets: bandeja neutra sobria con pastilla de conteo y acciones táctiles. */
export function TicketSelectionBar({
  count,
  pageState,
  busy,
  isExiting = false,
  onTogglePage,
  onClear,
  onAssign,
  onPriority,
}: TicketSelectionBarProps) {
  return (
    <TableSelectionBar
      count={count}
      pageState={pageState}
      busy={busy}
      isExiting={isExiting}
      onTogglePage={onTogglePage}
      onClear={onClear}
      actions={[
        {
          key: "assign",
          label: "Asignar",
          icon: <UserCheck aria-hidden className="h-3.5 w-3.5 text-zinc-500" />,
          onClick: onAssign,
        },
        {
          key: "priority",
          label: "Prioridad",
          icon: <Flag aria-hidden className="h-3.5 w-3.5 text-zinc-500" />,
          onClick: onPriority,
        },
      ]}
    />
  );
}
