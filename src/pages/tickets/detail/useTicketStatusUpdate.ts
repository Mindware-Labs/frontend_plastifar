import { useEffect, useRef, useState } from "react";
import { ticketsApi } from "../../../api/tickets";
import { ticketVerdictsApi } from "../../../api/ticketVerdicts";
import type { useReceipts } from "../../../context/useReceipts";
import { useUploadFeedback } from "../../../hooks/useUploadFeedback";
import type { TicketDetailResponse, TicketVerdictOption } from "../../../types/api";
import { validateAttachments } from "./ticketDetailShared";
import { getAvailableTransitions } from "./ticketTransitions";

interface UseTicketStatusUpdateOptions {
  ticket: TicketDetailResponse | null;
  ticketId: number;
  refreshTicket: () => Promise<void>;
  receipts: ReturnType<typeof useReceipts>;
  triggerSettle: () => void;
}

/** Estado y acciones del dialogo "Actualizar ticket" (transicion de estado y veredicto en pasos). */
export function useTicketStatusUpdate({
  ticket,
  ticketId,
  refreshTicket,
  receipts,
  triggerSettle,
}: UseTicketStatusUpdateOptions) {
  // Control de pasos de transición según la acción seleccionada.
  const [transitioning, setTransitioning] = useState(false);
  const [transitionError, setTransitionError] = useState<string | null>(null);
  const [showUpdateStatusModal, setShowUpdateStatusModal] = useState(false);
  const [updateStep, setUpdateStep] = useState<1 | 2 | 3>(1);
  const [stepDirection, setStepDirection] = useState<"forward" | "backward">("forward");
  const [updateTargetStatus, setUpdateTargetStatus] = useState("");
  const [updateVerdictId, setUpdateVerdictId] = useState("");
  const [updateComment, setUpdateComment] = useState("");
  const [updateNotifyClient, setUpdateNotifyClient] = useState(false);
  const [verdictOptions, setVerdictOptions] = useState<TicketVerdictOption[]>([]);
  const [loadingVerdicts, setLoadingVerdicts] = useState(false);
  const [verdictAttachments, setVerdictAttachments] = useState<File[]>([]);
  const [isDraggingVerdict, setIsDraggingVerdict] = useState(false);
  const {
    isShowing: showVerdictAttachedFeedback,
    isExiting: verdictAttachedExiting,
    trigger: triggerVerdictAttachedFeedback,
  } = useUploadFeedback({ duration: 2300, exitDuration: 360 });
  const verdictFileInputRef = useRef<HTMLInputElement>(null);
  const [updateSuccess, setUpdateSuccess] = useState(false);
  const updateSuccessTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const step2EnteredAtRef = useRef<number>(0);

  useEffect(() => {
    return () => {
      if (updateSuccessTimerRef.current) clearTimeout(updateSuccessTimerRef.current);
    };
  }, []);

  const handleOpenUpdateStatusModal = () => {
    const transitions = getAvailableTransitions(ticket?.status ?? "");
    setStepDirection("forward");
    setUpdateStep(1);
    setUpdateTargetStatus(transitions[0]?.target ?? "");
    setUpdateVerdictId("");
    setUpdateComment("");
    setUpdateNotifyClient(false);
    setVerdictAttachments([]);
    setIsDraggingVerdict(false);
    setUpdateSuccess(false);
    if (updateSuccessTimerRef.current) {
      clearTimeout(updateSuccessTimerRef.current);
      updateSuccessTimerRef.current = null;
    }
    setTransitionError(null);
    step2EnteredAtRef.current = 0;
    setShowUpdateStatusModal(true);

    setLoadingVerdicts(true);
    ticketVerdictsApi
      .list({ page: 1, pageSize: 100, status: "activos" })
      .then((res) => setVerdictOptions(res.items.map((v) => ({ id: v.id, name: v.name }))))
      .catch(() => setVerdictOptions([]))
      .finally(() => setLoadingVerdicts(false));
  };

  // La categoria decide que campos pide el paso 2 o 3; se recalcula del estado actual, no del array de mas abajo.
  const updateCategory = getAvailableTransitions(ticket?.status ?? "").find(
    (t) => t.target === updateTargetStatus,
  )?.category;

  const handleContinueUpdateStatus = (event?: React.MouseEvent) => {
    event?.preventDefault();
    if (!updateTargetStatus) {
      setTransitionError("Selecciona una opción");
      triggerSettle();
      return;
    }
    setTransitionError(null);
    step2EnteredAtRef.current = Date.now();
    setStepDirection("forward");
    setUpdateStep(2);
  };

  const handleContinueToStep3 = (event?: React.MouseEvent | React.FormEvent) => {
    event?.preventDefault();
    if (!updateVerdictId) {
      setTransitionError("Selecciona un veredicto");
      triggerSettle();
      return;
    }
    setTransitionError(null);
    step2EnteredAtRef.current = Date.now();
    setStepDirection("forward");
    setUpdateStep(3);
  };

  /** Paso 1: elegir otra opcion limpia lo escrito para la anterior. */
  const handleSelectTarget = (target: string) => {
    if (target !== updateTargetStatus) {
      setUpdateTargetStatus(target);
      setUpdateVerdictId("");
      setUpdateComment("");
    }
    if (transitionError) setTransitionError(null);
  };

  /** Paso 1: doble clic elige y avanza de una vez. */
  const handleSelectTargetAndContinue = (target: string) => {
    setUpdateTargetStatus(target);
    setUpdateVerdictId("");
    setUpdateComment("");
    setTransitionError(null);
    setStepDirection("forward");
    step2EnteredAtRef.current = Date.now();
    setUpdateStep(2);
  };

  const handleBackToStep = (step: 1 | 2) => {
    setTransitionError(null);
    setStepDirection("backward");
    setUpdateStep(step);
  };

  /** Cierra el dialogo cancelando el cierre automatico tras el exito. */
  const dismissUpdateStatusModal = () => {
    if (updateSuccessTimerRef.current) {
      clearTimeout(updateSuccessTimerRef.current);
      updateSuccessTimerRef.current = null;
    }
    setShowUpdateStatusModal(false);
    setUpdateSuccess(false);
  };

  const handleVerdictFilesSelected = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const chosen = Array.from(files);
    const problem = validateAttachments(chosen, verdictAttachments);
    if (problem) {
      setTransitionError(problem);
      triggerSettle();
      return;
    }
    setTransitionError(null);
    setVerdictAttachments((prev) => [...prev, ...chosen]);
    triggerVerdictAttachedFeedback();
  };

  const handleRemoveVerdictFile = (index: number) => {
    if (transitionError) setTransitionError(null);
    setVerdictAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  const handleConfirmUpdateStatus = async (event: React.FormEvent) => {
    event.preventDefault();
    // Previene envíos accidentales disparados inmediatamente al avanzar de paso (doble clic o activación residual)
    if (Date.now() - step2EnteredAtRef.current < 400) {
      return;
    }
    if (updateCategory === "cancelar" && !updateComment.trim()) {
      setTransitionError("Motivo de cancelación requerido");
      triggerSettle();
      return;
    }
    if (updateCategory === "pausar" && !updateComment.trim()) {
      setTransitionError("Motivo de pausa requerido");
      triggerSettle();
      return;
    }
    if (updateCategory === "veredicto") {
      if (!updateVerdictId) {
        setTransitionError("Selecciona un veredicto");
        triggerSettle();
        return;
      }
      if (!updateComment.trim()) {
        setTransitionError("Comentario de veredicto requerido");
        triggerSettle();
        return;
      }
    }

    try {
      setTransitioning(true);
      setTransitionError(null);

      const formData = new FormData();
      formData.append("Status", updateTargetStatus);
      if (updateComment.trim()) formData.append("Reason", updateComment.trim());
      if (updateCategory === "veredicto" && updateVerdictId) {
        formData.append("VerdictId", updateVerdictId);
      }
      if (updateCategory === "cancelar" || updateCategory === "veredicto") {
        formData.append("NotifyClient", updateNotifyClient ? "true" : "false");
      }
      if (updateCategory === "veredicto" && verdictAttachments.length > 0) {
        verdictAttachments.forEach((file) => formData.append("Attachments", file));
      }

      await ticketsApi.updateStatus(ticketId, formData);
      await refreshTicket();
      receipts.done({ action: "estado-ticket", title: "Estado del ticket actualizado", detail: ticket?.number });

      setUpdateSuccess(true);
      if (updateSuccessTimerRef.current) clearTimeout(updateSuccessTimerRef.current);
      updateSuccessTimerRef.current = setTimeout(() => {
        setShowUpdateStatusModal(false);
        setUpdateSuccess(false);
      }, 2200);
    } catch (err) {
      setTransitionError(err instanceof Error ? err.message : "Error al actualizar");
      triggerSettle();
    } finally {
      setTransitioning(false);
    }
  };

  return {
    transitioning,
    transitionError,
    setTransitionError,
    showUpdateStatusModal,
    setShowUpdateStatusModal,
    updateStep,
    stepDirection,
    updateTargetStatus,
    updateVerdictId,
    setUpdateVerdictId,
    updateComment,
    setUpdateComment,
    updateNotifyClient,
    setUpdateNotifyClient,
    verdictOptions,
    loadingVerdicts,
    verdictAttachments,
    isDraggingVerdict,
    setIsDraggingVerdict,
    showVerdictAttachedFeedback,
    verdictAttachedExiting,
    verdictFileInputRef,
    updateSuccess,
    updateCategory,
    handleOpenUpdateStatusModal,
    handleContinueUpdateStatus,
    handleContinueToStep3,
    handleSelectTarget,
    handleSelectTargetAndContinue,
    handleBackToStep,
    dismissUpdateStatusModal,
    handleVerdictFilesSelected,
    handleRemoveVerdictFile,
    handleConfirmUpdateStatus,
  };
}

export type TicketStatusUpdateFlow = ReturnType<typeof useTicketStatusUpdate>;
