import { useEffect, useState } from "react";
import { ticketsApi } from "../../../api/tickets";
import type { useReceipts } from "../../../context/useReceipts";
import type { TicketDetailResponse, TicketStaffOptionResponse } from "../../../types/api";

interface UseTicketAssignOptions {
  ticket: TicketDetailResponse | null;
  ticketId: number;
  refreshTicket: () => Promise<void>;
  receipts: ReturnType<typeof useReceipts>;
  triggerSettle: () => void;
}

/** Personal asignable (lo usa tambien la pestana de tareas) y el dialogo "Asignar ticket". */
export function useTicketAssign({ ticket, ticketId, refreshTicket, receipts, triggerSettle }: UseTicketAssignOptions) {
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assignableStaff, setAssignableStaff] = useState<TicketStaffOptionResponse[]>([]);
  const [loadingStaff, setLoadingStaff] = useState(false);

  // Una sola carga para la pestana de tareas y el modal de asignacion; este solo repite si aquella fallo.
  useEffect(() => {
    if (!ticketId) return;
    let active = true;
    ticketsApi
      .getAssignableStaff(ticketId)
      .then((list) => {
        if (active) setAssignableStaff(list);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [ticketId]);
  const [selectedStaffId, setSelectedStaffId] = useState("");
  const [assignComment, setAssignComment] = useState("");
  const [assigning, setAssigning] = useState(false);
  const [assignError, setAssignError] = useState<string | null>(null);

  const handleOpenAssignModal = async () => {
    if (!ticket) return;
    setSelectedStaffId(ticket.assignedStaffId ? String(ticket.assignedStaffId) : "");
    setAssignComment("");
    setAssignError(null);
    setShowAssignModal(true);
    if (assignableStaff.length > 0) return;
    try {
      setLoadingStaff(true);
      setAssignableStaff(await ticketsApi.getAssignableStaff(ticketId));
    } catch (err) {
      setAssignError(err instanceof Error ? err.message : "No se pudo cargar el personal asignable.");
    } finally {
      setLoadingStaff(false);
    }
  };

  const handleConfirmAssign = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      setAssigning(true);
      setAssignError(null);
      await ticketsApi.assign(ticketId, {
        staffId: selectedStaffId ? parseInt(selectedStaffId, 10) : null,
        comment: assignComment.trim() || undefined,
      });
      setShowAssignModal(false);
      await refreshTicket();
      receipts.done({
        action: "asignar-ticket",
        title: selectedStaffId ? "Ticket asignado" : "Asignación retirada",
        detail: ticket?.number,
      });
    } catch (err) {
      setAssignError(err instanceof Error ? err.message : "Error al asignar");
      triggerSettle();
    } finally {
      setAssigning(false);
    }
  };

  return {
    showAssignModal,
    setShowAssignModal,
    assignableStaff,
    loadingStaff,
    selectedStaffId,
    setSelectedStaffId,
    assignComment,
    setAssignComment,
    assigning,
    assignError,
    setAssignError,
    handleOpenAssignModal,
    handleConfirmAssign,
  };
}

export type TicketAssignFlow = ReturnType<typeof useTicketAssign>;
