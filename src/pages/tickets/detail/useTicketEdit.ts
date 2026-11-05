import { useEffect, useState } from "react";
import { departmentsApi } from "../../../api/departments";
import { ticketsApi } from "../../../api/tickets";
import type { useReceipts } from "../../../context/useReceipts";
import type { DepartmentResponse, TicketCreateOptionsResponse, TicketDetailResponse } from "../../../types/api";

interface UseTicketEditOptions {
  ticket: TicketDetailResponse | null;
  ticketId: number;
  refreshTicket: () => Promise<void>;
  receipts: ReturnType<typeof useReceipts>;
  triggerSettle: () => void;
}

/** Edicion de atributos (PUT /api/tickets/{id}) y el arbol de departamentos con que se rotula la ficha. */
export function useTicketEdit({ ticket, ticketId, refreshTicket, receipts, triggerSettle }: UseTicketEditOptions) {
  const [showEditModal, setShowEditModal] = useState(false);
  const [editSubject, setEditSubject] = useState("");
  const [editTopicId, setEditTopicId] = useState<number | null>(null);
  const [editPriority, setEditPriority] = useState("Normal");
  const [editDepartmentId, setEditDepartmentId] = useState<number | null>(null);
  const [editProductLineId, setEditProductLineId] = useState<number | null>(null);
  const [editError, setEditError] = useState<string | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [editCatalogs, setEditCatalogs] = useState<TicketCreateOptionsResponse | null>(null);
  const [loadingEditCatalogs, setLoadingEditCatalogs] = useState(false);
  // Arbol entero, para rotular con el camino: el catalogo trae solo id y nombre.
  const [editDepartmentTree, setEditDepartmentTree] = useState<DepartmentResponse[] | undefined>(undefined);

  /* Se lee al entrar y no solo al abrir el formulario: la ficha tambien rotula
     el departamento con su camino, porque dos pueden llamarse igual. Es la misma
     lectura que ya hacia esta pantalla, antes; si falla, el formulario la
     reintenta al abrirse y la ficha muestra el nombre que mando el servidor. */
  useEffect(() => {
    departmentsApi
      .list({ includeInactive: true })
      .then(setEditDepartmentTree)
      .catch(() => setEditDepartmentTree(undefined));
  }, []);

  const handleOpenEditModal = async () => {
    if (!ticket) return;
    setEditSubject(ticket.subject);
    setEditTopicId(ticket.topicId ?? null);
    setEditPriority(ticket.priority);
    setEditDepartmentId(ticket.departmentId ?? null);
    setEditProductLineId(ticket.productLineId ?? null);
    setEditError(null);
    setShowEditModal(true);

    // Si falla, las opciones salen con su nombre, como antes.
    if (!editDepartmentTree) {
      departmentsApi
        .list({ includeInactive: true })
        .then(setEditDepartmentTree)
        .catch(() => setEditDepartmentTree(undefined));
    }

    if (!editCatalogs) {
      try {
        setLoadingEditCatalogs(true);
        setEditCatalogs(await ticketsApi.createOptions());
      } catch {
        // Sin catalogos el formulario sigue abierto con los valores actuales.
      } finally {
        setLoadingEditCatalogs(false);
      }
    }
  };

  const handleConfirmEdit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!editSubject.trim()) {
      setEditError("El asunto es obligatorio");
      triggerSettle();
      return;
    }

    try {
      setSavingEdit(true);
      setEditError(null);
      await ticketsApi.update(ticketId, {
        subject: editSubject.trim(),
        topicId: editTopicId,
        priority: editPriority,
        departmentId: editDepartmentId,
        productLineId: editProductLineId,
      });
      setShowEditModal(false);
      await refreshTicket();
      receipts.done({ action: "editar-ticket", title: "Clasificación actualizada", detail: ticket?.number });
    } catch (err) {
      setEditError(err instanceof Error ? err.message : "Error al actualizar");
      triggerSettle();
    } finally {
      setSavingEdit(false);
    }
  };

  return {
    showEditModal,
    setShowEditModal,
    editSubject,
    setEditSubject,
    editTopicId,
    setEditTopicId,
    editPriority,
    setEditPriority,
    editDepartmentId,
    setEditDepartmentId,
    editProductLineId,
    setEditProductLineId,
    editError,
    setEditError,
    savingEdit,
    editCatalogs,
    loadingEditCatalogs,
    editDepartmentTree,
    handleOpenEditModal,
    handleConfirmEdit,
  };
}

export type TicketEditFlow = ReturnType<typeof useTicketEdit>;
