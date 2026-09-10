import {
  AlertTriangle,
  ArrowLeft,
  Building2,
  CheckCircle2,
  Clock,
  Download,
  FileText,
  History,
  Info,
  Lock,
  Mail,
  Package,
  Paperclip,
  Pencil,
  Phone,
  RefreshCw,
  RotateCcw,
  Send,
  ShieldAlert,
  Tag,
  User,
  UserCheck,
  X,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ticketsApi } from "../../api/tickets";
import { useEmailCounts } from "../../context/useEmailCounts";
import { Alert } from "../../components/ui/Alert";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { SelectField, TextField } from "../../components/ui/Field";
import { Modal } from "../../components/ui/Modal";
import { Spinner } from "../../components/ui/Spinner";
import { formatDateTime, formatSlaRemaining } from "../../lib/format";
import type {
  TicketAttachmentResponse,
  TicketCreateOptionsResponse,
  TicketDetailResponse,
  TicketEventResponse,
  TicketMessageResponse,
  TicketStaffOptionResponse,
} from "../../types/api";

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getInitials(name?: string | null): string {
  if (!name) return "";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

function priorityClasses(priority: string): string {
  switch (priority.toLowerCase()) {
    case "emergencia":
      return "bg-red-50 text-red-700 border-red-200 font-semibold";
    case "alta":
      return "bg-amber-50 text-amber-800 border-amber-200";
    case "normal":
      return "bg-slate-50 text-slate-700 border-slate-200";
    case "baja":
      return "bg-gray-50 text-gray-600 border-gray-200";
    default:
      return "bg-slate-50 text-slate-700 border-slate-200";
  }
}

function statusDotColor(status: string): string {
  switch (status.toLowerCase()) {
    case "abierto":
      return "bg-emerald-500";
    case "en espera del cliente":
    case "en-espera":
      return "bg-amber-500";
    case "reenvío de producto":
    case "reenvio de producto":
      return "bg-indigo-500";
    case "solucionado":
      return "bg-blue-500";
    case "cancelado":
      return "bg-rose-500";
    default:
      return "bg-slate-400";
  }
}

type TimelineItem =
  | { kind: "message"; data: TicketMessageResponse; createdAt: string }
  | { kind: "event"; data: TicketEventResponse; createdAt: string };

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

/** Estados alcanzables desde el estado actual, para el selector del redactor de respuestas. */
function nextStatusOptions(status: string): string[] {
  switch (status) {
    case "Abierto":
      return ["En espera del cliente", "Reenvío de producto", "Solucionado"];
    case "En espera del cliente":
      return ["Abierto"];
    case "Reenvío de producto":
      return ["Solucionado"];
    default:
      return [];
  }
}

/** Categorías de cierre para un ticket solucionado (sin catálogo propio en el backend
 * aún: se envían como parte del texto de motivo, visible en el historial del ticket). */
const SOLUTION_TYPES = [
  "Consulta resuelta",
  "Reemplazo de producto",
  "Reenvío del pedido",
  "Reembolso",
  "Corrección de información",
  "Otro",
];

interface StatusTransitionOption {
  target: string;
  label: string;
  description: string;
  icon: typeof Clock;
  danger?: boolean;
}

/** Transiciones válidas desde el estado actual, para el modal "Actualizar ticket"
 * (sustituye a los botones sueltos de En espera / Reenvío / Solucionar / Cancelar). */
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
        {
          target: "Cancelado",
          label: "Cancelar ticket",
          description: "Cierre definitivo; exige un motivo explicativo.",
          icon: X,
          danger: true,
        },
      ];
    case "En espera del cliente":
      return [
        {
          target: "Abierto",
          label: "Reanudar a Abierto",
          description: "Reanuda la atención y el cómputo de SLA.",
          icon: RotateCcw,
        },
        {
          target: "Cancelado",
          label: "Cancelar ticket",
          description: "Cierre definitivo; exige un motivo explicativo.",
          icon: X,
          danger: true,
        },
      ];
    case "Reenvío de producto":
      return [
        {
          target: "Solucionado",
          label: "Marcar como solucionado",
          description: "Cierra el caso como resuelto.",
          icon: CheckCircle2,
        },
        {
          target: "Cancelado",
          label: "Cancelar ticket",
          description: "Cierre definitivo; exige un motivo explicativo.",
          icon: X,
          danger: true,
        },
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

export function TicketDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const ticketId = id ? parseInt(id, 10) : 0;

  const [ticket, setTicket] = useState<TicketDetailResponse | null>(null);
  const [loading, setLoading] = useState(Boolean(ticketId));
  const [error, setError] = useState<string | null>(
    ticketId ? null : "Identificador de ticket no válido.",
  );

  // Navegación por pestañas: Información general, Responder al cliente, Notas internas
  const [activeTab, setActiveTab] = useState<"general" | "respuestas" | "notas">("general");

  // Pestaña lateral (Drawer) para el Historial Completo del ticket
  const [showTimelineDrawer, setShowTimelineDrawer] = useState(false);
  const [timelineFilter, setTimelineFilter] = useState<"all" | "messages" | "events">("all");

  // Composer: Respuesta al cliente (modo correo)
  const [replyBody, setReplyBody] = useState("");
  const [replyStatusChange, setReplyStatusChange] = useState<string>("");
  const [replyAttachments, setReplyAttachments] = useState<File[]>([]);
  const [replySending, setReplySending] = useState(false);
  const [replySendError, setReplySendError] = useState<string | null>(null);
  const replyFileInputRef = useRef<HTMLInputElement>(null);

  // Composer: Nota interna
  const [noteBody, setNoteBody] = useState("");
  const [noteAttachments, setNoteAttachments] = useState<File[]>([]);
  const [noteSending, setNoteSending] = useState(false);
  const [noteSendError, setNoteSendError] = useState<string | null>(null);
  const noteFileInputRef = useRef<HTMLInputElement>(null);

  const [downloadingId, setDownloadingId] = useState<number | null>(null);

  const refreshTicket = useCallback(async () => {
    if (!ticketId) return;
    try {
      const data = await ticketsApi.getById(ticketId);
      setTicket(data);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "No se pudo cargar el detalle del ticket o no tienes permiso para acceder a su departamento.",
      );
    }
  }, [ticketId]);

  useEffect(() => {
    let active = true;
    if (!ticketId) return;

    ticketsApi
      .getById(ticketId)
      .then((data) => {
        if (active) {
          setTicket(data);
          setError(null);
        }
      })
      .catch((err: unknown) => {
        if (active) {
          setError(
            err instanceof Error
              ? err.message
              : "No se pudo cargar el detalle del ticket o no tienes permiso para acceder a su departamento.",
          );
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [ticketId]);

  // Manejador para cerrar la pestaña lateral de historial con tecla Escape y bloquear el scroll de fondo
  useEffect(() => {
    if (!showTimelineDrawer) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setShowTimelineDrawer(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [showTimelineDrawer]);

  const { onTicketsChanged, onTicketStatusChanged, onTicketNewMessage } = useEmailCounts();

  useEffect(() => {
    if (!ticketId) return;

    const unsubs = [
      onTicketsChanged(() => {
        void refreshTicket();
      }),
      onTicketStatusChanged((notice) => {
        if (notice.ticketId === ticketId) {
          void refreshTicket();
        }
      }),
      onTicketNewMessage((notice) => {
        if (notice.ticketId === ticketId) {
          void refreshTicket();
        }
      }),
    ];

    return () => {
      unsubs.forEach((unsub) => unsub());
    };
  }, [ticketId, onTicketsChanged, onTicketStatusChanged, onTicketNewMessage, refreshTicket]);

  const handleReplyFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const chosen = Array.from(e.target.files);
    const err = validateAttachments(chosen, replyAttachments);
    if (err) {
      setReplySendError(err);
      return;
    }
    setReplySendError(null);
    setReplyAttachments((prev) => [...prev, ...chosen]);
    if (replyFileInputRef.current) replyFileInputRef.current.value = "";
  };

  const removeReplyFile = (index: number) => {
    setReplyAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  const handleNoteFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const chosen = Array.from(e.target.files);
    const err = validateAttachments(chosen, noteAttachments);
    if (err) {
      setNoteSendError(err);
      return;
    }
    setNoteSendError(null);
    setNoteAttachments((prev) => [...prev, ...chosen]);
    if (noteFileInputRef.current) noteFileInputRef.current.value = "";
  };

  const removeNoteFile = (index: number) => {
    setNoteAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  const handleDownloadAttachment = async (attachment: TicketAttachmentResponse) => {
    try {
      setDownloadingId(attachment.id);
      const link = await ticketsApi.attachmentLink(ticketId, attachment.id, true);
      window.open(link.url, "_blank");
    } catch {
      alert("No se pudo generar el enlace de descarga.");
    } finally {
      setDownloadingId(null);
    }
  };

  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyBody.trim()) {
      setReplySendError("Escribe el contenido de la respuesta.");
      return;
    }

    try {
      setReplySending(true);
      setReplySendError(null);

      const formData = new FormData();
      formData.append("Direction", "Saliente");
      formData.append("BodyText", replyBody.trim());
      if (replyStatusChange) {
        formData.append("Status", replyStatusChange);
      }
      replyAttachments.forEach((file) => {
        formData.append("Attachments", file);
      });

      await ticketsApi.createMessage(ticketId, formData);

      setReplyBody("");
      setReplyAttachments([]);
      setReplyStatusChange("");
      await refreshTicket();
    } catch (err) {
      setReplySendError(
        err instanceof Error ? err.message : "Ocurrió un error al enviar la respuesta.",
      );
    } finally {
      setReplySending(false);
    }
  };

  const handleSaveNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteBody.trim()) {
      setNoteSendError("Escribe el contenido de la nota.");
      return;
    }

    try {
      setNoteSending(true);
      setNoteSendError(null);

      const formData = new FormData();
      formData.append("Direction", "Interna");
      formData.append("BodyText", noteBody.trim());
      noteAttachments.forEach((file) => {
        formData.append("Attachments", file);
      });

      await ticketsApi.createMessage(ticketId, formData);

      setNoteBody("");
      setNoteAttachments([]);
      await refreshTicket();
    } catch (err) {
      setNoteSendError(
        err instanceof Error ? err.message : "Ocurrió un error al guardar la nota.",
      );
    } finally {
      setNoteSending(false);
    }
  };

  // Actualización de estado: un único modal reemplaza los botones sueltos de
  // En espera / Reenvío / Solucionar / Cancelar.
  const [transitioning, setTransitioning] = useState(false);
  const [transitionError, setTransitionError] = useState<string | null>(null);
  const [showUpdateStatusModal, setShowUpdateStatusModal] = useState(false);
  const [updateTargetStatus, setUpdateTargetStatus] = useState<string>("");
  const [updateSolutionType, setUpdateSolutionType] = useState<string>("");
  const [updateComment, setUpdateComment] = useState("");

  // Assign modal state
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assignableStaff, setAssignableStaff] = useState<TicketStaffOptionResponse[]>([]);
  const [loadingStaff, setLoadingStaff] = useState(false);
  const [selectedStaffId, setSelectedStaffId] = useState<string>("");
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

  const handleConfirmUpdateStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!updateTargetStatus) {
      setTransitionError("Selecciona la nueva situación del ticket.");
      return;
    }
    if (updateTargetStatus === "Cancelado" && !updateComment.trim()) {
      setTransitionError("La cancelación exige un motivo escrito explicativo.");
      return;
    }
    if (updateTargetStatus === "Solucionado") {
      if (!updateSolutionType) {
        setTransitionError("Selecciona el tipo de solución.");
        return;
      }
      const hasOutbound = ticket?.messages.some((m) => m.direction === "Saliente");
      if (!hasOutbound) {
        setTransitionError(
          "No se puede marcar como solucionado un ticket sin haber enviado al menos una respuesta al cliente.",
        );
        return;
      }
    }

    const reason =
      updateTargetStatus === "Solucionado"
        ? `Tipo de solución: ${updateSolutionType}${
            updateComment.trim() ? ` · Comentario: ${updateComment.trim()}` : ""
          }`
        : updateComment.trim() || undefined;

    try {
      setTransitioning(true);
      setTransitionError(null);
      await ticketsApi.updateStatus(ticketId, { status: updateTargetStatus, reason });
      setShowUpdateStatusModal(false);
      setUpdateTargetStatus("");
      setUpdateSolutionType("");
      setUpdateComment("");
      await refreshTicket();
    } catch (err) {
      setTransitionError(
        err instanceof Error ? err.message : "Error al actualizar el estado del ticket.",
      );
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
      const staffList = await ticketsApi.getAssignableStaff(ticketId);
      setAssignableStaff(staffList);
    } catch (err) {
      setAssignError(
        err instanceof Error ? err.message : "No se pudo cargar el personal asignable.",
      );
    } finally {
      setLoadingStaff(false);
    }
  };

  const handleConfirmAssign = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setAssigning(true);
      setAssignError(null);
      const staffId = selectedStaffId ? parseInt(selectedStaffId, 10) : null;
      await ticketsApi.assign(ticketId, {
        staffId,
        comment: assignComment.trim() || undefined,
      });
      setShowAssignModal(false);
      await refreshTicket();
    } catch (err) {
      setAssignError(
        err instanceof Error ? err.message : "Error al asignar el ticket.",
      );
    } finally {
      setAssigning(false);
    }
  };

  // Edit ticket details modal state (PUT /api/tickets/{id})
  const [showEditModal, setShowEditModal] = useState(false);
  const [editSubject, setEditSubject] = useState("");
  const [editTopicId, setEditTopicId] = useState<number | null>(null);
  const [editPriority, setEditPriority] = useState<string>("Normal");
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
        const cats = await ticketsApi.createOptions();
        setEditCatalogs(cats);
      } catch {
        // Ignorar
      } finally {
        setLoadingEditCatalogs(false);
      }
    }
  };

  const handleConfirmEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editSubject.trim()) {
      setEditError("El asunto no puede estar vacío.");
      return;
    }

    const currentTopic = editCatalogs?.topics.find((t) => t.id === editTopicId);
    if (currentTopic?.requiresProductLine && !editProductLineId) {
      setEditError(`El motivo '${currentTopic.name}' exige indicar una línea de producto.`);
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
      setEditError(
        err instanceof Error ? err.message : "Error al actualizar los detalles del ticket.",
      );
    } finally {
      setSavingEdit(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  if (error || !ticket) {
    return (
      <div className="mx-auto max-w-4xl p-6">
        <Button variant="secondary" size="sm" onClick={() => navigate("/tickets")} className="mb-4">
          <ArrowLeft className="h-4 w-4" /> Volver a tickets
        </Button>
        <Alert variant="error">
          <strong className="font-semibold">Error al abrir ticket:</strong>{" "}
          {error ?? "El ticket solicitado no existe o no tienes acceso a su departamento."}
        </Alert>
      </div>
    );
  }

  const sla = formatSlaRemaining(ticket.resolutionDueAt, Boolean(ticket.pausedAt));
  const availableTransitions = getAvailableTransitions(ticket.status);
  const editRequiresProductLine = Boolean(
    editCatalogs?.topics.find((t) => t.id === editTopicId)?.requiresProductLine,
  );

  // Consolidar mensajes y eventos en una línea de tiempo ordenada
  const timeline: TimelineItem[] = [
    ...ticket.messages.map(
      (m): TimelineItem => ({ kind: "message", data: m, createdAt: m.createdAt }),
    ),
    ...ticket.events.map(
      (e): TimelineItem => ({ kind: "event", data: e, createdAt: e.createdAt }),
    ),
  ].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  // Elementos del timeline filtrados para el Drawer lateral
  const filteredTimeline = timeline.filter((item) => {
    if (timelineFilter === "messages") return item.kind === "message";
    if (timelineFilter === "events") return item.kind === "event";
    return true;
  });

  // Hilo con el cliente (entrante + saliente, sin notas internas) y notas internas por separado,
  // para las pestañas "Respuestas al cliente" y "Notas internas".
  const sortedMessages = [...ticket.messages].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );
  const clientThread = sortedMessages.filter((m) => m.direction.toLowerCase() !== "interna");
  const internalNotes = sortedMessages.filter((m) => m.direction.toLowerCase() === "interna");
  const recipientEmail = ticket.contactEmail ?? ticket.requesterEmail ?? null;

  function renderMessageCard(msg: TicketMessageResponse) {
    const isInternal = msg.direction.toLowerCase() === "interna";
    const isOutbound = msg.direction.toLowerCase() === "saliente";

    return (
      <div
        key={`msg-${msg.id}`}
        className={`rounded-xl transition-shadow ${
          isInternal
            ? "border-2 border-amber-300 bg-amber-50/75 p-5 shadow-xs"
            : isOutbound
            ? "border border-line-soft bg-white p-5 shadow-xs"
            : "border border-slate-200 bg-slate-50/90 p-5 shadow-xs"
        }`}
      >
        {/* Cabecera del mensaje */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-black/5 pb-3">
          <div className="flex items-center gap-2.5">
            {isInternal ? (
              <span className="inline-flex items-center gap-1 rounded-md bg-amber-500 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider text-white">
                <Lock className="h-3 w-3" /> Nota Interna
              </span>
            ) : isOutbound ? (
              <span className="inline-flex items-center gap-1 rounded-md bg-sky-600 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider text-white">
                <Mail className="h-3 w-3" /> Respuesta al cliente
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-md bg-slate-700 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider text-white">
                <User className="h-3 w-3" /> Cliente
              </span>
            )}

            <span className="text-xs font-semibold text-ink">
              {msg.authorStaffName ??
                msg.authorContactName ??
                ticket?.requesterName ??
                "Remitente"}
            </span>
          </div>

          <span className="text-[11.5px] text-subtle">{formatDateTime(msg.createdAt)}</span>
        </div>

        {/* Advertencia explícita en notas internas */}
        {isInternal && (
          <div className="mt-2.5 flex items-center gap-1.5 rounded-md bg-amber-100/90 px-2.5 py-1 text-[11px] font-medium text-amber-900">
            <ShieldAlert className="h-3.5 w-3.5 shrink-0 text-amber-700" />
            <span>
              Solo visible para el personal de Plastifar. El cliente no puede ver este mensaje ni
              recibe copia.
            </span>
          </div>
        )}

        {/* Cuerpo del mensaje */}
        <div className="mt-3.5 text-sm leading-relaxed text-ink whitespace-pre-wrap">
          {msg.bodyText ?? msg.bodyHtml?.replace(/<[^>]*>?/gm, "")}
        </div>

        {/* Adjuntos del mensaje */}
        {msg.attachments && msg.attachments.length > 0 && (
          <div className="mt-4 border-t border-black/5 pt-3">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-subtle">
              Archivos adjuntos ({msg.attachments.length}):
            </span>
            <div className="mt-2 flex flex-wrap gap-2">
              {msg.attachments.map((att) => (
                <button
                  key={att.id}
                  type="button"
                  onClick={() => void handleDownloadAttachment(att)}
                  disabled={downloadingId === att.id}
                  className="inline-flex items-center gap-2 rounded-lg border border-line-strong bg-white px-2.5 py-1.5 text-xs text-ink transition-colors hover:border-zinc-400 hover:bg-slate-50"
                >
                  <FileText className="h-3.5 w-3.5 text-subtle" />
                  <span className="max-w-[180px] truncate">{att.fileName}</span>
                  <span className="text-[10.5px] text-subtle">({formatBytes(att.sizeBytes)})</span>
                  <Download className="h-3 w-3 text-subtle" />
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  /** Punto del timeline lateral para un evento del sistema (más compacto que renderEvent,
   * pensado para la columna angosta bajo la tarjeta SLA). */
  function renderTimelineEvent(evt: TicketEventResponse, idx: number) {
    const isBreach =
      evt.eventType === "SlaBreached" ||
      Boolean(evt.details?.toLowerCase().includes("incumplimiento de sla"));
    return (
      <div key={`tl-evt-${evt.id}-${idx}`} className="relative pb-5 pl-7 last:pb-0">
        <span
          className={`absolute left-0 top-0.5 flex h-4 w-4 items-center justify-center rounded-full ring-4 ring-white ${
            isBreach ? "bg-red-600" : "bg-zinc-400"
          }`}
        >
          {isBreach ? (
            <AlertTriangle className="h-2.5 w-2.5 text-white" />
          ) : (
            <CheckCircle2 className="h-2.5 w-2.5 text-white" />
          )}
        </span>
        <div
          className={`rounded-lg border px-3 py-2 text-[11px] ${
            isBreach ? "border-red-200 bg-red-50" : "border-line-soft bg-canvas/50"
          }`}
        >
          <div className="flex items-center justify-between gap-2">
            <span className={`font-medium ${isBreach ? "text-red-900" : "text-ink"}`}>
              {evt.actorStaffName ?? "Sistema"}
            </span>
            <span className="shrink-0 text-[10px] text-subtle">{formatDateTime(evt.createdAt)}</span>
          </div>
          <p className={`mt-0.5 ${isBreach ? "font-medium text-red-700" : "text-subtle"}`}>
            {evt.details ?? evt.eventType}
          </p>
        </div>
      </div>
    );
  }

  /** Punto del timeline lateral para un mensaje (versión compacta de renderMessageCard,
   * pensada para la columna angosta bajo la tarjeta SLA). */
  function renderTimelineMessage(msg: TicketMessageResponse) {
    const isInternal = msg.direction.toLowerCase() === "interna";
    const isOutbound = msg.direction.toLowerCase() === "saliente";
    const dotColor = isInternal ? "bg-amber-500" : isOutbound ? "bg-sky-600" : "bg-slate-700";

    return (
      <div key={`tl-msg-${msg.id}`} className="relative pb-5 pl-7 last:pb-0">
        <span
          className={`absolute left-0 top-0.5 flex h-4 w-4 items-center justify-center rounded-full ring-4 ring-white ${dotColor}`}
        >
          {isInternal ? (
            <Lock className="h-2.5 w-2.5 text-white" />
          ) : isOutbound ? (
            <Mail className="h-2.5 w-2.5 text-white" />
          ) : (
            <User className="h-2.5 w-2.5 text-white" />
          )}
        </span>
        <div
          className={`rounded-lg border p-3 text-xs ${
            isInternal
              ? "border-amber-200 bg-amber-50/60"
              : isOutbound
              ? "border-line-soft bg-white"
              : "border-slate-200 bg-slate-50/80"
          }`}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="truncate font-semibold text-ink">
              {msg.authorStaffName ?? msg.authorContactName ?? ticket?.requesterName ?? "Remitente"}
            </span>
            <span className="shrink-0 text-[10px] text-subtle">{formatDateTime(msg.createdAt)}</span>
          </div>
          <span
            className={`mt-1 inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white ${dotColor}`}
          >
            {isInternal ? "Nota interna" : isOutbound ? "Respuesta" : "Cliente"}
          </span>
          <p className="mt-2 whitespace-pre-wrap text-[11.5px] leading-relaxed text-ink">
            {msg.bodyText ?? msg.bodyHtml?.replace(/<[^>]*>?/gm, "")}
          </p>
          {msg.attachments && msg.attachments.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5 border-t border-line-soft/60 pt-2 text-[10.5px] text-subtle">
              {msg.attachments.map((att) => (
                <button
                  key={att.id}
                  type="button"
                  onClick={() => void handleDownloadAttachment(att)}
                  disabled={downloadingId === att.id}
                  className="inline-flex items-center gap-1.5 rounded border border-line-soft bg-white px-2 py-0.5 text-ink transition-colors hover:bg-slate-50"
                  title="Descargar adjunto"
                >
                  <Paperclip className="h-3 w-3 text-subtle" />
                  <span className="max-w-[140px] truncate">{att.fileName}</span>
                  <Download className="h-2.5 w-2.5 text-subtle" />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  function renderTimelineDrawer() {
    if (!showTimelineDrawer || !ticket) return null;

    return (
      <div
        className="fixed inset-0 z-50 overflow-hidden"
        aria-labelledby="timeline-drawer-title"
        role="dialog"
        aria-modal="true"
      >
        {/* Backdrop con desenfoque suave */}
        <div
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity duration-300 ease-out"
          onClick={() => setShowTimelineDrawer(false)}
        />

        <div className="fixed inset-y-0 right-0 flex max-w-full pl-6 sm:pl-10 pointer-events-none">
          <div className="pointer-events-auto flex w-screen max-w-lg flex-col border-l border-line-soft bg-white shadow-2xl transition-transform duration-300 ease-out">
            {/* Cabecera del Drawer */}
            <div className="flex items-center justify-between border-b border-line-soft bg-slate-50/70 px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-red-50 text-brand-red">
                  <History className="h-5 w-5" />
                </div>
                <div>
                  <h2 id="timeline-drawer-title" className="font-heading text-sm font-bold text-ink">
                    Historial de conversación y eventos
                  </h2>
                  <p className="text-[11.5px] text-subtle">
                    {ticket.number} · {timeline.length} registro{timeline.length === 1 ? "" : "s"} cronológico{timeline.length === 1 ? "" : "s"}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowTimelineDrawer(false)}
                className="cursor-pointer rounded-lg p-1.5 text-subtle transition-colors hover:bg-slate-200/60 hover:text-ink"
                title="Cerrar pestaña de historial (Esc)"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Filtros rápidos: Todos | Mensajes | Eventos */}
            <div className="flex items-center gap-1.5 border-b border-line-soft bg-canvas/30 px-6 py-2.5 text-xs">
              <button
                type="button"
                onClick={() => setTimelineFilter("all")}
                className={`cursor-pointer rounded-md px-2.5 py-1 text-[11.5px] font-semibold transition-all ${
                  timelineFilter === "all"
                    ? "border border-line-soft bg-white text-ink shadow-2xs"
                    : "text-subtle hover:text-ink"
                }`}
              >
                Todos ({timeline.length})
              </button>
              <button
                type="button"
                onClick={() => setTimelineFilter("messages")}
                className={`cursor-pointer rounded-md px-2.5 py-1 text-[11.5px] font-semibold transition-all ${
                  timelineFilter === "messages"
                    ? "border border-line-soft bg-white text-ink shadow-2xs"
                    : "text-subtle hover:text-ink"
                }`}
              >
                Mensajes ({sortedMessages.length})
              </button>
              <button
                type="button"
                onClick={() => setTimelineFilter("events")}
                className={`cursor-pointer rounded-md px-2.5 py-1 text-[11.5px] font-semibold transition-all ${
                  timelineFilter === "events"
                    ? "border border-line-soft bg-white text-ink shadow-2xs"
                    : "text-subtle hover:text-ink"
                }`}
              >
                Eventos ({ticket.events?.length ?? 0})
              </button>
            </div>

            {/* Lista cronológica scrollable */}
            <div className="flex-1 overflow-y-auto px-6 py-5">
              {filteredTimeline.length === 0 ? (
                <div className="rounded-edge border border-dashed border-line-strong bg-canvas/40 p-8 text-center text-xs text-subtle">
                  No hay registros en esta categoría.
                </div>
              ) : (
                <div className="relative">
                  <div className="absolute bottom-1 left-[7px] top-1 w-px bg-line-soft" />
                  {filteredTimeline.map((item, idx) =>
                    item.kind === "event"
                      ? renderTimelineEvent(item.data, idx)
                      : renderTimelineMessage(item.data),
                  )}
                </div>
              )}
            </div>

            {/* Pie del Drawer con atajo Esc y botones */}
            <div className="flex items-center justify-between border-t border-line-soft bg-slate-50/80 px-6 py-3">
              <span className="text-[11px] text-subtle">
                Presiona <kbd className="rounded border border-line-strong bg-white px-1.5 py-0.5 text-[10px] font-semibold text-ink">Esc</kbd> para cerrar
              </span>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setShowTimelineDrawer(false)}
              >
                Cerrar
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const detailTabs: {
    key: "general" | "respuestas" | "notas";
    label: string;
    icon: typeof Info;
    count?: number;
  }[] = [
    { key: "general", label: "Información general", icon: Info },
    { key: "respuestas", label: "Responder al cliente", icon: Mail, count: clientThread.length },
    { key: "notas", label: "Notas internas", icon: Lock, count: internalNotes.length },
  ];

  return (
    <div className="min-h-0 flex-1 overflow-y-auto bg-slate-50/50 pb-16">
      {/* Barra superior de navegación y cabecera */}
      <div className="sticky top-0 z-10 border-b border-line-soft bg-white/95 px-6 py-3.5 backdrop-blur-xs">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => navigate("/tickets")}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-line-soft bg-white text-subtle transition-colors hover:bg-slate-100 hover:text-ink"
              title="Volver a la bandeja"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <span className="font-mono text-xs font-semibold text-subtle">
              {ticket.number}
            </span>
            <span className="h-3.5 w-px bg-line-soft" />
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-ink">
              <span className={`h-2 w-2 rounded-full ${statusDotColor(ticket.status)}`} />
              {ticket.status}
            </span>
            <span
              className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-medium ${priorityClasses(
                ticket.priority,
              )}`}
            >
              {ticket.priority}
            </span>
          </div>

          <div className="flex items-center gap-3">
            {/* SLA Badge */}
            {sla.tone === "ok" ? (
              <Badge tone="green">
                <Clock className="mr-1 h-3 w-3 inline" />
                {sla.text}
              </Badge>
            ) : sla.tone === "overdue" ? (
              <Badge tone="red">
                <Clock className="mr-1 h-3 w-3 inline" />
                {sla.text}
              </Badge>
            ) : sla.tone === "warning" ? (
              <span className="inline-flex h-6 items-center rounded-full bg-amber-100 px-2.5 text-xs font-semibold text-amber-800">
                <Clock className="mr-1 h-3 w-3" />
                {sla.text}
              </span>
            ) : (
              <span className="inline-flex h-6 items-center rounded-full bg-slate-100 px-2.5 text-xs font-medium text-slate-600">
                {sla.text}
              </span>
            )}

            {/* Botón para desplegar la pestaña lateral con todo el timeline */}
            <button
              type="button"
              onClick={() => setShowTimelineDrawer(true)}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-edge border border-line-soft bg-white px-3 py-1.5 text-xs font-semibold text-ink shadow-2xs transition-colors hover:border-line-strong hover:bg-canvas hover:text-brand-red"
              title="Abrir historial de conversaciones y eventos"
            >
              <History className="h-3.5 w-3.5 text-brand-red" />
              <span>Historial ({timeline.length})</span>
            </button>

            {availableTransitions.length > 0 ? (
              <Button type="button" variant="primary" size="sm" onClick={handleOpenUpdateStatusModal}>
                <RefreshCw className="h-3.5 w-3.5" />
                Actualizar ticket
              </Button>
            ) : (
              <span className="rounded-md border border-rose-200 bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-700">
                Cancelado (cierre definitivo)
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Contenedor principal de 2 columnas */}
      <div className="mx-auto max-w-7xl px-6 py-6">
        {/* Título, metadatos rápidos y botones de acción rápida de estado */}
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-ink md:text-2xl">
              {ticket.subject}
            </h1>
            <p className="mt-1 text-xs text-subtle">
              Creado el {formatDateTime(ticket.createdAt)} por{" "}
              <span className="font-medium text-ink">
                {ticket.createdByStaffName ?? ticket.requesterName ?? "Sistema"}
              </span>{" "}
              · Canal: <span className="font-medium text-ink">{ticket.channel}</span>
            </p>
          </div>

          {/* Navegación por pestañas: antes vivían aquí los botones sueltos de
              En espera / Reenvío / Solucionar / Cancelar, ahora consolidados en
              el botón "Actualizar ticket" de la barra superior. */}
          <div className="inline-flex flex-wrap gap-1 self-start rounded-edge border border-line-soft bg-canvas/60 p-1">
            {detailTabs.map((tab) => {
              const isActive = activeTab === tab.key;
              const TabIcon = tab.icon;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveTab(tab.key)}
                  className={`inline-flex cursor-pointer items-center gap-1.5 rounded-edge px-3.5 py-1.5 text-[12.5px] font-semibold transition-all ${
                    isActive ? "bg-white text-ink shadow-2xs" : "text-subtle hover:text-ink"
                  }`}
                >
                  <TabIcon className="h-3.5 w-3.5" />
                  {tab.label}
                  {tab.count !== undefined && (
                    <span
                      className={`rounded-full px-1.5 py-px text-[10.5px] font-semibold ${
                        isActive ? "bg-fill text-subtle" : "bg-white/70 text-subtle"
                      }`}
                    >
                      {tab.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Alerta visible para conflictos 409 o errores de transición */}
        {transitionError && (
          <div className="mb-6">
            <Alert variant="error">
              <div className="flex items-center justify-between">
                <span>{transitionError}</span>
                <button
                  type="button"
                  onClick={() => setTransitionError(null)}
                  className="ml-3 text-xs font-semibold underline hover:opacity-80"
                >
                  Entendido
                </button>
              </div>
            </Alert>
          </div>
        )}

        {/* Pestaña 1: Información general */}
        {activeTab === "general" && (
          <div className="space-y-6">
            {/* Fila de KPIs: Cliente y Contacto | Atributos del Ticket | SLA y Métricas de Tiempo */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
              {/* KPI 1: Cliente & Contacto */}
              <div className="flex flex-col rounded-xl border border-line-soft bg-white p-4 shadow-xs">
                <div className="flex items-center justify-between">
                  <h3 className="flex items-center gap-2 font-heading text-[12.5px] font-semibold text-ink">
                    <Building2 className="h-4 w-4 text-brand-red" />
                    Cliente y Contacto
                  </h3>
                  {ticket.clientCode && (
                    <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] font-medium text-subtle">
                      {ticket.clientCode}
                    </span>
                  )}
                </div>
                <div className="mt-3 flex flex-1 flex-col justify-between gap-2.5 text-xs">
                  <div className="space-y-2">
                    <div>
                      <span className="block text-[11px] text-subtle">Razón social:</span>
                      <p className="truncate font-semibold text-ink" title={ticket.clientName || undefined}>
                        {ticket.clientName || "Sin cliente asignado"}
                      </p>
                    </div>
                    <div>
                      <span className="block text-[11px] text-subtle">Contacto:</span>
                      <p className="truncate font-medium text-ink" title={ticket.contactName || undefined}>
                        {ticket.contactName || "Sin contacto registrado"}
                      </p>
                    </div>
                  </div>

                  {((ticket.contactEmail ?? ticket.requesterEmail) || ticket.contactPhone) && (
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-line-soft/60 pt-2 text-[11.5px] text-subtle">
                      {(ticket.contactEmail ?? ticket.requesterEmail) && (
                        <div className="flex min-w-0 max-w-full items-center gap-1.5">
                          <Mail className="h-3.5 w-3.5 shrink-0 text-subtle" />
                          <a
                            href={`mailto:${ticket.contactEmail ?? ticket.requesterEmail}`}
                            className="truncate text-ink hover:underline"
                            title={ticket.contactEmail ?? ticket.requesterEmail ?? undefined}
                          >
                            {ticket.contactEmail ?? ticket.requesterEmail}
                          </a>
                        </div>
                      )}
                      {ticket.contactPhone && (
                        <div className="flex shrink-0 items-center gap-1.5">
                          <Phone className="h-3.5 w-3.5 shrink-0 text-subtle" />
                          <span className="text-ink">{ticket.contactPhone}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* KPI 2: Atributos del Ticket */}
              <div className="flex flex-col rounded-xl border border-line-soft bg-white p-4 shadow-xs">
                <div className="flex items-center justify-between">
                  <h3 className="flex items-center gap-2 font-heading text-[12.5px] font-semibold text-ink">
                    <User className="h-4 w-4 text-brand-red" />
                    Atributos del Ticket
                  </h3>
                  {ticket.status !== "Cancelado" && ticket.status !== "Cerrado" && (
                    <button
                      type="button"
                      onClick={() => void handleOpenEditModal()}
                      className="inline-flex cursor-pointer items-center gap-1 text-[11px] font-semibold text-brand-red transition-colors hover:underline"
                      title="Editar campos clave del ticket"
                    >
                      <Pencil className="h-3 w-3" />
                      Editar
                    </button>
                  )}
                </div>
                <div className="mt-3 flex flex-1 flex-col justify-between gap-2.5 text-xs">
                  <div className="space-y-2.5">
                    {/* Clasificación: Departamento y Tema / Motivo con simetría exacta */}
                    <div className="grid grid-cols-2 divide-x divide-line-soft/60">
                      <div className="min-w-0 pr-3">
                        <span className="block text-[11px] text-subtle">Departamento:</span>
                        <span className="block truncate font-semibold text-ink" title={ticket.departmentName || undefined}>
                          {ticket.departmentName || "Sin departamento"}
                        </span>
                      </div>

                      <div className="min-w-0 pl-3">
                        <span className="block text-[11px] text-subtle">Tema / Motivo:</span>
                        <span className="block truncate font-semibold text-ink" title={ticket.topicName || undefined}>
                          {ticket.topicName || "Sin motivo"}
                        </span>
                      </div>
                    </div>

                    {/* Asignado a: bloque integrado con avatar e interacción limpia */}
                    <div className="flex items-center justify-between rounded-lg border border-line-soft bg-slate-50/80 px-2.5 py-1.5">
                      <div className="flex min-w-0 items-center gap-2">
                        {ticket.assignedStaffName ? (
                          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-red-100 text-[10.5px] font-bold text-brand-red">
                            {getInitials(ticket.assignedStaffName)}
                          </div>
                        ) : (
                          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-200/70 text-subtle">
                            <User className="h-3.5 w-3.5" />
                          </div>
                        )}
                        <div className="min-w-0">
                          <span className="block text-[10px] leading-tight text-subtle">Asignado a:</span>
                          <span
                            className="block truncate text-xs font-semibold text-ink"
                            title={ticket.assignedStaffName || undefined}
                          >
                            {ticket.assignedStaffName ?? "Sin asignar"}
                          </span>
                        </div>
                      </div>

                      {ticket.status !== "Cancelado" && (
                        <button
                          type="button"
                          onClick={() => void handleOpenAssignModal()}
                          className="inline-flex shrink-0 cursor-pointer items-center gap-1 rounded-md border border-line-soft bg-white px-2 py-1 text-[11px] font-semibold text-brand-red shadow-2xs transition-colors hover:border-red-200 hover:bg-red-50"
                          title="Asignar o reasignar ticket"
                        >
                          <UserCheck className="h-3 w-3" />
                          {ticket.assignedStaffId ? "Cambiar" : "Asignar"}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Pie: Canal de origen y Línea de producto */}
                  <div className="flex items-center justify-between border-t border-line-soft/60 pt-2 text-[11.5px] text-subtle">
                    <div className="flex min-w-0 items-center gap-1.5">
                      <span>Canal:</span>
                      <span className="truncate font-medium text-ink">{ticket.channel}</span>
                    </div>
                    {ticket.productLineName && (
                  <div className="flex shrink-0 items-center gap-1.5">
                    <span>Línea:</span>
                    <span className="truncate font-medium text-ink" title={ticket.productLineName}>
                      {ticket.productLineName}
                    </span>
                  </div>
                )}
                  </div>
                </div>
              </div>

              {/* KPI 3: SLA y Tiempos */}
              <div className="flex flex-col rounded-xl border border-line-soft bg-white p-4 shadow-xs">
                <div className="flex items-center justify-between">
                  <h3 className="flex items-center gap-2 font-heading text-[12.5px] font-semibold text-ink">
                    <Clock className="h-4 w-4 text-brand-red" />
                    SLA y Métricas de Tiempo
                  </h3>
                  {sla.tone === "ok" ? (
                    <Badge tone="green">
                      <Clock className="mr-1 inline h-3 w-3" />
                      {sla.text}
                    </Badge>
                  ) : sla.tone === "overdue" ? (
                    <Badge tone="red">
                      <Clock className="mr-1 inline h-3 w-3" />
                      {sla.text}
                    </Badge>
                  ) : sla.tone === "warning" ? (
                    <span className="inline-flex h-5 items-center rounded-full bg-amber-100 px-2 text-[10.5px] font-semibold text-amber-800">
                      <Clock className="mr-1 inline h-3 w-3" />
                      {sla.text}
                    </span>
                  ) : (
                    <span className="inline-flex h-5 items-center rounded-full bg-slate-100 px-2 text-[10.5px] font-medium text-slate-600">
                      {sla.text}
                    </span>
                  )}
                </div>
                <div className="mt-3 flex flex-1 flex-col justify-between gap-2.5 text-xs">
                  <div className="space-y-2">
                    <div>
                      <span className="block text-[11px] text-subtle">Vencimiento de Resolución:</span>
                      <p className="font-medium text-ink">
                        {ticket.resolutionDueAt
                          ? formatDateTime(ticket.resolutionDueAt)
                          : "No configurado"}
                      </p>
                    </div>

                    <div>
                      <span className="block text-[11px] text-subtle">Primera respuesta:</span>
                      <p className="font-medium text-ink">
                        {ticket.firstResponseAt ? (
                          <span className="text-emerald-700">
                            Lograda ({formatDateTime(ticket.firstResponseAt)})
                          </span>
                        ) : ticket.firstResponseDueAt ? (
                          <span>Límite: {formatDateTime(ticket.firstResponseDueAt)}</span>
                        ) : (
                          "Pendiente"
                        )}
                      </p>
                    </div>

                    {Boolean(ticket.pausedAt) && (
                      <div className="rounded-lg bg-amber-50 p-2 text-amber-800">
                        <div className="flex items-center gap-1 font-semibold">
                          <AlertTriangle className="h-3.5 w-3.5" /> SLA Pausado
                        </div>
                        <p className="mt-0.5 text-[11px]">
                          En espera del cliente desde {formatDateTime(ticket.pausedAt!)}.
                        </p>
                      </div>
                    )}

                    {ticket.pausedMinutes > 0 && (
                      <div className="flex justify-between text-subtle">
                        <span>Tiempo total en pausa:</span>
                        <span className="font-medium text-ink">{ticket.pausedMinutes} minutos</span>
                      </div>
                    )}

                    {ticket.reopenedCount > 0 && (
                      <div className="flex justify-between text-subtle">
                        <span>Reaperturas:</span>
                        <span className="font-semibold text-amber-700">{ticket.reopenedCount}</span>
                      </div>
                    )}

                    {ticket.resolvedAt && (
                      <div className="flex justify-between text-subtle">
                        <span>Resuelto el:</span>
                        <span className="font-medium text-ink">{formatDateTime(ticket.resolvedAt)}</span>
                      </div>
                    )}

                    {ticket.closedAt && (
                      <div className="flex justify-between text-subtle">
                        <span>Cerrado el:</span>
                        <span className="font-medium text-ink">{formatDateTime(ticket.closedAt)}</span>
                      </div>
                    )}
                  </div>

                  {!ticket.pausedAt && ticket.pausedMinutes === 0 && ticket.reopenedCount === 0 && !ticket.resolvedAt && (
                    <div className="flex items-center justify-between border-t border-line-soft/60 pt-2 text-[11.5px] text-subtle">
                      <span>Última actividad:</span>
                      <span className="font-medium text-ink">{formatDateTime(ticket.lastActivityAt)}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Solicitud / Descripción inicial del caso (ancho completo y equilibrado) */}
            <div className="rounded-xl border border-line-soft bg-white p-5 shadow-xs">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line-soft pb-3">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-brand-red" />
                  <h3 className="font-heading text-[12.5px] font-semibold text-ink">
                    Descripción inicial del caso
                  </h3>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {clientThread.length > 0 && (
                    <span className="text-[11.5px] text-subtle">
                      {formatDateTime(clientThread[0].createdAt)}
                    </span>
                  )}
                  {/* Botón para desplegar la pestaña lateral con todo el timeline */}
                  <button
                    type="button"
                    onClick={() => setShowTimelineDrawer(true)}
                    className="inline-flex cursor-pointer items-center gap-1.5 rounded-edge border border-line-soft bg-slate-50 px-2.5 py-1 text-[11.5px] font-semibold text-ink shadow-2xs transition-colors hover:border-red-200 hover:bg-red-50 hover:text-brand-red"
                    title="Ver línea de tiempo y auditoría del ticket"
                  >
                    <History className="h-3.5 w-3.5 text-brand-red" />
                    <span>Ver historial ({timeline.length})</span>
                  </button>
                  {clientThread.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setActiveTab("respuestas")}
                      className="inline-flex cursor-pointer items-center gap-1 rounded-edge border border-line-soft bg-white px-2.5 py-1 text-[11.5px] font-semibold text-brand-red shadow-2xs hover:bg-red-50"
                    >
                      <Mail className="h-3 w-3" />
                      Responder al cliente
                    </button>
                  )}
                </div>
              </div>

              {clientThread.length > 0 ? (
                <>
                  <div className="mt-3.5 text-sm leading-relaxed text-ink whitespace-pre-wrap">
                    {clientThread[0].bodyText ?? clientThread[0].bodyHtml?.replace(/<[^>]*>?/gm, "")}
                  </div>

                  {clientThread[0].attachments && clientThread[0].attachments.length > 0 && (
                    <div className="mt-4 border-t border-line-soft pt-3">
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-subtle">
                        Archivos adjuntos ({clientThread[0].attachments.length}):
                      </span>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {clientThread[0].attachments.map((att) => (
                          <button
                            key={att.id}
                            type="button"
                            onClick={() => void handleDownloadAttachment(att)}
                            disabled={downloadingId === att.id}
                            className="inline-flex items-center gap-2 rounded-lg border border-line-strong bg-white px-2.5 py-1.5 text-xs text-ink transition-colors hover:border-zinc-400 hover:bg-slate-50"
                          >
                            <FileText className="h-3.5 w-3.5 text-subtle" />
                            <span className="max-w-[180px] truncate">{att.fileName}</span>
                            <span className="text-[10.5px] text-subtle">({formatBytes(att.sizeBytes)})</span>
                            <Download className="h-3 w-3 text-subtle" />
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="mt-3 text-sm text-subtle">
                  Este ticket no tiene un mensaje de descripción inicial registrado.
                </div>
              )}
            </div>

            {/* Banner destacado para abrir la pestaña lateral con todo el timeline */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-line-soft bg-white p-4 shadow-xs">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-red-50 text-brand-red">
                  <History className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-ink">Historial de conversación y eventos</span>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-subtle">
                      {timeline.length} {timeline.length === 1 ? "registro" : "registros"}
                    </span>
                  </div>
                  <p className="mt-0.5 text-[11.5px] text-subtle">
                    Consulta la cronología completa de cambios, intervenciones, mensajes y auditoría del ticket.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowTimelineDrawer(true)}
                className="inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 rounded-lg border border-line-strong bg-white px-3.5 py-2 text-xs font-semibold text-ink shadow-2xs transition-all hover:border-brand-red hover:bg-red-50 hover:text-brand-red"
              >
                <History className="h-3.5 w-3.5 text-brand-red" />
                <span>Desplegar historial</span>
              </button>
            </div>

            {/* Acceso rápido a las respuestas si hay más interacción en el hilo */}
            {clientThread.length > 1 && (
              <div className="flex items-center justify-between rounded-xl border border-line-soft bg-white p-4 shadow-xs">
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-sky-600" />
                  <span className="text-xs text-ink">
                    Hay <strong className="font-semibold">{clientThread.length - 1}</strong> respuesta{clientThread.length - 1 > 1 ? "s" : ""} adicional{clientThread.length - 1 > 1 ? "es" : ""} en la conversación.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab("respuestas")}
                  className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-line-strong bg-white px-2.5 py-1 text-xs font-semibold text-ink shadow-2xs hover:bg-slate-50"
                >
                  Ver respuestas ({clientThread.length})
                </button>
              </div>
            )}

            {/* Sub-grid simétrica para Observadores y Adjuntos */}
            {((ticket.watchers && ticket.watchers.length > 0) || (ticket.attachments && ticket.attachments.length > 0)) && (
              <div
                className={`grid grid-cols-1 ${
                  ticket.watchers && ticket.watchers.length > 0 && ticket.attachments && ticket.attachments.length > 0
                    ? "lg:grid-cols-2"
                    : ""
                } gap-6`}
              >
                {/* Observadores del ticket */}
                {ticket.watchers && ticket.watchers.length > 0 && (
                  <div className="rounded-xl border border-line-soft bg-white p-5 shadow-xs">
                    <h3 className="font-heading text-[12.5px] font-semibold text-ink">
                      Observadores ({ticket.watchers.length})
                    </h3>
                    <div className="mt-3 space-y-1.5 text-xs">
                      {ticket.watchers.map((w) => (
                        <div key={w.id} className="flex items-center justify-between text-ink">
                          <span className="font-medium">{w.staffName}</span>
                          <span className="text-[11px] text-subtle">{w.staffEmail}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Todos los adjuntos del ticket */}
                {ticket.attachments && ticket.attachments.length > 0 && (
                  <div className="rounded-xl border border-line-soft bg-white p-5 shadow-xs">
                    <h3 className="flex items-center gap-2 font-heading text-[12.5px] font-semibold text-ink">
                      <Paperclip className="h-4 w-4 text-brand-red" />
                      Todos los Adjuntos ({ticket.attachments.length})
                    </h3>
                    <div className="mt-3 space-y-2 text-xs">
                      {ticket.attachments.map((att) => (
                        <div
                          key={att.id}
                          className="flex items-center justify-between gap-2 rounded-lg border border-line-soft p-2"
                        >
                          <div className="min-w-0">
                            <p className="truncate font-medium text-ink" title={att.fileName}>
                              {att.fileName}
                            </p>
                            <span className="text-[10px] text-subtle">
                              {formatBytes(att.sizeBytes)} · {formatDateTime(att.createdAt)}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => void handleDownloadAttachment(att)}
                            disabled={downloadingId === att.id}
                            className="rounded-md border border-line-soft p-1.5 text-subtle transition-colors hover:bg-slate-100 hover:text-ink"
                            title="Descargar"
                          >
                            <Download className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Pestaña 2: Responder al cliente */}
        {activeTab === "respuestas" && (
          <div className="space-y-4">
            {clientThread.length === 0 ? (
              <div className="rounded-edge border border-dashed border-line-strong bg-white p-8 text-center text-sm text-subtle">
                Aún no hay respuestas ni mensajes del cliente en este ticket.
              </div>
            ) : (
              clientThread.map((msg) => renderMessageCard(msg))
            )}

            <div className="rounded-edge border border-line bg-white shadow-xs">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line-soft px-4 py-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-[12.5px]">
                    <span className="w-12 shrink-0 font-medium text-subtle">Para:</span>
                    {recipientEmail ? (
                      <span className="truncate text-ink">{recipientEmail}</span>
                    ) : (
                      <span className="text-brand-red-dark">
                        Este ticket no tiene un correo de contacto registrado.
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-[12.5px]">
                    <span className="w-12 shrink-0 font-medium text-subtle">Asunto:</span>
                    <span className="truncate text-ink">Re: {ticket.subject}</span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setShowTimelineDrawer(true)}
                  className="inline-flex cursor-pointer items-center gap-1.5 rounded-edge border border-line-soft bg-slate-50 px-2.5 py-1 text-[11.5px] font-semibold text-ink shadow-2xs transition-colors hover:border-red-200 hover:bg-red-50 hover:text-brand-red"
                  title="Consultar historial completo del ticket"
                >
                  <History className="h-3.5 w-3.5 text-brand-red" />
                  <span>Ver historial ({timeline.length})</span>
                </button>
              </div>

              <form onSubmit={handleSendReply}>
                <textarea
                  rows={6}
                  value={replyBody}
                  onChange={(e) => setReplyBody(e.target.value)}
                  placeholder="Escribe tu respuesta para el cliente…"
                  className="w-full resize-none border-0 px-4 py-3 text-[13px] leading-relaxed text-ink placeholder:text-zinc-400 focus:outline-none"
                />

                {replyAttachments.length > 0 && (
                  <div className="flex flex-wrap gap-2 border-t border-line-soft px-4 py-2.5">
                    {replyAttachments.map((f, i) => (
                      <span
                        key={`${f.name}-${i}`}
                        className="inline-flex items-center gap-1.5 rounded-edge border border-line-soft bg-canvas/60 px-2.5 py-1 text-[11.5px] text-ink"
                      >
                        <Paperclip className="h-3 w-3 text-subtle" />
                        <span className="max-w-[160px] truncate">{f.name}</span>
                        <span className="text-[10px] text-subtle">({formatBytes(f.size)})</span>
                        <button
                          type="button"
                          onClick={() => removeReplyFile(i)}
                          className="ml-1 cursor-pointer text-subtle hover:text-brand-red"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}

                {replySendError && (
                  <div className="border-t border-line-soft px-4 py-2.5">
                    <Alert variant="error">{replySendError}</Alert>
                  </div>
                )}

                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line-soft bg-canvas/40 px-4 py-2.5">
                  <div className="flex items-center gap-2">
                    <input
                      ref={replyFileInputRef}
                      type="file"
                      multiple
                      onChange={handleReplyFileChange}
                      className="hidden"
                      id="reply-attachment-input"
                    />
                    <label
                      htmlFor="reply-attachment-input"
                      className="inline-flex cursor-pointer items-center gap-1.5 rounded-edge border border-line-strong bg-white px-2.5 py-1.5 text-[11.5px] font-medium text-subtle transition-colors hover:bg-canvas hover:text-ink"
                    >
                      <Paperclip className="h-3.5 w-3.5" />
                      Adjuntar
                    </label>

                    {ticket.status !== "Cancelado" && nextStatusOptions(ticket.status).length > 0 && (
                      <select
                        value={replyStatusChange}
                        onChange={(e) => setReplyStatusChange(e.target.value)}
                        className="h-8 rounded-edge border border-line-strong bg-white px-2 text-[11.5px] text-ink focus:border-brand-red focus:outline-none"
                      >
                        <option value="">Mantener estado ({ticket.status})</option>
                        {nextStatusOptions(ticket.status).map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>

                  <Button type="submit" variant="primary" isLoading={replySending} className="gap-2">
                    <Send className="h-3.5 w-3.5" />
                    Enviar respuesta
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Pestaña 3: Notas internas */}
        {activeTab === "notas" && (
          <div className="space-y-4">
            {internalNotes.length === 0 ? (
              <div className="rounded-edge border border-dashed border-line-strong bg-white p-8 text-center text-sm text-subtle">
                Aún no hay notas internas en este ticket.
              </div>
            ) : (
              internalNotes.map((msg) => renderMessageCard(msg))
            )}

            <div className="rounded-edge border border-amber-300 bg-amber-50/40">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-amber-200/70 px-4 py-2.5 text-[11.5px] text-amber-900">
                <div className="flex items-start gap-2">
                  <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-700" />
                  <span>
                    Solo visible para el personal de Plastifar. El cliente no puede verla ni
                    recibe copia.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowTimelineDrawer(true)}
                  className="inline-flex cursor-pointer items-center gap-1.5 rounded-edge border border-amber-300/80 bg-white px-2.5 py-1 text-[11.5px] font-semibold text-amber-900 shadow-2xs transition-colors hover:bg-amber-100"
                  title="Consultar historial completo del ticket"
                >
                  <History className="h-3.5 w-3.5 text-amber-800" />
                  <span>Ver historial ({timeline.length})</span>
                </button>
              </div>

              <form onSubmit={handleSaveNote}>
                <textarea
                  rows={5}
                  value={noteBody}
                  onChange={(e) => setNoteBody(e.target.value)}
                  placeholder="Escribe una nota interna confidencial para el equipo…"
                  className="w-full resize-none border-0 bg-transparent px-4 py-3 text-[13px] leading-relaxed text-ink placeholder:text-amber-700/50 focus:outline-none"
                />

                {noteAttachments.length > 0 && (
                  <div className="flex flex-wrap gap-2 border-t border-amber-200/70 px-4 py-2.5">
                    {noteAttachments.map((f, i) => (
                      <span
                        key={`${f.name}-${i}`}
                        className="inline-flex items-center gap-1.5 rounded-edge border border-amber-300 bg-white px-2.5 py-1 text-[11.5px] text-ink"
                      >
                        <Paperclip className="h-3 w-3 text-subtle" />
                        <span className="max-w-[160px] truncate">{f.name}</span>
                        <span className="text-[10px] text-subtle">({formatBytes(f.size)})</span>
                        <button
                          type="button"
                          onClick={() => removeNoteFile(i)}
                          className="ml-1 cursor-pointer text-subtle hover:text-brand-red"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}

                {noteSendError && (
                  <div className="border-t border-amber-200/70 px-4 py-2.5">
                    <Alert variant="error">{noteSendError}</Alert>
                  </div>
                )}

                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-amber-200/70 px-4 py-2.5">
                  <div className="flex items-center gap-2">
                    <input
                      ref={noteFileInputRef}
                      type="file"
                      multiple
                      onChange={handleNoteFileChange}
                      className="hidden"
                      id="note-attachment-input"
                    />
                    <label
                      htmlFor="note-attachment-input"
                      className="inline-flex cursor-pointer items-center gap-1.5 rounded-edge border border-amber-300 bg-white px-2.5 py-1.5 text-[11.5px] font-medium text-amber-800 transition-colors hover:bg-amber-100"
                    >
                      <Paperclip className="h-3.5 w-3.5" />
                      Adjuntar
                    </label>
                  </div>

                  <button
                    type="submit"
                    disabled={noteSending}
                    className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-edge bg-amber-500 px-4 font-heading text-[11.5px] font-semibold uppercase tracking-[0.06em] text-white shadow-xs transition-colors hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {noteSending ? (
                      <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    ) : (
                      <Lock className="h-3.5 w-3.5" />
                    )}
                    Guardar nota interna
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>

      {/* Modal para Actualizar Ticket: una sola entrada para todas las transiciones de
          estado válidas; Solucionado pide tipo de solución + comentario, Cancelado exige
          un motivo explicativo, el resto acepta un comentario opcional. */}
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
                Confirmar
              </Button>
            </>
          }
        >
          <form id="update-status-form" onSubmit={handleConfirmUpdateStatus} className="space-y-4">
            {transitionError && <Alert variant="error">{transitionError}</Alert>}

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-ink">Nueva situación</label>
              <div className="space-y-2">
                {availableTransitions.map((opt) => {
                  const isSelected = updateTargetStatus === opt.target;
                  const OptIcon = opt.icon;
                  return (
                    <button
                      key={opt.target}
                      type="button"
                      onClick={() => setUpdateTargetStatus(opt.target)}
                      className={`flex w-full cursor-pointer items-start gap-2.5 rounded-lg border p-3 text-left transition-all ${
                        isSelected
                          ? opt.danger
                            ? "border-brand-red bg-brand-red/5 ring-1 ring-brand-red/30"
                            : "border-brand-red bg-brand-red/5 ring-1 ring-brand-red/30"
                          : "border-line-strong hover:border-zinc-400 hover:bg-slate-50"
                      }`}
                    >
                      <OptIcon
                        className={`mt-0.5 h-4 w-4 shrink-0 ${
                          opt.danger ? "text-brand-red" : "text-brand-gray"
                        }`}
                      />
                      <span>
                        <span className="block text-[13px] font-semibold text-ink">{opt.label}</span>
                        <span className="block text-[11.5px] text-subtle">{opt.description}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {updateTargetStatus === "Solucionado" && (
              <div className="flex flex-col gap-1.5">
                <label htmlFor="solution-type" className="text-xs font-semibold text-ink">
                  Tipo de solución <span className="text-brand-red">*</span>
                </label>
                <select
                  id="solution-type"
                  required
                  value={updateSolutionType}
                  onChange={(e) => setUpdateSolutionType(e.target.value)}
                  className="h-9 w-full rounded-lg border border-line-strong bg-white px-3 text-xs text-ink focus:border-brand-red focus:outline-none focus:ring-1 focus:ring-brand-red"
                >
                  <option value="">— Selecciona un tipo —</option>
                  {SOLUTION_TYPES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {updateTargetStatus && (
              <div className="flex flex-col gap-1.5">
                <label htmlFor="update-comment" className="text-xs font-semibold text-ink">
                  {updateTargetStatus === "Cancelado" ? (
                    <>
                      Motivo de cancelación <span className="text-brand-red">*</span>
                    </>
                  ) : (
                    "Comentario (opcional)"
                  )}
                </label>
                <textarea
                  id="update-comment"
                  rows={4}
                  required={updateTargetStatus === "Cancelado"}
                  value={updateComment}
                  onChange={(e) => setUpdateComment(e.target.value)}
                  placeholder={
                    updateTargetStatus === "Cancelado"
                      ? "Explica detalladamente por qué se cancela este ticket..."
                      : "Agrega contexto adicional para el historial del ticket (opcional)..."
                  }
                  className="w-full rounded-lg border border-line-strong p-3 text-xs text-ink placeholder:text-subtle focus:border-brand-red focus:outline-none focus:ring-1 focus:ring-brand-red"
                />
              </div>
            )}
          </form>
        </Modal>
      )}

      {/* Modal para Asignar Ticket */}
      {showAssignModal && (
        <Modal
          eyebrow={ticket.number}
          title="Asignar ticket"
          description="Selecciona el agente del personal para atender este caso. Solo se muestran colaboradores activos con acceso al departamento."
          onClose={() => {
            if (!assigning) setShowAssignModal(false);
          }}
          footer={
            <>
              <Button
                type="button"
                variant="secondary"
                disabled={assigning}
                onClick={() => setShowAssignModal(false)}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                form="assign-ticket-form"
                variant="primary"
                isLoading={assigning}
              >
                Guardar asignación
              </Button>
            </>
          }
        >
          <form id="assign-ticket-form" onSubmit={handleConfirmAssign} className="space-y-4">
            {assignError && <Alert variant="error">{assignError}</Alert>}

            {loadingStaff ? (
              <div className="flex items-center justify-center py-8">
                <Spinner size="md" />
                <span className="ml-2 text-xs text-subtle">Cargando personal disponible...</span>
              </div>
            ) : (
              <>
                <SelectField
                  id="assign-staff-select"
                  label="Colaborador asignado"
                  value={selectedStaffId}
                  onChange={setSelectedStaffId}
                  placeholder="Sin asignar (desasignar)"
                  options={[
                    { value: "", label: "Sin asignar (desasignar)" },
                    ...assignableStaff.map((s) => ({
                      value: String(s.id),
                      label: `${s.fullName} (${s.email})`,
                    })),
                  ]}
                />

                <TextField
                  id="assign-comment-input"
                  label="Nota o comentario interno"
                  hint="Opcional: explica brevemente el motivo del cambio de responsable."
                  value={assignComment}
                  onChange={(e) => setAssignComment(e.target.value)}
                  placeholder="Ej: Reasignado para soporte especializado de producto…"
                />
              </>
            )}
          </form>
        </Modal>
      )}

      {/* Modal para Editar Atributos del Ticket (PUT /api/tickets/{id}) */}
      {showEditModal && (
        <Modal
          eyebrow={ticket.number}
          title="Editar detalles del ticket"
          description="Modifica el asunto, motivo, prioridad, departamento o línea de producto. La fecha límite de SLA se recalculará automáticamente."
          onClose={() => {
            if (!savingEdit) setShowEditModal(false);
          }}
          footer={
            <>
              <Button
                type="button"
                variant="secondary"
                disabled={savingEdit}
                onClick={() => setShowEditModal(false)}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                form="edit-ticket-form"
                variant="primary"
                isLoading={savingEdit}
              >
                Guardar cambios
              </Button>
            </>
          }
        >
          <form id="edit-ticket-form" onSubmit={handleConfirmEdit} className="space-y-4">
            {editError && <Alert variant="error">{editError}</Alert>}

            {loadingEditCatalogs ? (
              <div className="flex items-center justify-center py-8">
                <Spinner size="md" />
                <span className="ml-2 text-xs text-subtle">Cargando catálogos...</span>
              </div>
            ) : (
              <>
                <TextField
                  id="edit-subject"
                  label="Asunto"
                  required
                  maxLength={200}
                  value={editSubject}
                  onChange={(e) => setEditSubject(e.target.value)}
                />

                <div className="space-y-3.5 rounded-edge border border-line-soft bg-canvas/40 p-4">
                  <h4 className="flex items-center gap-1.5 font-heading text-[12.5px] font-semibold text-ink">
                    <Tag className="h-3.5 w-3.5 text-brand-red" />
                    Clasificación y enrutamiento
                  </h4>

                  <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
                    <SelectField
                      id="edit-topic"
                      label="Motivo / Tema"
                      size="sm"
                      value={editTopicId !== null ? String(editTopicId) : ""}
                      onChange={(val) => {
                        const newId = val ? Number(val) : null;
                        setEditTopicId(newId);
                        if (newId) {
                          const foundTopic = editCatalogs?.topics.find((t) => t.id === newId);
                          if (foundTopic) {
                            if (foundTopic.defaultDepartmentId) {
                              setEditDepartmentId(foundTopic.defaultDepartmentId);
                            }
                            if (foundTopic.defaultPriority) {
                              setEditPriority(foundTopic.defaultPriority);
                            }
                          }
                        }
                      }}
                      placeholder="Sin motivo"
                      options={[
                        { value: "", label: "Sin motivo" },
                        ...(editCatalogs?.topics ?? []).map((t) => ({
                          value: String(t.id),
                          label: t.name,
                        })),
                      ]}
                    />

                    <SelectField
                      id="edit-priority"
                      label="Prioridad"
                      required
                      size="sm"
                      value={editPriority}
                      onChange={setEditPriority}
                      options={[
                        { value: "Emergencia", label: "Emergencia" },
                        { value: "Alta", label: "Alta" },
                        { value: "Normal", label: "Normal" },
                        { value: "Baja", label: "Baja" },
                      ]}
                    />
                  </div>

                  <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
                    <SelectField
                      id="edit-dept"
                      label="Departamento"
                      size="sm"
                      value={editDepartmentId !== null ? String(editDepartmentId) : ""}
                      onChange={(val) => setEditDepartmentId(val ? Number(val) : null)}
                      placeholder="Sin departamento"
                      options={[
                        { value: "", label: "Sin departamento" },
                        ...(editCatalogs?.departments ?? []).map((d) => ({
                          value: String(d.id),
                          label: d.name,
                        })),
                      ]}
                    />

                    <SelectField
                      id="edit-line"
                      label={editRequiresProductLine ? "Línea de producto *" : "Línea de producto"}
                      size="sm"
                      required={editRequiresProductLine}
                      value={editProductLineId !== null ? String(editProductLineId) : ""}
                      onChange={(val) => setEditProductLineId(val ? Number(val) : null)}
                      placeholder="Ninguna / No aplica"
                      options={[
                        { value: "", label: "Ninguna / No aplica" },
                        ...(editCatalogs?.productLines ?? []).map((pl) => ({
                          value: String(pl.id),
                          label: `${pl.name} (${pl.code})`,
                        })),
                      ]}
                    />
                  </div>
                </div>

                <p className="flex items-start gap-1.5 text-[11px] text-faint">
                  <Info className="mt-px h-3 w-3 shrink-0" />
                  Si cambias el departamento y el colaborador actualmente asignado no pertenece al
                  nuevo departamento, será desasignado automáticamente.
                </p>
              </>
            )}
          </form>
        </Modal>
      )}

      {/* Pestaña lateral desplegable con todo el historial del ticket */}
      {renderTimelineDrawer()}
    </div>
  );
}
