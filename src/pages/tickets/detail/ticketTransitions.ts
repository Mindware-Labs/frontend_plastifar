import { Clock, Gavel, RotateCcw, X } from "lucide-react";

/** Paso 1 del dialogo "Actualizar ticket": a que grupo de campos lleva cada transicion en el paso 2. */
export type UpdateCategory = "pausar" | "veredicto" | "cancelar" | "otro";

export interface StatusTransitionOption {
  target: string;
  category: UpdateCategory;
  label: string;
  description: string;
  icon: typeof Clock;
  danger?: boolean;
}

const CANCEL_TRANSITION: StatusTransitionOption = {
  target: "Cancelado",
  category: "cancelar",
  label: "Cancelar ticket",
  description: "Para tickets creados por error, duplicados o pruebas. Exige un motivo explicativo.",
  icon: X,
  danger: true,
};

/** Transiciones validas desde el estado actual, para el paso 1 del dialogo "Actualizar ticket". */
export function getAvailableTransitions(status: string): StatusTransitionOption[] {
  switch (status) {
    case "Abierto":
      return [
        {
          target: "En espera del cliente",
          category: "pausar",
          label: "Pausar ticket",
          description: "Pausa el SLA mientras se espera respuesta del cliente.",
          icon: Clock,
        },
        {
          target: "Solucionado",
          category: "veredicto",
          label: "Marcar veredicto",
          description: "Cierra el caso como resuelto.",
          icon: Gavel,
        },
        CANCEL_TRANSITION,
      ];
    case "En espera del cliente":
      return [
        {
          target: "Abierto",
          category: "otro",
          label: "Reanudar a Abierto",
          description: "Reanuda la atención y el cómputo de SLA.",
          icon: RotateCcw,
        },
        CANCEL_TRANSITION,
      ];
    case "Reenvío de producto":
      return [
        {
          target: "Solucionado",
          category: "veredicto",
          label: "Marcar veredicto",
          description: "Cierra el caso como resuelto.",
          icon: Gavel,
        },
        CANCEL_TRANSITION,
      ];
    case "Solucionado":
      return [
        {
          target: "Abierto",
          category: "otro",
          label: "Reabrir ticket",
          description: "Incrementa el contador de reaperturas.",
          icon: RotateCcw,
        },
      ];
    default:
      return [];
  }
}
