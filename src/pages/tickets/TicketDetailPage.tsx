import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  CornerUpLeft,
  History,
  Lock,
  Mail,
  Package,
  Paperclip,
  Plus,
  RefreshCw,
  RotateCcw,
  Send,
  X,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ticketsApi } from "../../api/tickets";
import { Tabs, TabsList, TabsTrigger } from "../../components/shadcn/tabs";
import { Alert } from "../../components/ui/Alert";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { SelectField, TextField } from "../../components/ui/Field";
import { LazyBlockEditor } from "../../components/ui/LazyBlockEditor";
import { Modal } from "../../components/ui/Modal";
import { Spinner } from "../../components/ui/Spinner";
import { useEmailCounts } from "../../context/useEmailCounts";
import { blocksToEmailHtml, blocksToText } from "../../lib/emailHtml";
import { formatBytes, formatDateTime, formatSlaRemaining } from "../../lib/format";
import type {
  TicketAttachmentResponse,
  TicketCreateOptionsResponse,
  TicketDetailResponse,
  TicketStaffOptionResponse,
} from "../../types/api";
import { AttachmentPreviewModal } from "../bandeja/AttachmentPreviewModal";
import { PriorityCell, SlaCell, StatusCell } from "./ticketCells";
import { TicketMessageCard } from "./TicketMessageCard";
import { TicketPropertiesAside } from "./TicketPropertiesAside";
import { TicketTimelineSheet, type TicketDetailTab, type TimelineItem } from "./TicketTimelineSheet";

/** El atajo se nombra con la tecla que la persona tiene delante, no con las dos. */
const SAVE_SHORTCUT =
  typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.userAgent) ? "⌘ + Enter" : "Ctrl + Enter";

const MAX_SINGLE_ATTACHMENT = 10 * 1024 * 1024;
const MAX_TOTAL_ATTACHMENTS = 25 * 1024 * 1024;

/** Valida un lote nuevo de adjuntos contra el limite individual y el total acumulado. */
function validateAttachments(chosen: File[], existing: File[]): string | null {
  const oversized = chosen.find((f) => f.size > MAX_SINGLE_ATTACHMENT);
  if (oversized) return `El archivo "${oversized.name}" supera el límite individual de 10 MB.`;

  const currentTotal = existing.reduce((acc, f) => acc + f.size, 0);
  const newTotal = chosen.reduce((acc, f) => acc + f.size, 0);
  if (currentTotal + newTotal > MAX_TOTAL_ATTACHMENTS) {
    return "El total de los adjuntos excede los 25 MB permitidos por mensaje.";
  }
  return null;
}

/** Categorias de cierre de un ticket solucionado; viajan dentro del motivo, visibles en el historial. */
const SOLUTION_TYPES = [
  "Consulta resuelta",
  "Reemplazo de producto",
  "Reenvío del pedido",
  "Reembolso",
  "Corrección de información",
  "Otro",
];

const PRIORITY_OPTIONS = ["Emergencia", "Alta", "Normal", "Baja"].map((value) => ({ value, label: value }));

interface StatusTransitionOption {
  target: string;
  label: string;
  description: string;
  icon: typeof Clock;
  danger?: boolean;
}

const CANCEL_TRANSITION: StatusTransitionOption = {
  target: "Cancelado",
  label: "Cancelar ticket",
  description: "Cierre definitivo; exige un motivo explicativo.",
  icon: X,
  danger: true,
};

/** Transiciones validas desde el estado actual, para el dialogo "Actualizar ticket". */
function getAvailableTransitions(status: string): StatusTransitionOption[] {
  switch (status) {
    case "Abierto":
      return [
        {
          target: "En espera del cliente",
          label: "Poner en espera del cliente",
          description: "Pausa el SLA mientras se espera respuesta del cliente.",
          icon: Clock,
        },
        {
          target: "Reenvío de producto",
          label: "Marcar para reenvío de producto",
          description: "Se gestiona un reenvío físico del producto.",
          icon: Package,
        },
        {
          target: "Solucionado",
          label: "Marcar como solucionado",
          description: "Requiere haber enviado antes al menos una respuesta al cliente.",
          icon: CheckCircle2,
        },
        CANCEL_TRANSITION,
      ];
    case "En espera del cliente":
      return [
        {
          target: "Abierto",
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
          label: "Marcar como solucionado",
          description: "Cierra el caso como resuelto.",
          icon: CheckCircle2,
        },
        CANCEL_TRANSITION,
      ];
    case "Solucionado":
      return [
        {
          target: "Abierto",
          label: "Reabrir ticket",
          description: "Incrementa el contador de reaperturas.",
          icon: RotateCcw,
        },
      ];
    default:
      return [];
  }
}

const labelClass = "font-heading text-[11.5px] font-semibold text-faint";

const textareaClass =
  "w-full resize-none rounded-edge border border-line-strong bg-white px-3 py-2.5 text-[13px] leading-relaxed " +
  "text-ink outline-none transition-colors placeholder:text-faint hover:border-zinc-400 " +
  "focus:border-brand-red focus:ring-3 focus:ring-brand-red/10";

