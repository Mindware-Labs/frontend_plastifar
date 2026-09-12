import {
  ArrowLeft,
  CheckSquare,
  Clock,
  CornerUpLeft,
  Gavel,
  History,
  Lock,
  Mail,
  Paperclip,
  Plus,
  RefreshCw,
  RotateCcw,
  Send,
  Ticket as TicketIcon,
  X,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ticketsApi } from "../../api/tickets";
import { ticketVerdictsApi } from "../../api/ticketVerdicts";
import { Tabs, TabsList, TabsTrigger } from "../../components/shadcn/tabs";
import { Alert } from "../../components/ui/Alert";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { CheckboxField, SelectField, TextField } from "../../components/ui/Field";
import { LazyBlockEditor } from "../../components/ui/LazyBlockEditor";
import { Modal } from "../../components/ui/Modal";
import { Spinner } from "../../components/ui/Spinner";
import { useSettle } from "../../hooks/useSettle";
import { useAuth } from "../../context/useAuth";
import { useEmailCounts } from "../../context/useEmailCounts";
import { blocksToEmailHtml, blocksToText } from "../../lib/emailHtml";
import { formatBytes, formatDateTime, formatSlaRemaining } from "../../lib/format";
import type {
  TicketAttachmentResponse,
  TicketCreateOptionsResponse,
  TicketDetailResponse,
  TicketStaffOptionResponse,
  TicketTaskCommentResponse,
  TicketTaskResponse,
  TicketVerdictOption,
} from "../../types/api";
import { AttachmentPreviewModal } from "../bandeja/AttachmentPreviewModal";
import { PriorityCell, SlaCell, StatusCell } from "./ticketCells";
import { TaskCommentsAside } from "./TaskCommentsAside";
import { TicketMessageCard } from "./TicketMessageCard";
import { TicketPropertiesAside } from "./TicketPropertiesAside";
import { TicketTasksTab } from "./TicketTasksTab";
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

const PRIORITY_OPTIONS = ["Emergencia", "Alta", "Normal", "Baja"].map((value) => ({ value, label: value }));

/** Paso 1 del dialogo "Actualizar ticket": a que grupo de campos lleva cada transicion en el paso 2. */
type UpdateCategory = "pausar" | "veredicto" | "cancelar" | "otro";

interface StatusTransitionOption {
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
  description: "El ticket no procede. Exige un motivo explicativo.",
  icon: X,
  danger: true,
};

