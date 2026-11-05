/** La acotacion cuando el correo no se escribio desde aca. Null si salio de la bandeja. */
export function ticketsNote(message: { direction: string; origin?: string }): string | null {
  if (message.origin !== "Tickets") return null;

  return message.direction === "Outbound"
    ? "Esta respuesta se envió desde el módulo de tickets."
    : "El cliente responde a un correo que se envió desde el módulo de tickets.";
}

export function getThreadMessageBadge(message: { direction: string; subject?: string }) {
  if (message.direction !== "Outbound") {
    return {
      label: "Recibido por",
      className: "bg-zinc-100 text-zinc-700 border border-zinc-200/90",
    };
  }

  const sub = (message.subject ?? "").trim().toLowerCase();
  const isReply = sub.startsWith("re:");

  if (isReply) {
    return {
      label: "Respondido a",
      className: "bg-brand-red/10 text-brand-red-dark border border-brand-red/20",
    };
  }

  return {
    label: "Enviado a",
    className: "bg-sky-500/10 text-sky-800 border border-sky-500/25",
  };
}

/** Primer renglon con contenido: es el resumen que cabe en una linea de la lista. */
export function firstLine(text: string) {
  return text.split("\n").find((line) => line.trim() !== "")?.trim() ?? "";
}
