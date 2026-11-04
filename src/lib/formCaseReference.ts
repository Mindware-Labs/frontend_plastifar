/** Referencia visible en PF-FOR: TAR-… (tarea) o PLT-… (ticket real). */
export function isTaskCaseReference(code: string | null | undefined): boolean {
  return /^TAR-/i.test((code ?? "").trim());
}

export function caseReferenceColumnLabel(code: string | null | undefined): "Tarea" | "Ticket" {
  return isTaskCaseReference(code) ? "Tarea" : "Ticket";
}