const attachLabelClass =
  "inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-edge border border-line-strong bg-white px-2.5 " +
  "text-[11.5px] font-medium text-subtle transition-colors hover:border-zinc-400 hover:bg-canvas hover:text-ink";

const tabTriggerClass =
  "gap-1.5 px-3 text-[11.5px] font-medium text-subtle transition-colors hover:text-ink " +
  "data-active:bg-white data-active:font-semibold data-active:text-brand-red-dark";

/** Archivo elegido y aun no enviado: nombre, peso y la cruz para quitarlo. */
function PendingFile({ file, onRemove }: { file: File; onRemove: () => void }) {
  return (
    <span className="inline-flex h-7 items-center gap-1.5 rounded-edge border border-line bg-white pl-2.5 pr-1 text-[11.5px] text-ink">
      <Paperclip aria-hidden className="h-3 w-3 text-subtle" />
      <span className="max-w-[180px] truncate">{file.name}</span>
      <span className="text-[10.5px] tabular-nums text-subtle">{formatBytes(file.size)}</span>
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Quitar ${file.name}`}
        className="ml-0.5 flex h-5 w-5 items-center justify-center rounded-edge text-subtle transition-colors hover:bg-fill hover:text-brand-red"
      >
        <X className="h-3 w-3" />
      </button>
    </span>
  );
}

export function TicketDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const ticketId = id ? parseInt(id, 10) : 0;

  const [ticket, setTicket] = useState<TicketDetailResponse | null>(null);
  const [loading, setLoading] = useState(Boolean(ticketId));
  const [error, setError] = useState<string | null>(ticketId ? null : "Identificador de ticket no válido.");

  const [activeTab, setActiveTab] = useState<TicketDetailTab>("conversacion");
  const [showTimeline, setShowTimeline] = useState(false);

  // Respuesta al cliente: el mismo editor que la bandeja, porque lo que sale de aqui tambien es un correo.
  const [replyOpen, setReplyOpen] = useState(false);
  const [replyBlocks, setReplyBlocks] = useState<unknown>(null);
  // Remontar el editor es la forma de vaciarlo: su contenido inicial no es controlado.
  const [replyEditorKey, setReplyEditorKey] = useState(0);
  const [replyAttachments, setReplyAttachments] = useState<File[]>([]);
  const [replySending, setReplySending] = useState(false);
  const [replySendError, setReplySendError] = useState<string | null>(null);
  const replyFileInputRef = useRef<HTMLInputElement>(null);

  const [showNoteModal, setShowNoteModal] = useState(false);
  const [noteBody, setNoteBody] = useState("");
  const [noteAttachments, setNoteAttachments] = useState<File[]>([]);
  const [noteSending, setNoteSending] = useState(false);
  const [noteSendError, setNoteSendError] = useState<string | null>(null);
  const noteFileInputRef = useRef<HTMLInputElement>(null);

  // Que adjunto se esta mirando y con que vecinos, para poder saltar entre ellos.
  const [preview, setPreview] = useState<{ attachments: TicketAttachmentResponse[]; index: number } | null>(null);

  const refreshTicket = useCallback(async () => {
    if (!ticketId) return;
    try {
      setTicket(await ticketsApi.getById(ticketId));
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "No se pudo cargar el detalle del ticket o no tienes permiso para acceder a su departamento.",
      );
    }
  }, [ticketId]);

  useEffect(() => {
    if (!ticketId) return;
    let active = true;

    ticketsApi
      .getById(ticketId)
      .then((data) => {
        if (!active) return;
        setTicket(data);
        setError(null);
      })
      .catch((err: unknown) => {
        if (!active) return;
        setError(
          err instanceof Error
            ? err.message
            : "No se pudo cargar el detalle del ticket o no tienes permiso para acceder a su departamento.",
        );
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [ticketId]);

  const { onTicketsChanged, onTicketStatusChanged, onTicketNewMessage } = useEmailCounts();

  useEffect(() => {
    if (!ticketId) return;
    const unsubs = [
      onTicketsChanged(() => void refreshTicket()),
      onTicketStatusChanged((notice) => {
        if (notice.ticketId === ticketId) void refreshTicket();
      }),
      onTicketNewMessage((notice) => {
        if (notice.ticketId === ticketId) void refreshTicket();
      }),
    ];
    return () => unsubs.forEach((unsub) => unsub());
  }, [ticketId, onTicketsChanged, onTicketStatusChanged, onTicketNewMessage, refreshTicket]);

  // El editor tapa la pagina entera: Escape tiene que devolverte a donde estabas.
  useEffect(() => {
    if (!replyOpen) return;
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setReplyOpen(false);
    }
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [replyOpen]);

  function pickFiles(
    input: HTMLInputElement,
    existing: File[],
    setFiles: (update: (prev: File[]) => File[]) => void,
    setFileError: (message: string | null) => void,
  ) {
    if (!input.files) return;
    const chosen = Array.from(input.files);
    const problem = validateAttachments(chosen, existing);
    if (problem) {
      setFileError(problem);
      return;
    }
    setFileError(null);
    setFiles((prev) => [...prev, ...chosen]);
    input.value = "";
  }

  const openAttachment = (attachments: TicketAttachmentResponse[], attachmentId: number) => {
    const index = attachments.findIndex((a) => a.id === attachmentId);
    if (index >= 0) setPreview({ attachments, index });
  };

  const sendReply = async () => {
    if (!replyReady || replySending) return;
    try {
      setReplySending(true);
      setReplySendError(null);

      const formData = new FormData();
      formData.append("Direction", "Saliente");
      formData.append("BodyText", replyText.trim());
      // El formato lo lleva el HTML; el texto plano viaja como alternativa del correo.
      formData.append("BodyHtml", blocksToEmailHtml(replyBlocks));
      replyAttachments.forEach((file) => formData.append("Attachments", file));

      await ticketsApi.createMessage(ticketId, formData);

      setReplyBlocks(null);
      setReplyEditorKey((key) => key + 1);
      setReplyAttachments([]);
      setReplyOpen(false);
      await refreshTicket();
    } catch (err) {
      setReplySendError(err instanceof Error ? err.message : "Ocurrió un error al enviar la respuesta.");
    } finally {
      setReplySending(false);
    }
  };

  const saveNote = async () => {
    if (!noteBody.trim() || noteSending) return;
    try {
      setNoteSending(true);
      setNoteSendError(null);

      const formData = new FormData();
      formData.append("Direction", "Interna");
      formData.append("BodyText", noteBody.trim());
      noteAttachments.forEach((file) => formData.append("Attachments", file));

      await ticketsApi.createMessage(ticketId, formData);

      setNoteBody("");
      setNoteAttachments([]);
      setShowNoteModal(false);
      await refreshTicket();
    } catch (err) {
      setNoteSendError(err instanceof Error ? err.message : "Ocurrió un error al guardar la nota.");
    } finally {
      setNoteSending(false);
    }
  };

  // Cambio de estado: un solo dialogo para todas las transiciones validas.
  const [transitioning, setTransitioning] = useState(false);
  const [transitionError, setTransitionError] = useState<string | null>(null);
  const [showUpdateStatusModal, setShowUpdateStatusModal] = useState(false);
  const [updateTargetStatus, setUpdateTargetStatus] = useState("");
  const [updateSolutionType, setUpdateSolutionType] = useState("");
  const [updateComment, setUpdateComment] = useState("");

  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assignableStaff, setAssignableStaff] = useState<TicketStaffOptionResponse[]>([]);
  const [loadingStaff, setLoadingStaff] = useState(false);
  const [selectedStaffId, setSelectedStaffId] = useState("");
  const [assignComment, setAssignComment] = useState("");
  const [assigning, setAssigning] = useState(false);
  const [assignError, setAssignError] = useState<string | null>(null);

  const handleOpenUpdateStatusModal = () => {
    const transitions = getAvailableTransitions(ticket?.status ?? "");
    setUpdateTargetStatus(transitions[0]?.target ?? "");
    setUpdateSolutionType("");
    setUpdateComment("");
    setTransitionError(null);
    setShowUpdateStatusModal(true);
  };

  const handleConfirmUpdateStatus = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!updateTargetStatus) {
      setTransitionError("Selecciona la nueva situación del ticket.");
      return;
    }
    if (updateTargetStatus === "Cancelado" && !updateComment.trim()) {
      setTransitionError("La cancelación exige un motivo escrito.");
      return;
    }
    if (updateTargetStatus === "Solucionado") {
      if (!updateSolutionType) {
        setTransitionError("Selecciona el tipo de solución.");
        return;
      }
      if (!ticket?.messages.some((m) => m.direction === "Saliente")) {
        setTransitionError("No se puede marcar como solucionado sin haber enviado al menos una respuesta al cliente.");
        return;
      }
    }

    const reason =
      updateTargetStatus === "Solucionado"
        ? `Tipo de solución: ${updateSolutionType}${updateComment.trim() ? ` · Comentario: ${updateComment.trim()}` : ""}`
        : updateComment.trim() || undefined;

    try {
      setTransitioning(true);
      setTransitionError(null);
      await ticketsApi.updateStatus(ticketId, { status: updateTargetStatus, reason });
      setShowUpdateStatusModal(false);
      await refreshTicket();
    } catch (err) {
      setTransitionError(err instanceof Error ? err.message : "Error al actualizar el estado del ticket.");
    } finally {
      setTransitioning(false);
    }
  };

  const handleOpenAssignModal = async () => {
    if (!ticket) return;
    setSelectedStaffId(ticket.assignedStaffId ? String(ticket.assignedStaffId) : "");
    setAssignComment("");
    setAssignError(null);
    setShowAssignModal(true);
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
    } catch (err) {
      setAssignError(err instanceof Error ? err.message : "Error al asignar el ticket.");
    } finally {
      setAssigning(false);
    }
  };

  // Edicion de atributos (PUT /api/tickets/{id}).
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

  const handleOpenEditModal = async () => {
    if (!ticket) return;
    setEditSubject(ticket.subject);
    setEditTopicId(ticket.topicId ?? null);
    setEditPriority(ticket.priority);
    setEditDepartmentId(ticket.departmentId ?? null);
    setEditProductLineId(ticket.productLineId ?? null);
    setEditError(null);
    setShowEditModal(true);

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
      setEditError("El asunto no puede estar vacío.");
      return;
    }
    const currentTopic = editCatalogs?.topics.find((t) => t.id === editTopicId);
    if (currentTopic?.requiresProductLine && !editProductLineId) {
      setEditError(`El motivo «${currentTopic.name}» exige indicar una línea de producto.`);
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
    } catch (err) {
      setEditError(err instanceof Error ? err.message : "Error al actualizar los detalles del ticket.");
    } finally {
      setSavingEdit(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center py-16">
        <Spinner />
      </div>
    );
  }

  if (error || !ticket) {
    return (
      <div className="mx-auto w-full max-w-2xl py-6">
        <Button variant="secondary" size="sm" onClick={() => navigate("/tickets")} className="mb-4">
          <ArrowLeft className="h-4 w-4" />
          Volver a tickets
        </Button>
        <Alert variant="error">
          {error ?? "El ticket solicitado no existe o no tienes acceso a su departamento."}
        </Alert>
      </div>
    );
  }

  const sla = formatSlaRemaining(ticket.resolutionDueAt, Boolean(ticket.pausedAt), ticket.status, ticket.closedAt);
  const availableTransitions = getAvailableTransitions(ticket.status);
  const isClosed = ticket.status === "Cancelado" || ticket.status === "Cerrado";
  const editRequiresProductLine = Boolean(editCatalogs?.topics.find((t) => t.id === editTopicId)?.requiresProductLine);

  const byDate = (a: { createdAt: string }, b: { createdAt: string }) =>
    new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();

  const timeline: TimelineItem[] = [
    ...ticket.messages.map((m): TimelineItem => ({ kind: "message", data: m, createdAt: m.createdAt })),
    ...ticket.events.map((e): TimelineItem => ({ kind: "event", data: e, createdAt: e.createdAt })),
  ].sort(byDate);

  const sortedMessages = [...ticket.messages].sort(byDate);
  const clientThread = sortedMessages.filter((m) => m.direction.toLowerCase() !== "interna");
  const internalNotes = sortedMessages.filter((m) => m.direction.toLowerCase() === "interna");
  const recipientEmail = ticket.contactEmail ?? ticket.requesterEmail ?? null;

  // Se declaran aqui, con el destinatario: sendReply las lee al ejecutarse, no al definirse.
  const replyText = blocksToText(replyBlocks);
  const replyReady = Boolean(recipientEmail) && replyText.trim().length > 0;

  const renderThread = (messages: typeof clientThread) =>
    messages.map((message, index) => (
      <TicketMessageCard
        key={message.id}
        message={message}
        channel={ticket.channel}
        requesterName={ticket.requesterName}
        isLatest={messages.length > 1 && index === messages.length - 1}
        onOpenAttachment={openAttachment}
      />
    ));

  return (
    // -mx-8 anula el relleno lateral del layout: la barra fija corre de borde a borde y el scroll queda en el canto.
    <div className="-mx-8 min-h-0 flex-1 overflow-y-auto pb-12">
      <div className="sticky top-0 z-10 border-b border-line bg-white/95 px-8 py-2.5 backdrop-blur-xs">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1.5">
            <button
              type="button"
              onClick={() => navigate("/tickets")}
              aria-label="Volver a tickets"
              title="Volver a tickets"
              className="-ml-1.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-edge text-brand-gray outline-none
                transition-colors hover:bg-fill hover:text-ink focus-visible:ring-3 focus-visible:ring-brand-red/20"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <span className="font-heading text-[12px] font-semibold tracking-[0.02em] tabular-nums text-ink">
              {ticket.number}
            </span>
            <span aria-hidden className="h-4 w-px bg-line" />
            <StatusCell status={ticket.status} />
            <PriorityCell priority={ticket.priority} />
            <SlaCell sla={sla} />
          </div>

          <div className="flex items-center gap-2">
            <Button type="button" variant="secondary" size="sm" onClick={() => setShowTimeline(true)}>
              <History className="h-[15px] w-[15px]" />
              Historial
              <span className="tabular-nums text-subtle">{timeline.length}</span>
            </Button>
            {availableTransitions.length > 0 ? (
              <Button type="button" size="sm" onClick={handleOpenUpdateStatusModal}>
                <RefreshCw className="h-[15px] w-[15px]" />
                Actualizar ticket
              </Button>
            ) : (
              <span className="text-[12px] text-subtle">Cierre definitivo</span>
            )}
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-8 pt-5">
        <h1 className="text-balance font-heading text-[20px] font-bold leading-snug tracking-[-0.02em] text-ink">
          {ticket.subject}
        </h1>
        <p className="mt-1 text-[12.5px] text-subtle">
          Creado el {formatDateTime(ticket.createdAt)} por{" "}
          <span className="text-ink">{ticket.createdByStaffName ?? ticket.requesterName ?? "Sistema"}</span>
          <span aria-hidden className="mx-1.5 text-line-strong">·</span>
          {ticket.channel}
        </p>

        <div className="mt-5 flex flex-col gap-8 lg:flex-row lg:items-start">
          <div className="min-w-0 flex-1">
            <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as TicketDetailTab)}>
              <TabsList className="h-9 border border-line bg-canvas">
                <TabsTrigger value="conversacion" className={tabTriggerClass}>
                  <Mail aria-hidden className="size-3.5" />
                  Conversación
                  <span className="tabular-nums opacity-70">{clientThread.length}</span>
                </TabsTrigger>
                <TabsTrigger value="notas" className={tabTriggerClass}>
                  <Lock aria-hidden className="size-3.5" />
                  Notas internas
                  <span className="tabular-nums opacity-70">{internalNotes.length}</span>
                </TabsTrigger>
              </TabsList>
            </Tabs>

            {activeTab === "conversacion" && (
              <div className="mt-4 space-y-3">
                {/* La accion encabeza el hilo; el editor se pide, no esta siempre puesto. */}
                <div className="flex items-center gap-3">
                  <span className="shrink-0 text-[11.5px] font-semibold tabular-nums text-subtle">
                    {clientThread.length} {clientThread.length === 1 ? "mensaje" : "mensajes"}
                  </span>
                  <span aria-hidden className="h-px flex-1 bg-line" />
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => setReplyOpen(true)}
                    disabled={!recipientEmail}
                    title={recipientEmail ? undefined : "Sin correo de contacto no se puede enviar la respuesta."}
                  >
                    <CornerUpLeft className="h-[15px] w-[15px]" />
                    Responder
                  </Button>
                </div>

                {clientThread.length === 0 ? (
                  <div className="px-6 pb-4 pt-10 text-center">
                    <Mail className="mx-auto h-6 w-6 text-faint" />
                    <p className="mt-3 font-heading text-[15px] font-semibold tracking-[-0.01em] text-ink">
                      Todavía no hay conversación
                    </p>
                    <p className="mx-auto mt-1.5 max-w-md text-[12.5px] leading-relaxed text-subtle">
                      Ni el cliente ha escrito ni se le ha respondido. Lo que envíes desde aquí le llegará por correo y
                      quedará registrado en este hilo.
                    </p>
                  </div>
                ) : (
                  renderThread(clientThread)
                )}
              </div>
            )}

            {activeTab === "notas" && (
              <div className="mt-4 space-y-3">
                {internalNotes.length === 0 ? (
                  // Sin notas, el vacio es la unica pieza: explica para que sirven y ofrece escribir la primera.
                  <div className="px-6 pb-4 pt-10 text-center">
                    <Lock className="mx-auto h-6 w-6 text-warn" />
                    <p className="mt-3 font-heading text-[15px] font-semibold tracking-[-0.01em] text-ink">
                      Nada anotado todavía
                    </p>
                    <p className="mx-auto mt-1.5 max-w-md text-[12.5px] leading-relaxed text-subtle">
                      Aquí queda lo que el equipo necesita saber y el cliente no: cómo fue la llamada, qué se intentó
                      ya, con quién quedó pendiente. Nunca sale por correo.
                    </p>
                    <Button type="button" size="sm" onClick={() => setShowNoteModal(true)} className="mt-5">
                      <Plus className="h-[15px] w-[15px]" />
                      Añadir nota
                    </Button>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-3">
                      <span className="shrink-0 text-[11.5px] font-semibold tabular-nums text-subtle">
                        {internalNotes.length} {internalNotes.length === 1 ? "nota" : "notas"}
                      </span>
                      <span aria-hidden className="h-px flex-1 bg-line" />
                      <Button type="button" size="sm" onClick={() => setShowNoteModal(true)}>
                        <Plus className="h-[15px] w-[15px]" />
                        Añadir nota
                      </Button>
                    </div>
                    {renderThread(internalNotes)}
                  </>
                )}
              </div>
            )}
          </div>

          <TicketPropertiesAside
            ticket={ticket}
            sla={sla}
            canEdit={!isClosed}
            canAssign={ticket.status !== "Cancelado"}
            onEdit={() => void handleOpenEditModal()}
            onAssign={() => void handleOpenAssignModal()}
            onOpenAttachment={openAttachment}
            className="w-full shrink-0 border-t border-line pt-6 lg:w-[300px] lg:border-l lg:border-t-0 lg:pl-8 lg:pt-0"
          />
        </div>
      </div>

      {/* Responder es la tarea entera, no un apendice del hilo: ocupa la pantalla.
          Cerrar sin enviar conserva el borrador; solo se vacia al salir el correo. */}
      {replyOpen && (
        <div className="fixed inset-0 z-50 flex flex-col bg-white">
          <div className="flex shrink-0 items-start justify-between gap-4 border-b border-line px-6 py-3.5">
            <div className="min-w-0">
              <p className="font-heading text-[11px] font-semibold tracking-[0.02em] tabular-nums text-subtle">
                {ticket.number}
              </p>
              <h2 className="mt-0.5 truncate font-heading text-[17px] font-bold tracking-[-0.01em] text-ink">
                Re: {ticket.subject}
              </h2>
              <p className="mt-0.5 truncate text-[12px] text-subtle">
                Para <span className="font-medium text-ink">{recipientEmail}</span>
              </p>
            </div>
            <button
              type="button"
              onClick={() => !replySending && setReplyOpen(false)}
              aria-label="Cerrar el editor (Esc)"
              className="-mr-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-edge text-subtle outline-none
                transition-colors hover:bg-fill hover:text-ink focus-visible:ring-3 focus-visible:ring-brand-red/20"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div
            className="min-h-0 flex-1 overflow-y-auto"
            onKeyDown={(event) => {
              if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
                event.preventDefault();
                void sendReply();
              }
            }}
          >
            <div className="mx-auto h-full max-w-4xl px-4 py-3">
              <LazyBlockEditor
                key={replyEditorKey}
                initialContent={replyBlocks ?? undefined}
                onChange={setReplyBlocks}
                placeholder="Escribe tu respuesta para el cliente…"
              />
            </div>
          </div>

          <div className="shrink-0 space-y-2.5 border-t border-line bg-canvas/40 px-6 py-3">
            {replyAttachments.length > 0 && (
              <div className="mx-auto flex max-w-4xl flex-wrap gap-2">
                {replyAttachments.map((file, index) => (
                  <PendingFile
                    key={`${file.name}-${index}`}
                    file={file}
                    onRemove={() => setReplyAttachments((prev) => prev.filter((_, i) => i !== index))}
                  />
                ))}
              </div>
            )}

            {replySendError && (
              <div className="mx-auto max-w-4xl">
                <Alert variant="error">{replySendError}</Alert>
              </div>
            )}

            <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <input
                  ref={replyFileInputRef}
                  id="reply-attachment-input"
                  type="file"
                  multiple
                  className="hidden"
                  onChange={(event) =>
                    pickFiles(event.target, replyAttachments, setReplyAttachments, setReplySendError)
                  }
                />
                <label htmlFor="reply-attachment-input" className={attachLabelClass}>
                  <Paperclip className="h-3.5 w-3.5" />
                  Adjuntar
                </label>
                <span className="hidden text-[11px] text-faint sm:inline">{SAVE_SHORTCUT} para enviar</span>
              </div>

              <div className="flex items-center gap-2">
                <Button type="button" variant="secondary" disabled={replySending} onClick={() => setReplyOpen(false)}>
                  Cancelar
                </Button>
                <Button
                  type="button"
                  isLoading={replySending}
                  disabled={!replyReady}
                  onClick={() => void sendReply()}
                >
                  <Send className="h-[15px] w-[15px]" />
                  Enviar respuesta
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Escribir una nota es un acto aparte: se pide, se escribe y se cierra. El borrador sobrevive si se cierra sin guardar. */}
      {showNoteModal && (
        <Modal
          eyebrow={ticket.number}
          title="Añadir nota interna"
          description={
            <span className="inline-flex flex-wrap items-center gap-2">
              <Badge tone="amber">
                <Lock aria-hidden className="mr-1 h-3 w-3" />
                Privada
              </Badge>
              <span>Solo la ve el personal de Plastifar. El cliente no recibe copia.</span>
            </span>
          }
          onClose={() => {
            if (!noteSending) setShowNoteModal(false);
          }}
          footer={
            <>
              <Button type="button" variant="secondary" disabled={noteSending} onClick={() => setShowNoteModal(false)}>
                Cancelar
              </Button>
              <Button
                type="button"
                isLoading={noteSending}
                disabled={!noteBody.trim()}
                onClick={() => void saveNote()}
              >
                Guardar nota
              </Button>
            </>
          }
        >
          <div className="space-y-3">
            <textarea
              autoFocus
              rows={7}
              value={noteBody}
              onChange={(event) => setNoteBody(event.target.value)}
              onKeyDown={(event) => {
                // Escribir y guardar sin soltar el teclado: es el gesto de cualquier campo de notas.
                if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
                  event.preventDefault();
                  void saveNote();
                }
              }}
              placeholder="Lo que el equipo debe saber sobre este caso…"
              className={textareaClass}
            />

            <div className="flex flex-wrap items-center gap-3">
              <input
                ref={noteFileInputRef}
                id="note-attachment-input"
                type="file"
                multiple
                className="hidden"
                onChange={(event) => pickFiles(event.target, noteAttachments, setNoteAttachments, setNoteSendError)}
              />
              <label htmlFor="note-attachment-input" className={attachLabelClass}>
                <Paperclip className="h-3.5 w-3.5" />
                Adjuntar
              </label>
              <span className="text-[11px] text-faint">{SAVE_SHORTCUT} para guardar</span>
            </div>

            {noteAttachments.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {noteAttachments.map((file, index) => (
                  <PendingFile
                    key={`${file.name}-${index}`}
                    file={file}
                    onRemove={() => setNoteAttachments((prev) => prev.filter((_, i) => i !== index))}
                  />
                ))}
              </div>
            )}

            {noteSendError && <Alert variant="error">{noteSendError}</Alert>}
          </div>
        </Modal>
      )}

      {/* Una sola entrada para todas las transiciones: Solucionado pide tipo de solucion,
          Cancelado exige motivo, el resto acepta un comentario opcional. */}
      {showUpdateStatusModal && (
        <Modal
          eyebrow={ticket.number}
          title="Actualizar ticket"
          description="Elige la nueva situación del ticket. Según la opción, se piden datos adicionales."
          onClose={() => {
            if (!transitioning) setShowUpdateStatusModal(false);
          }}
          footer={
            <>
              <Button
                type="button"
                variant="secondary"
                disabled={transitioning}
                onClick={() => setShowUpdateStatusModal(false)}
              >
                Volver
              </Button>
              <Button
                type="submit"
                form="update-status-form"
                variant={updateTargetStatus === "Cancelado" ? "danger" : "primary"}
                isLoading={transitioning}
              >
                {updateTargetStatus === "Cancelado" ? "Cancelar ticket" : "Confirmar"}
              </Button>
            </>
          }
        >
          <form id="update-status-form" onSubmit={handleConfirmUpdateStatus} className="space-y-4">
            {transitionError && <Alert variant="error">{transitionError}</Alert>}

            <div role="radiogroup" aria-label="Nueva situación" className="space-y-2">
              {availableTransitions.map((option) => {
                const isSelected = updateTargetStatus === option.target;
                const OptionIcon = option.icon;
                return (
                  <button
                    key={option.target}
                    type="button"
                    role="radio"
                    aria-checked={isSelected}
                    onClick={() => setUpdateTargetStatus(option.target)}
                    className={`flex w-full items-start gap-3 rounded-edge border p-3 text-left outline-none transition-colors
                      focus-visible:ring-3 focus-visible:ring-brand-red/15 ${
                        isSelected
                          ? "border-brand-red bg-brand-red/[0.04]"
                          : "border-line-strong hover:border-zinc-400 hover:bg-canvas"
                      }`}
                  >
                    <OptionIcon
                      aria-hidden
                      className={`mt-0.5 h-4 w-4 shrink-0 ${option.danger ? "text-brand-red" : "text-brand-gray"}`}
                    />
                    <span>
                      <span className="block text-[13px] font-semibold text-ink">{option.label}</span>
                      <span className="block text-[11.5px] text-subtle">{option.description}</span>
                    </span>
                  </button>
                );
              })}
            </div>

            {updateTargetStatus === "Solucionado" && (
              <SelectField
                id="solution-type"
                label="Tipo de solución"
                required
                placeholder="Selecciona un tipo"
                value={updateSolutionType}
                onChange={setUpdateSolutionType}
                options={SOLUTION_TYPES.map((value) => ({ value, label: value }))}
              />
            )}

            {updateTargetStatus && (
              <div className="flex flex-col gap-1.5">
                <label htmlFor="update-comment" className={labelClass}>
                  {updateTargetStatus === "Cancelado" ? "Motivo de cancelación" : "Comentario"}
                  {updateTargetStatus === "Cancelado" ? (
                    <span className="ml-1 text-brand-red">*</span>
                  ) : (
                    <span className="ml-1 font-normal">(opcional)</span>
                  )}
                </label>
                <textarea
                  id="update-comment"
                  rows={4}
                  required={updateTargetStatus === "Cancelado"}
                  value={updateComment}
                  onChange={(event) => setUpdateComment(event.target.value)}
                  placeholder={
                    updateTargetStatus === "Cancelado"
                      ? "Explica por qué se cancela este ticket…"
                      : "Contexto adicional para el historial del ticket…"
                  }
                  className={textareaClass}
                />
              </div>
            )}
          </form>
        </Modal>
      )}

      {showAssignModal && (
        <Modal
          eyebrow={ticket.number}
          title="Asignar ticket"
          description="Solo aparecen colaboradores activos con acceso al departamento del ticket."
          onClose={() => {
            if (!assigning) setShowAssignModal(false);
          }}
          footer={
            <>
              <Button type="button" variant="secondary" disabled={assigning} onClick={() => setShowAssignModal(false)}>
                Cancelar
              </Button>
              <Button type="submit" form="assign-ticket-form" isLoading={assigning}>
                Guardar asignación
              </Button>
            </>
          }
        >
          <form id="assign-ticket-form" onSubmit={handleConfirmAssign} className="space-y-4">
            {assignError && <Alert variant="error">{assignError}</Alert>}

            {loadingStaff ? (
              <div className="flex justify-center py-8">
                <Spinner size="sm" label="Cargando colaboradores…" />
              </div>
            ) : (
              <>
                <SelectField
                  id="assign-staff-select"
                  label="Colaborador"
                  value={selectedStaffId}
                  onChange={setSelectedStaffId}
                  options={[
                    { value: "", label: "Sin asignar" },
                    ...assignableStaff.map((s) => ({ value: String(s.id), label: s.fullName })),
                  ]}
                />
                <TextField
                  id="assign-comment-input"
                  label="Comentario"
                  hint="Opcional: por qué cambia la persona responsable. Queda en el historial."
                  value={assignComment}
                  onChange={(event) => setAssignComment(event.target.value)}
                  placeholder="Ej.: reasignado para soporte especializado de producto"
                />
              </>
            )}
          </form>
        </Modal>
      )}

      {showEditModal && (
        <Modal
          eyebrow={ticket.number}
          title="Editar ticket"
          description="Asunto, motivo, prioridad, departamento y línea de producto. El SLA se recalcula solo."
          onClose={() => {
            if (!savingEdit) setShowEditModal(false);
          }}
          footer={
            <>
              <Button type="button" variant="secondary" disabled={savingEdit} onClick={() => setShowEditModal(false)}>
                Cancelar
              </Button>
              <Button type="submit" form="edit-ticket-form" isLoading={savingEdit}>
                Guardar cambios
              </Button>
            </>
          }
        >
          <form id="edit-ticket-form" onSubmit={handleConfirmEdit} className="space-y-4">
            {editError && <Alert variant="error">{editError}</Alert>}

            {loadingEditCatalogs ? (
              <div className="flex justify-center py-8">
                <Spinner size="sm" label="Cargando catálogos…" />
              </div>
            ) : (
              <>
                <TextField
                  id="edit-subject"
                  label="Asunto"
                  required
                  maxLength={200}
                  value={editSubject}
                  onChange={(event) => setEditSubject(event.target.value)}
                />

                <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
                  <SelectField
                    id="edit-topic"
                    label="Motivo"
                    size="sm"
                    value={editTopicId !== null ? String(editTopicId) : ""}
                    onChange={(value) => {
                      const nextId = value ? Number(value) : null;
                      setEditTopicId(nextId);
                      // El motivo trae su departamento y prioridad por defecto; se pueden corregir despues.
                      const topic = nextId ? editCatalogs?.topics.find((t) => t.id === nextId) : undefined;
                      if (topic?.defaultDepartmentId) setEditDepartmentId(topic.defaultDepartmentId);
                      if (topic?.defaultPriority) setEditPriority(topic.defaultPriority);
                    }}
                    placeholder="Sin motivo"
                    options={[
                      { value: "", label: "Sin motivo" },
                      ...(editCatalogs?.topics ?? []).map((t) => ({ value: String(t.id), label: t.name })),
                    ]}
                  />
                  <SelectField
                    id="edit-priority"
                    label="Prioridad"
                    required
                    size="sm"
                    value={editPriority}
                    onChange={setEditPriority}
                    options={PRIORITY_OPTIONS}
                  />
                  <SelectField
                    id="edit-dept"
                    label="Departamento"
                    size="sm"
                    value={editDepartmentId !== null ? String(editDepartmentId) : ""}
                    onChange={(value) => setEditDepartmentId(value ? Number(value) : null)}
                    placeholder="Sin departamento"
                    options={[
                      { value: "", label: "Sin departamento" },
                      ...(editCatalogs?.departments ?? []).map((d) => ({ value: String(d.id), label: d.name })),
                    ]}
                  />
                  <SelectField
                    id="edit-line"
                    label="Línea de producto"
                    size="sm"
                    required={editRequiresProductLine}
                    value={editProductLineId !== null ? String(editProductLineId) : ""}
                    onChange={(value) => setEditProductLineId(value ? Number(value) : null)}
                    placeholder="No aplica"
                    options={[
                      { value: "", label: "No aplica" },
                      ...(editCatalogs?.productLines ?? []).map((line) => ({
                        value: String(line.id),
                        label: `${line.name} (${line.code})`,
                      })),
                    ]}
                  />
                </div>

                <p className="text-[11.5px] leading-relaxed text-faint">
                  Si cambias el departamento y la persona asignada no pertenece al nuevo, queda sin asignar.
                </p>
              </>
            )}
          </form>
        </Modal>
      )}

      {/* El mismo visor de la bandeja: se ve dentro y, si hace falta, se descarga desde ahi. */}
      {preview && (
        <AttachmentPreviewModal
          sourceId={ticketId}
          loadLink={(attachmentId, download) => ticketsApi.attachmentLink(ticketId, attachmentId, download)}
          attachments={preview.attachments}
          index={preview.index}
          onIndexChange={(index) => setPreview({ ...preview, index })}
          onClose={() => setPreview(null)}
        />
      )}

      {showTimeline && (
        <TicketTimelineSheet
          ticket={ticket}
          timeline={timeline}
          onOpenAttachment={openAttachment}
          onClose={() => setShowTimeline(false)}
          onSelectTab={setActiveTab}
        />
      )}
    </div>
  );
}