/** Transiciones validas desde el estado actual, para el paso 1 del dialogo "Actualizar ticket". */
function getAvailableTransitions(status: string): StatusTransitionOption[] {
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

const labelClass = "font-heading text-[11.5px] font-semibold text-zinc-500";

const textareaClass =
  "w-full resize-none rounded-lg border border-zinc-200/80 bg-white px-3 py-2 text-[12.5px] leading-relaxed " +
  "text-zinc-900 outline-none transition-all placeholder:text-zinc-400 hover:border-zinc-300 " +
  "focus:border-brand-red focus:ring-2 focus:ring-brand-red/15";

const attachLabelClass =
  "inline-flex h-7 cursor-pointer items-center gap-1.5 rounded-lg border border-zinc-200/80 bg-white px-2.5 " +
  "text-[11.5px] font-medium text-zinc-600 shadow-2xs transition-all hover:border-zinc-300 hover:bg-zinc-50 hover:text-zinc-900 active:scale-95";

const tabTriggerClass =
  "gap-1.5 rounded-md border border-transparent px-2.5 py-1 text-[12.5px] font-medium text-zinc-500 transition-colors duration-150 " +
  "hover:bg-white/60 hover:text-zinc-800 focus-visible:ring-2 focus-visible:ring-brand-red/25 " +
  "data-active:border-zinc-200 data-active:bg-white data-active:font-semibold data-active:text-zinc-900 data-active:shadow-2xs";

/** Cifra que acompaña a cada pestaña: voz de titular, tabular, se apaga cuando la pestaña no está activa. */
const tabCountClass = "font-heading text-[10px] font-bold leading-none tabular-nums text-zinc-400 group-data-active:text-zinc-900";

/** Archivo elegido y aun no enviado: nombre, peso y la cruz para quitarlo. */
function PendingFile({ file, onRemove }: { file: File; onRemove: () => void }) {
  return (
    <span className="inline-flex h-7 items-center gap-1.5 rounded-lg border border-zinc-200/80 bg-zinc-50/70 px-2.5 text-[11.5px] font-medium text-zinc-800 shadow-2xs">
      <Paperclip aria-hidden className="h-3 w-3 text-zinc-400" />
      <span className="max-w-[180px] truncate">{file.name}</span>
      <span className="text-[10.5px] tabular-nums text-zinc-400">{formatBytes(file.size)}</span>
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Quitar ${file.name}`}
        className="ml-0.5 flex h-4.5 w-4.5 items-center justify-center rounded text-zinc-400 transition-colors hover:bg-zinc-200 hover:text-brand-red cursor-pointer"
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

  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<TicketDetailTab>("conversacion");
  const [tasksCount, setTasksCount] = useState(0);
  const [showTimeline, setShowTimeline] = useState(false);
  const [activeCommentsTask, setActiveCommentsTask] = useState<TicketTaskResponse | null>(null);
  const [latestAddedComment, setLatestAddedComment] = useState<{
    taskId: number;
    comment: TicketTaskCommentResponse;
  } | null>(null);

  const handleToggleTaskComments = useCallback((task: TicketTaskResponse) => {
    setActiveCommentsTask((prev) => (prev?.id === task.id ? null : task));
  }, []);

  const propertiesCardRef = useRef<HTMLDivElement>(null);
  const [propertiesHeight, setPropertiesHeight] = useState<number>(520);

  useEffect(() => {
    const el = propertiesCardRef.current;
    if (!el) return;
    const updateHeight = () => {
      const h = el.offsetHeight;
      if (h > 0) {
        setPropertiesHeight(h);
      }
    };
    updateHeight();
    const observer = new ResizeObserver(() => {
      updateHeight();
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [ticket]);

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

  useEffect(() => {
    if (!ticketId) return;
    ticketsApi.getAssignableStaff(ticketId)
      .then(setAssignableStaff)
      .catch(() => {});
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

  const [updateSettle, triggerUpdateSettle] = useSettle();
  const [assignSettle, triggerAssignSettle] = useSettle();
  const [editSettle, triggerEditSettle] = useSettle();
  const [noteSettle, triggerNoteSettle] = useSettle();

  const saveNote = async () => {
    if (noteSending) return;
    if (!noteBody.trim()) {
      setNoteSendError("Nota requerida");
      triggerNoteSettle();
      return;
    }
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
      setNoteSendError(err instanceof Error ? err.message : "Error al guardar nota");
      triggerNoteSettle();
    } finally {
      setNoteSending(false);
    }
  };

  // Cambio de estado: un dialogo en dos pasos para todas las transiciones validas.
  // Paso 1: eligen la categoria (pausar / marcar veredicto / cancelar / otra). Paso 2: los campos de esa categoria.
  const [transitioning, setTransitioning] = useState(false);
  const [transitionError, setTransitionError] = useState<string | null>(null);
  const [showUpdateStatusModal, setShowUpdateStatusModal] = useState(false);
  const [updateStep, setUpdateStep] = useState<1 | 2>(1);
  const [updateTargetStatus, setUpdateTargetStatus] = useState("");
  const [updateVerdictId, setUpdateVerdictId] = useState("");
  const [updateComment, setUpdateComment] = useState("");
  const [updateNotifyClient, setUpdateNotifyClient] = useState(false);
  const [verdictOptions, setVerdictOptions] = useState<TicketVerdictOption[]>([]);
  const [loadingVerdicts, setLoadingVerdicts] = useState(false);

  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assignableStaff, setAssignableStaff] = useState<TicketStaffOptionResponse[]>([]);
  const [loadingStaff, setLoadingStaff] = useState(false);
  const [selectedStaffId, setSelectedStaffId] = useState("");
  const [assignComment, setAssignComment] = useState("");
  const [assigning, setAssigning] = useState(false);
  const [assignError, setAssignError] = useState<string | null>(null);

  const handleOpenUpdateStatusModal = () => {
    const transitions = getAvailableTransitions(ticket?.status ?? "");
    setUpdateStep(1);
    setUpdateTargetStatus(transitions[0]?.target ?? "");
    setUpdateVerdictId("");
    setUpdateComment("");
    setUpdateNotifyClient(false);
    setTransitionError(null);
    setShowUpdateStatusModal(true);

    setLoadingVerdicts(true);
    ticketVerdictsApi
      .list({ page: 1, pageSize: 100, status: "activos" })
      .then((res) => setVerdictOptions(res.items.map((v) => ({ id: v.id, name: v.name }))))
      .catch(() => setVerdictOptions([]))
      .finally(() => setLoadingVerdicts(false));
  };

  // La categoria decide que campos pide el paso 2; se recalcula del estado actual, no del array de mas abajo.
  const updateCategory = getAvailableTransitions(ticket?.status ?? "").find(
    (t) => t.target === updateTargetStatus,
  )?.category;

  const handleContinueUpdateStatus = () => {
    if (!updateTargetStatus) {
      setTransitionError("Selecciona una opción");
      triggerUpdateSettle();
      return;
    }
    setTransitionError(null);
    setUpdateStep(2);
  };

  const handleConfirmUpdateStatus = async (event: React.FormEvent) => {
    event.preventDefault();
    if (updateCategory === "cancelar" && !updateComment.trim()) {
      setTransitionError("Motivo de cancelación requerido");
      triggerUpdateSettle();
      return;
    }
    if (updateCategory === "pausar" && !updateComment.trim()) {
      setTransitionError("Motivo de pausa requerido");
      triggerUpdateSettle();
      return;
    }
    if (updateCategory === "veredicto") {
      if (!updateVerdictId) {
        setTransitionError("Selecciona un veredicto");
        triggerUpdateSettle();
        return;
      }
      if (!updateComment.trim()) {
        setTransitionError("Comentario de veredicto requerido");
        triggerUpdateSettle();
        return;
      }
    }

    try {
      setTransitioning(true);
      setTransitionError(null);
      await ticketsApi.updateStatus(ticketId, {
        status: updateTargetStatus,
        reason: updateComment.trim() || undefined,
        verdictId: updateCategory === "veredicto" ? Number(updateVerdictId) : undefined,
        notifyClient:
          updateCategory === "cancelar" || updateCategory === "veredicto" ? updateNotifyClient : undefined,
      });
      setShowUpdateStatusModal(false);
      await refreshTicket();
    } catch (err) {
      setTransitionError(err instanceof Error ? err.message : "Error al actualizar");
      triggerUpdateSettle();
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
      setAssignError(err instanceof Error ? err.message : "Error al asignar");
      triggerAssignSettle();
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
      setEditError("El asunto es obligatorio");
      triggerEditSettle();
      return;
    }
    const currentTopic = editCatalogs?.topics.find((t) => t.id === editTopicId);
    if (currentTopic?.requiresProductLine && !editProductLineId) {
      setEditError("Línea de producto requerida");
      triggerEditSettle();
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
      setEditError(err instanceof Error ? err.message : "Error al actualizar");
      triggerEditSettle();
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
              className="-ml-1.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-zinc-500 outline-none
                transition-colors hover:bg-zinc-100 hover:text-ink focus-visible:ring-2 focus-visible:ring-brand-red/25"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <span className="inline-flex items-center gap-2">
              <span
                aria-hidden
                className="flex size-5 shrink-0 items-center justify-center rounded-md bg-brand-red/10 text-brand-red"
              >
                <TicketIcon className="size-3" strokeWidth={2.25} />
              </span>
              <span className="font-heading text-[11.5px] font-bold tabular-nums tracking-[0.01em] text-zinc-900">
                {ticket.number}
              </span>
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
        <p className="mt-1.5 flex flex-wrap items-center gap-x-1.5 text-[12px] text-zinc-500">
          <span>Creado el {formatDateTime(ticket.createdAt)} por</span>
          <span className="font-medium text-zinc-800">{ticket.createdByStaffName ?? ticket.requesterName ?? "Sistema"}</span>
          <span aria-hidden className="text-zinc-300">·</span>
          <span className="font-heading text-[9.5px] font-bold uppercase tracking-[0.08em] text-zinc-400">{ticket.channel}</span>
        </p>

        <div className="mt-5 flex flex-col gap-8 lg:flex-row lg:items-start">
          <div className="min-w-0 flex-1">
            <Tabs
              value={activeTab}
              onValueChange={(value) => {
                const nextTab = value as TicketDetailTab;
                setActiveTab(nextTab);
                if (nextTab !== "tareas") {
                  setActiveCommentsTask(null);
                }
              }}
            >
              <TabsList className="h-8 rounded-lg border border-zinc-200 bg-zinc-50 p-0.5">
                <TabsTrigger value="conversacion" className={`group ${tabTriggerClass}`}>
                  <Mail aria-hidden className="size-3.5" />
                  Conversación
                  <span className={tabCountClass}>{clientThread.length}</span>
                </TabsTrigger>
                <TabsTrigger value="tareas" className={`group ${tabTriggerClass}`}>
                  <CheckSquare aria-hidden className="size-3.5" />
                  Tareas
                  <span className={tabCountClass}>{tasksCount}</span>
                </TabsTrigger>
                <TabsTrigger value="notas" className={`group ${tabTriggerClass}`}>
                  <Lock aria-hidden className="size-3.5" />
                  Notas internas
                  <span className={tabCountClass}>{internalNotes.length}</span>
                </TabsTrigger>
              </TabsList>
            </Tabs>

            {activeTab === "conversacion" && (
              <div className="mt-3.5 space-y-2.5">
                {/* La accion encabeza el hilo; el editor se pide, no esta siempre puesto. */}
                <div className="flex items-center gap-3">
                  <span className="shrink-0 font-heading text-[10px] font-bold uppercase tracking-[0.08em] tabular-nums text-zinc-400">
                    {clientThread.length} {clientThread.length === 1 ? "mensaje" : "mensajes"}
                  </span>
                  <span aria-hidden className="h-px flex-1 bg-zinc-200/70" />
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => setReplyOpen(true)}
                    disabled={!recipientEmail}
                    title={recipientEmail ? undefined : "Sin correo de contacto no se puede enviar la respuesta."}
                  >
                    <CornerUpLeft className="h-[14px] w-[14px]" />
                    Responder
                  </Button>
                </div>

                {clientThread.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-zinc-200 bg-zinc-50/50 px-6 py-8 text-center">
                    <div className="mx-auto flex size-9 items-center justify-center rounded-lg bg-brand-red/10 text-brand-red">
                      <Mail className="size-4" strokeWidth={2.25} />
                    </div>
                    <p className="mt-2.5 font-heading text-[14px] font-semibold text-zinc-800">
                      Todavía no hay conversación
                    </p>
                    <p className="mx-auto mt-1 max-w-sm text-[12px] leading-relaxed text-zinc-500">
                      Ni el cliente ha escrito ni se le ha respondido. Lo que envíes desde aquí le llegará por correo y
                      quedará registrado en este hilo.
                    </p>
                  </div>
                ) : (
                  renderThread(clientThread)
                )}
              </div>
            )}

            {activeTab === "tareas" && (
              <TicketTasksTab
                ticketId={ticket.id}
                isClosed={isClosed}
                assignableStaff={assignableStaff}
                currentStaffId={user?.staffId ?? 0}
                onTasksCountChanged={setTasksCount}
                activeCommentsTaskId={activeCommentsTask?.id}
                onToggleTaskComments={handleToggleTaskComments}
                latestAddedComment={latestAddedComment}
              />
            )}

            {activeTab === "notas" && (
              <div className="mt-3.5 space-y-2.5">
                {internalNotes.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-amber-200/80 bg-amber-50/20 px-6 py-8 text-center">
                    <div className="mx-auto flex size-9 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
                      <Lock className="size-4" strokeWidth={2.25} />
                    </div>
                    <p className="mt-2.5 font-heading text-[14px] font-semibold text-zinc-800">
                      Nada anotado todavía
                    </p>
                    <p className="mx-auto mt-1 max-w-sm text-[12px] leading-relaxed text-zinc-500">
                      Aquí queda lo que el equipo necesita saber y el cliente no: cómo fue la llamada, qué se intentó
                      ya, con quién quedó pendiente. Nunca sale por correo.
                    </p>
                    <Button type="button" size="sm" onClick={() => setShowNoteModal(true)} className="mt-4">
                      <Plus className="h-[14px] w-[14px]" />
                      Añadir nota
                    </Button>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1.5 font-heading text-[10px] font-bold uppercase tracking-[0.08em] tabular-nums text-zinc-400">
                        <Lock className="h-3 w-3 text-amber-600" />
                        <span>{internalNotes.length} {internalNotes.length === 1 ? "nota interna" : "notas internas"}</span>
                      </div>
                      <span aria-hidden className="h-px flex-1 bg-zinc-200/70" />
                      <Button type="button" size="sm" onClick={() => setShowNoteModal(true)}>
                        <Plus className="h-[14px] w-[14px]" />
                        Añadir nota
                      </Button>
                    </div>
                    {renderThread(internalNotes)}
                  </>
                )}
              </div>
            )}
          </div>

          {activeCommentsTask ? (
            <TaskCommentsAside
              key={`task-comments-${activeCommentsTask.id}`}
              ticketId={ticket.id}
              task={activeCommentsTask}
              currentStaffId={user?.staffId ?? 0}
              currentStaffName={
                [user?.firstName, user?.lastName].filter(Boolean).join(" ") || "Usuario"
              }
              onClose={() => setActiveCommentsTask(null)}
              onCommentAdded={(taskId, newComment) => {
                setActiveCommentsTask((prev) =>
                  prev && prev.id === taskId
                    ? {
                        ...prev,
                        comments: [...prev.comments, newComment],
                      }
                    : prev,
                );
                setLatestAddedComment({
                  taskId,
                  comment: newComment,
                });
              }}
              targetHeight={propertiesHeight}
              className="w-full shrink-0 border-t border-zinc-200/80 pt-6 lg:w-[350px] lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0 lg:sticky lg:top-16 self-start"
            />
          ) : (
            <TicketPropertiesAside
              ticket={ticket}
              sla={sla}
              canEdit={!isClosed}
              canAssign={ticket.status !== "Cancelado"}
              onEdit={() => void handleOpenEditModal()}
              onAssign={() => void handleOpenAssignModal()}
              onOpenAttachment={openAttachment}
              innerCardRef={propertiesCardRef}
              className="w-full shrink-0 border-t border-zinc-200/80 pt-6 lg:w-[350px] lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0 lg:sticky lg:top-16 self-start animate-plf-side-panel-back"
            />
          )}
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
              className="-mr-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-subtle outline-none
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
                onChange={(blocks) => {
                  setReplyBlocks(blocks);
                  if (replySendError) setReplySendError(null);
                }}
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

            <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <input
                  ref={replyFileInputRef}
                  id="reply-attachment-input"
                  type="file"
                  multiple
                  className="hidden"
                  onChange={(event) => {
                    pickFiles(event.target, replyAttachments, setReplyAttachments, setReplySendError);
                    if (replySendError) setReplySendError(null);
                  }}
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
                  disabled={!replyReady && !replySendError}
                  tone={replySendError ? "ink" : "primary"}
                  toneLabel={replySendError}
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
          settle={noteSettle}
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
                disabled={!noteBody.trim() && !noteSendError}
                tone={noteSendError ? "ink" : "primary"}
                toneLabel={noteSendError}
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
              onChange={(event) => {
                setNoteBody(event.target.value);
                if (noteSendError) setNoteSendError(null);
              }}
              onKeyDown={(event) => {
                // Escribir y guardar sin soltar el teclado: es el gesto de cualquier campo de notas.
                if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
                  event.preventDefault();
                  void saveNote();
                }
              }}
              placeholder="Lo que el equipo debe saber sobre este caso…"
              className={`${textareaClass} ${
                noteSendError ? "border-brand-red ring-3 ring-brand-red/10 focus:border-brand-red" : ""
              }`}
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
          </div>
        </Modal>
      )}

      {/* Dos pasos: primero eligen que hacer (pausar / marcar veredicto / cancelar / otra), luego
          completan los campos de esa categoria. Cancelado y veredicto pueden avisar al cliente por correo. */}
      {showUpdateStatusModal && (
        <Modal
          settle={updateSettle}
          eyebrow={ticket.number}
          title="Actualizar ticket"
          description={updateStep === 1 ? "Elige qué hacer con este ticket." : "Completa los datos para confirmar."}
          maxWidth="max-w-md"
          onClose={() => {
            if (!transitioning) setShowUpdateStatusModal(false);
          }}
          footer={
            updateStep === 1 ? (
              <>
                <Button type="button" variant="secondary" size="sm" onClick={() => setShowUpdateStatusModal(false)}>
                  Cancelar
                </Button>
                <Button
                  type="button"
                  size="sm"
                  disabled={!updateTargetStatus && !transitionError}
                  tone={transitionError ? "ink" : "primary"}
                  toneLabel={transitionError}
                  onClick={handleContinueUpdateStatus}
                >
                  Continuar
                </Button>
              </>
            ) : (
              <>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={transitioning}
                  onClick={() => setUpdateStep(1)}
                >
                  Atrás
                </Button>
                <Button
                  type="submit"
                  form="update-status-form"
                  size="sm"
                  variant={updateCategory === "cancelar" ? "danger" : "primary"}
                  isLoading={transitioning}
                  tone={transitionError ? "ink" : "primary"}
                  toneLabel={transitionError}
                >
                  {updateCategory === "cancelar" ? "Cancelar ticket" : "Confirmar"}
                </Button>
              </>
            )
          }
        >
          {updateStep === 1 ? (
            <div className="space-y-3">
              <div role="radiogroup" aria-label="Nueva situación" className="space-y-1.5">
                {availableTransitions.map((option) => {
                  const isSelected = updateTargetStatus === option.target;
                  const OptionIcon = option.icon;
                  return (
                    <button
                      key={option.target}
                      type="button"
                      role="radio"
                      aria-checked={isSelected}
                      onClick={() => {
                        setUpdateTargetStatus(option.target);
                        if (transitionError) setTransitionError(null);
                      }}
                      className={`flex w-full items-start gap-2.5 rounded-lg border p-2.5 text-left outline-none transition-all cursor-pointer
                        focus-visible:ring-2 focus-visible:ring-brand-red/20 ${
                          isSelected
                            ? "border-brand-red bg-brand-red/[0.04] shadow-2xs"
                            : "border-zinc-200/80 hover:border-zinc-300 hover:bg-zinc-50"
                        }`}
                    >
                      <OptionIcon
                        aria-hidden
                        className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${option.danger ? "text-brand-red" : "text-zinc-500"}`}
                      />
                      <span>
                        <span className="block text-[12.5px] font-semibold text-zinc-900">{option.label}</span>
                        <span className="block text-[11px] text-zinc-500 leading-tight mt-0.5">{option.description}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <form id="update-status-form" onSubmit={handleConfirmUpdateStatus} className="space-y-3">
              {updateCategory === "veredicto" && (
                <SelectField
                  id="update-verdict"
                  label="Veredicto"
                  size="sm"
                  required
                  placeholder={loadingVerdicts ? "Cargando…" : "Selecciona un veredicto"}
                  value={updateVerdictId}
                  onChange={(val) => {
                    setUpdateVerdictId(val);
                    if (transitionError) setTransitionError(null);
                  }}
                  state={transitionError && !updateVerdictId ? "error" : "idle"}
                  options={verdictOptions.map((v) => ({ value: String(v.id), label: v.name }))}
                  hint={
                    !loadingVerdicts && verdictOptions.length === 0
                      ? "No hay veredictos activos en el catálogo. Créalos en Tickets · Veredictos."
                      : undefined
                  }
                />
              )}

              <div className="flex flex-col gap-1">
                <label htmlFor="update-comment" className={labelClass}>
                  {updateCategory === "cancelar"
                    ? "Motivo de cancelación"
                    : updateCategory === "pausar"
                      ? "Motivo de la pausa"
                      : updateCategory === "veredicto"
                        ? "Comentario del veredicto"
                        : "Comentario"}
                  {updateCategory === "cancelar" || updateCategory === "pausar" || updateCategory === "veredicto" ? (
                    <span className="ml-1 text-brand-red">*</span>
                  ) : (
                    <span className="ml-1 font-normal text-zinc-400">(opcional)</span>
                  )}
                </label>
                <textarea
                  id="update-comment"
                  rows={3}
                  value={updateComment}
                  onChange={(event) => {
                    setUpdateComment(event.target.value);
                    if (transitionError) setTransitionError(null);
                  }}
                  placeholder={
                    updateCategory === "cancelar"
                      ? "Explica por qué se cancela este ticket…"
                      : updateCategory === "pausar"
                        ? "Explica por qué se pausa este ticket…"
                        : updateCategory === "veredicto"
                          ? "Explica el veredicto…"
                          : "Contexto adicional para el historial del ticket…"
                  }
                  className={`${textareaClass} ${
                    transitionError &&
                    !updateComment.trim() &&
                    (updateCategory === "cancelar" || updateCategory === "pausar" || updateCategory === "veredicto")
                      ? "border-brand-red ring-3 ring-brand-red/10 focus:border-brand-red"
                      : ""
                  }`}
                />
              </div>

              {(updateCategory === "cancelar" || updateCategory === "veredicto") && (
                <CheckboxField
                  label="Notificar al cliente por correo"
                  description={
                    recipientEmail
                      ? `Se le avisará a ${recipientEmail}.`
                      : "Este ticket no tiene un correo de contacto registrado."
                  }
                  checked={updateNotifyClient}
                  disabled={!recipientEmail}
                  onChange={(event) => setUpdateNotifyClient(event.target.checked)}
                />
              )}
            </form>
          )}
        </Modal>
      )}

      {showAssignModal && (
        <Modal
          settle={assignSettle}
          eyebrow={ticket.number}
          title="Asignar ticket"
          description="Solo aparecen colaboradores activos con acceso al departamento del ticket."
          maxWidth="max-w-md"
          onClose={() => {
            if (!assigning) setShowAssignModal(false);
          }}
          footer={
            <>
              <Button type="button" variant="secondary" size="sm" disabled={assigning} onClick={() => setShowAssignModal(false)}>
                Cancelar
              </Button>
              <Button
                type="submit"
                form="assign-ticket-form"
                size="sm"
                isLoading={assigning}
                tone={assignError ? "ink" : "primary"}
                toneLabel={assignError}
              >
                Guardar asignación
              </Button>
            </>
          }
        >
          <form id="assign-ticket-form" onSubmit={handleConfirmAssign} className="space-y-3">
            {loadingStaff ? (
              <div className="flex justify-center py-6">
                <Spinner size="sm" label="Cargando colaboradores…" />
              </div>
            ) : (
              <>
                <SelectField
                  id="assign-staff-select"
                  label="Colaborador"
                  size="sm"
                  value={selectedStaffId}
                  onChange={(val) => {
                    setSelectedStaffId(val);
                    if (assignError) setAssignError(null);
                  }}
                  options={[
                    { value: "", label: "Sin asignar" },
                    ...assignableStaff.map((s) => ({ value: String(s.id), label: s.fullName })),
                  ]}
                />
                <TextField
                  id="assign-comment-input"
                  label="Comentario"
                  size="sm"
                  hint="Opcional: por qué cambia la persona responsable."
                  value={assignComment}
                  onChange={(event) => {
                    setAssignComment(event.target.value);
                    if (assignError) setAssignError(null);
                  }}
                  placeholder="Ej.: reasignado para soporte de producto"
                />
              </>
            )}
          </form>
        </Modal>
      )}

      {showEditModal && (
        <Modal
          settle={editSettle}
          eyebrow={ticket.number}
          title="Editar clasificación y detalles"
          description="Ajusta el asunto y la clasificación. El SLA se recalcula automáticamente."
          maxWidth="max-w-md"
          onClose={() => {
            if (!savingEdit) setShowEditModal(false);
          }}
          footer={
            <>
              <Button type="button" variant="secondary" size="sm" disabled={savingEdit} onClick={() => setShowEditModal(false)}>
                Cancelar
              </Button>
              <Button
                type="submit"
                form="edit-ticket-form"
                size="sm"
                isLoading={savingEdit}
                tone={editError ? "ink" : "primary"}
                toneLabel={editError}
              >
                Guardar cambios
              </Button>
            </>
          }
        >
          <form id="edit-ticket-form" onSubmit={handleConfirmEdit} className="space-y-3">
            {loadingEditCatalogs ? (
              <div className="flex justify-center py-6">
                <Spinner size="sm" label="Cargando catálogos…" />
              </div>
            ) : (
              <>
                <TextField
                  id="edit-subject"
                  label="Asunto"
                  size="sm"
                  required
                  maxLength={200}
                  value={editSubject}
                  onChange={(event) => {
                    setEditSubject(event.target.value);
                    if (editError) setEditError(null);
                  }}
                  state={editError && !editSubject.trim() ? "error" : "idle"}
                  placeholder="Describe brevemente el caso…"
                />

                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                  <SelectField
                    id="edit-topic"
                    label="Motivo"
                    size="sm"
                    value={editTopicId !== null ? String(editTopicId) : ""}
                    onChange={(value) => {
                      const nextId = value ? Number(value) : null;
                      setEditTopicId(nextId);
                      if (editError) setEditError(null);
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
                    size="sm"
                    required
                    value={editPriority}
                    onChange={(value) => {
                      setEditPriority(value as TicketDetailResponse["priority"]);
                      if (editError) setEditError(null);
                    }}
                    options={PRIORITY_OPTIONS}
                  />
                  <SelectField
                    id="edit-dept"
                    label="Departamento"
                    size="sm"
                    value={editDepartmentId !== null ? String(editDepartmentId) : ""}
                    onChange={(value) => {
                      setEditDepartmentId(value ? Number(value) : null);
                      if (editError) setEditError(null);
                    }}
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
                    state={editError && editRequiresProductLine && !editProductLineId ? "error" : "idle"}
                    value={editProductLineId !== null ? String(editProductLineId) : ""}
                    onChange={(value) => {
                      setEditProductLineId(value ? Number(value) : null);
                      if (editError) setEditError(null);
                    }}
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

                <p className="text-[11px] leading-normal text-zinc-400">
                  Si cambias el departamento y la persona asignada no pertenece al nuevo, quedará sin asignar.
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
