/** ¿El caso host (tarea o ticket) ya está cerrado y no hay que preguntar por completar/cerrar? */
export function isEnterpriseFormHostClosed(
  formHostKind: "ticket" | "task",
  ticketStatus: string | undefined,
  hostTaskStatus: string | undefined,
): boolean {
  if (formHostKind === "task") {
    return hostTaskStatus === "Completada" || hostTaskStatus === "Cancelada";
  }
  return ticketStatus === "Solucionado" || ticketStatus === "Cancelado";
}

export function shouldPromptEnterpriseFormHostClose(
  formHostKind: "ticket" | "task",
  ticketId: number,
  hostTaskId: number | undefined,
  ticketStatus: string | undefined,
  hostTaskStatus: string | undefined,
): boolean {
  if (isEnterpriseFormHostClosed(formHostKind, ticketStatus, hostTaskStatus)) {
    return false;
  }
  if (formHostKind === "task") {
    return (hostTaskId ?? 0) > 0;
  }
  return ticketId > 0;
}
