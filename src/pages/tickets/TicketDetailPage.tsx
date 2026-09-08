import {
  AlertTriangle,
  ArrowLeft,
  Building2,
  CheckCircle2,
  Clock,
  Download,
  FileText,
  Lock,
  Mail,
  Package,
  Paperclip,
  Pencil,
  Phone,
  RotateCcw,
  Send,
  ShieldAlert,
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

export function TicketDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const ticketId = id ? parseInt(id, 10) : 0;

  const [ticket, setTicket] = useState<TicketDetailResponse | null>(null);
  const [loading, setLoading] = useState(Boolean(ticketId));
  const [error, setError] = useState<string | null>(
    ticketId ? null : "Identificador de ticket no válido.",
  );

  // Composer state
  const [direction, setDirection] = useState<"Saliente" | "Interna">("Saliente");
  const [messageBody, setMessageBody] = useState("");
  const [statusChange, setStatusChange] = useState<string>("");
  const [attachments, setAttachments] = useState<File[]>([]);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<number | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const chosen = Array.from(e.target.files);

    // Validación individual y total
    const maxSingle = 10 * 1024 * 1024;
    const maxTotal = 25 * 1024 * 1024;

    const oversized = chosen.find((f) => f.size > maxSingle);
    if (oversized) {
      setSendError(`El archivo "${oversized.name}" supera el límite individual de 10 MB.`);
      return;
    }

    const currentTotal = attachments.reduce((acc, f) => acc + f.size, 0);
    const newTotal = chosen.reduce((acc, f) => acc + f.size, 0);
    if (currentTotal + newTotal > maxTotal) {
      setSendError("El total de los adjuntos excede los 25 MB permitidos por mensaje.");
      return;
    }

    setSendError(null);
    setAttachments((prev) => [...prev, ...chosen]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeFile = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageBody.trim()) {
      setSendError("Escribe el contenido del mensaje o nota.");
      return;
    }

    try {
      setSending(true);
      setSendError(null);

      const formData = new FormData();
      formData.append("Direction", direction);
      formData.append("BodyText", messageBody.trim());
      if (statusChange) {
        formData.append("Status", statusChange);
      }
      attachments.forEach((file) => {
        formData.append("Attachments", file);
      });

      await ticketsApi.createMessage(ticketId, formData);

      // Limpiar formulario y recargar
      setMessageBody("");
      setAttachments([]);
      setStatusChange("");
      await refreshTicket();
    } catch (err) {
      setSendError(
        err instanceof Error ? err.message : "Ocurrió un error al enviar el mensaje.",
      );
    } finally {
      setSending(false);
    }
  };

  // Status transitions state (Fase 4, tickets.close y sección 9.3)
  const [transitioning, setTransitioning] = useState(false);
  const [transitionError, setTransitionError] = useState<string | null>(null);

  // Cancel modal state
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState("");

  // Assign modal state (Fase 4, tickets.assign y sección 9.4)
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assignableStaff, setAssignableStaff] = useState<TicketStaffOptionResponse[]>([]);
  const [loadingStaff, setLoadingStaff] = useState(false);
  const [selectedStaffId, setSelectedStaffId] = useState<string>("");
  const [assignComment, setAssignComment] = useState("");
  const [assigning, setAssigning] = useState(false);
  const [assignError, setAssignError] = useState<string | null>(null);

  const handleUpdateStatus = async (targetStatus: string, reason?: string) => {
    try {
      setTransitioning(true);
      setTransitionError(null);
      await ticketsApi.updateStatus(ticketId, { status: targetStatus, reason });
      await refreshTicket();
    } catch (err) {
      setTransitionError(
        err instanceof Error ? err.message : "Error al cambiar el estado del ticket.",
      );
    } finally {
      setTransitioning(false);
    }
  };

  const handleConfirmCancel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cancelReason.trim()) {
      setTransitionError("La cancelación exige un motivo escrito explicativo.");
      return;
    }

    try {
      setTransitioning(true);
      setTransitionError(null);
      await ticketsApi.updateStatus(ticketId, {
        status: "Cancelado",
        reason: cancelReason.trim(),
      });
      setShowCancelModal(false);
      setCancelReason("");
      await refreshTicket();
    } catch (err) {
      setTransitionError(
        err instanceof Error ? err.message : "Error al cancelar el ticket.",
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

  // Edit ticket details modal state (Fase 8, PUT /api/tickets/{id})
  const [showEditModal, setShowEditModal] = useState(false);
  const [editSubject, setEditSubject] = useState("");
  const [editTopicId, setEditTopicId] = useState<number>(0);
  const [editPriority, setEditPriority] = useState<string>("Normal");
  const [editDepartmentId, setEditDepartmentId] = useState<number>(0);
  const [editProductLineId, setEditProductLineId] = useState<number | null>(null);
  const [editError, setEditError] = useState<string | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [editCatalogs, setEditCatalogs] = useState<TicketCreateOptionsResponse | null>(null);
  const [loadingEditCatalogs, setLoadingEditCatalogs] = useState(false);

  const handleOpenEditModal = async () => {
    if (!ticket) return;
    setEditSubject(ticket.subject);
    setEditTopicId(ticket.topicId);
    setEditPriority(ticket.priority);
    setEditDepartmentId(ticket.departmentId);
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

  // Consolidar mensajes y eventos en una línea de tiempo ordenada
  const timeline: TimelineItem[] = [
    ...ticket.messages.map(
      (m): TimelineItem => ({ kind: "message", data: m, createdAt: m.createdAt }),
    ),
    ...ticket.events.map(
      (e): TimelineItem => ({ kind: "event", data: e, createdAt: e.createdAt }),
    ),
  ].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  return (
    <div className="min-h-screen bg-slate-50/50 pb-16">
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
          </div>
        </div>
      </div>

      {/* Contenedor principal de 2 columnas */}
      <div className="mx-auto max-w-7xl px-6 py-6">
        {/* Título, metadatos rápidos y botones de acción rápida de estado (Sección 9.3) */}
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

          {/* Barra de acciones de cambio de estado de la máquina de estados 9.3 */}
          <div className="flex flex-wrap items-center gap-2">
            {ticket.status === "Abierto" && (
              <>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={transitioning}
                  onClick={() => handleUpdateStatus("En espera del cliente")}
                  title="Pausa el SLA mientras se espera respuesta del cliente"
                >
                  <Clock className="h-3.5 w-3.5" />
                  En espera
                </Button>

                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={transitioning}
                  onClick={() => handleUpdateStatus("Reenvío de producto")}
                  title="Marca el caso para reenvío de producto"
                >
                  <Package className="h-3.5 w-3.5" />
                  Reenvío
                </Button>

                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  disabled={transitioning}
                  onClick={() => {
                    const hasOutbound = ticket.messages.some((m) => m.direction === "Saliente");
                    if (!hasOutbound) {
                      setTransitionError(
                        "No se puede marcar como solucionado un ticket sin haber enviado al menos una respuesta al cliente.",
                      );
                      return;
                    }
                    handleUpdateStatus("Solucionado");
                  }}
                  title="Marca como solucionado (requiere respuesta previa al cliente)"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Solucionar
                </Button>

                <Button
                  type="button"
                  variant="danger"
                  size="sm"
                  disabled={transitioning}
                  onClick={() => {
                    setTransitionError(null);
                    setShowCancelModal(true);
                  }}
                  title="Cancela el ticket definitivamente (exige motivo escrito)"
                >
                  <X className="h-3.5 w-3.5" />
                  Cancelar
                </Button>
              </>
            )}

            {ticket.status === "En espera del cliente" && (
              <>
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  disabled={transitioning}
                  onClick={() => handleUpdateStatus("Abierto")}
                  title="Reanuda la atención y el cómputo de SLA"
                >
                  Reanudar a Abierto
                </Button>
                <Button
                  type="button"
                  variant="danger"
                  size="sm"
                  disabled={transitioning}
                  onClick={() => {
                    setTransitionError(null);
                    setShowCancelModal(true);
                  }}
                  title="Cancela el ticket definitivamente"
                >
                  <X className="h-3.5 w-3.5" />
                  Cancelar
                </Button>
              </>
            )}

            {ticket.status === "Reenvío de producto" && (
              <>
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  disabled={transitioning}
                  onClick={() => handleUpdateStatus("Solucionado")}
                  title="Marca el ticket como solucionado"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Marcar Solucionado
                </Button>
                <Button
                  type="button"
                  variant="danger"
                  size="sm"
                  disabled={transitioning}
                  onClick={() => {
                    setTransitionError(null);
                    setShowCancelModal(true);
                  }}
                  title="Cancela el ticket definitivamente"
                >
                  <X className="h-3.5 w-3.5" />
                  Cancelar
                </Button>
              </>
            )}

            {ticket.status === "Solucionado" && (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={transitioning}
                onClick={() => handleUpdateStatus("Abierto")}
                title="Reabre el ticket (incrementa el contador de reaperturas)"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Reabrir ticket
              </Button>
            )}

            {ticket.status === "Cancelado" && (
              <span className="rounded-md border border-rose-200 bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-700">
                Cancelado (Cerrado definitivo)
              </span>
            )}
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

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Columna Izquierda: Hilo de conversación y redactor (8 cols) */}
          <div className="space-y-6 lg:col-span-8">
            {/* Hilo de conversación */}
            <div className="space-y-4">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-faint">
                Historial de conversación y eventos
              </h2>

              {timeline.length === 0 ? (
                <div className="rounded-xl border border-dashed border-line-strong bg-white p-8 text-center text-sm text-subtle">
                  No hay intervenciones ni eventos registrados aún en este ticket.
                </div>
              ) : (
                timeline.map((item, idx) => {
                  if (item.kind === "event") {
                    const evt = item.data;
                    const isBreach =
                      evt.eventType === "SlaBreached" ||
                      Boolean(evt.details?.toLowerCase().includes("incumplimiento de sla"));
                    return (
                      <div
                        key={`evt-${evt.id}-${idx}`}
                        className="my-3 flex items-center justify-center gap-2 text-xs text-subtle"
                      >
                        <span className={`h-px flex-1 ${isBreach ? "bg-red-200" : "bg-line-soft"}`} />
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] shadow-2xs ${
                            isBreach
                              ? "border-red-300 bg-red-50 text-red-700 font-semibold"
                              : "border-line-soft bg-white text-ink"
                          }`}
                        >
                          {isBreach ? (
                            <AlertTriangle className="h-3.5 w-3.5 text-red-600" />
                          ) : (
                            <CheckCircle2 className="h-3 w-3 text-brand-red" />
                          )}
                          <span className={isBreach ? "text-red-900" : "font-medium text-ink"}>
                            {evt.actorStaffName ?? "Sistema"}:
                          </span>
                          <span>{evt.details ?? evt.eventType}</span>
                          <span className={isBreach ? "text-red-500 font-normal" : "text-subtle/70"}>
                            ({formatDateTime(evt.createdAt)})
                          </span>
                        </span>
                        <span className={`h-px flex-1 ${isBreach ? "bg-red-200" : "bg-line-soft"}`} />
                      </div>
                    );
                  }

                  const msg = item.data;
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
                              ticket.requesterName ??
                              "Remitente"}
                          </span>
                        </div>

                        <span className="text-[11.5px] text-subtle">
                          {formatDateTime(msg.createdAt)}
                        </span>
                      </div>

                      {/* Advertencia explícita en notas internas */}
                      {isInternal && (
                        <div className="mt-2.5 flex items-center gap-1.5 rounded-md bg-amber-100/90 px-2.5 py-1 text-[11px] font-medium text-amber-900">
                          <ShieldAlert className="h-3.5 w-3.5 shrink-0 text-amber-700" />
                          <span>
                            Solo visible para el personal de Plastifar. El cliente no puede ver
                            este mensaje ni recibe copia.
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
                                <span className="text-[10.5px] text-subtle">
                                  ({formatBytes(att.sizeBytes)})
                                </span>
                                <Download className="h-3 w-3 text-subtle" />
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* Redactor de Respuestas / Notas Internas */}
            <div
              className={`rounded-xl border transition-all ${
                direction === "Interna"
                  ? "border-amber-400 bg-amber-50/30 p-5 shadow-sm"
                  : "border-line-soft bg-white p-5 shadow-xs"
              }`}
            >
              {/* Selector de modo de intervención */}
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-line-soft pb-3">
                <div className="inline-flex rounded-lg border border-line-soft bg-slate-100 p-1">
                  <button
                    type="button"
                    onClick={() => {
                      setDirection("Saliente");
                      setSendError(null);
                    }}
                    className={`inline-flex items-center gap-2 rounded-md px-3.5 py-1.5 text-xs font-semibold transition-all ${
                      direction === "Saliente"
                        ? "bg-white text-ink shadow-2xs"
                        : "text-subtle hover:text-ink"
                    }`}
                  >
                    <Send className="h-3.5 w-3.5 text-sky-600" />
                    Responder al cliente
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setDirection("Interna");
                      setSendError(null);
                    }}
                    className={`inline-flex items-center gap-2 rounded-md px-3.5 py-1.5 text-xs font-semibold transition-all ${
                      direction === "Interna"
                        ? "bg-amber-500 text-white shadow-2xs"
                        : "text-subtle hover:text-ink"
                    }`}
                  >
                    <Lock className="h-3.5 w-3.5" />
                    Nota interna
                  </button>
                </div>

                {/* Cambio de estado opcional */}
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-subtle font-medium">Cambiar estado a:</span>
                  <select
                    value={statusChange}
                    onChange={(e) => setStatusChange(e.target.value)}
                    className="h-8 rounded-lg border border-line-strong bg-white px-2.5 text-xs text-ink focus:border-brand-red focus:outline-none"
                  >
                    <option value="">(Mantener estado actual)</option>
                    <option value="Abierto">Abierto</option>
                    <option value="En espera del cliente">En espera del cliente</option>
                    <option value="Reenvío de producto">Reenvío de producto</option>
                    <option value="Solucionado">Solucionado</option>
                  </select>
                </div>
              </div>

              {/* Banner de alto contraste si está en modo Nota Interna */}
              {direction === "Interna" ? (
                <div className="mb-3.5 flex items-start gap-2.5 rounded-lg border border-amber-300 bg-amber-100/90 p-3 text-xs text-amber-950">
                  <Lock className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
                  <div>
                    <span className="font-bold">MODO NOTA INTERNA ACTIVADO:</span> Esta nota es
                    completamente privada y confidencial. Solo el personal del sistema podrá leerla.
                    <span className="font-semibold text-amber-900">
                      {" "}
                      NUNCA se enviará ni notificará al cliente.
                    </span>
                  </div>
                </div>
              ) : (
                <div className="mb-3.5 flex items-center gap-2 text-xs text-sky-800">
                  <Mail className="h-3.5 w-3.5 text-sky-600" />
                  <span>
                    Esta respuesta será entregada al cliente (
                    {ticket.contactEmail ?? ticket.requesterEmail ?? "contacto"}).
                  </span>
                </div>
              )}

              {sendError && (
                <div className="mb-3">
                  <Alert variant="error">{sendError}</Alert>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-3">
                <textarea
                  rows={4}
                  value={messageBody}
                  onChange={(e) => setMessageBody(e.target.value)}
                  placeholder={
                    direction === "Interna"
                      ? "Escribe aquí la nota interna confidencial para el equipo..."
                      : "Escribe tu respuesta para el cliente..."
                  }
                  className={`w-full rounded-lg border p-3 text-sm text-ink placeholder:text-subtle focus:outline-none ${
                    direction === "Interna"
                      ? "border-amber-300 bg-white focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
                      : "border-line-strong bg-white focus:border-brand-red focus:ring-1 focus:ring-brand-red"
                  }`}
                />

                {/* Lista de adjuntos seleccionados */}
                {attachments.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {attachments.map((f, i) => (
                      <span
                        key={`${f.name}-${i}`}
                        className="inline-flex items-center gap-1.5 rounded-md border border-line-soft bg-white px-2.5 py-1 text-xs text-ink"
                      >
                        <Paperclip className="h-3 w-3 text-subtle" />
                        <span className="max-w-[160px] truncate">{f.name}</span>
                        <span className="text-[10px] text-subtle">({formatBytes(f.size)})</span>
                        <button
                          type="button"
                          onClick={() => removeFile(i)}
                          className="ml-1 text-subtle hover:text-rose-600"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}

                {/* Barra de herramientas inferior */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                  <div className="flex items-center gap-2">
                    <input
                      ref={fileInputRef}
                      type="file"
                      multiple
                      onChange={handleFileChange}
                      className="hidden"
                      id="ticket-attachment-input"
                    />
                    <label
                      htmlFor="ticket-attachment-input"
                      className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-line-strong bg-white px-3 py-1.5 text-xs font-medium text-subtle transition-colors hover:bg-slate-50 hover:text-ink"
                    >
                      <Paperclip className="h-3.5 w-3.5" />
                      Adjuntar archivos (máx 10 MB c/u)
                    </label>
                  </div>

                  <div className="flex items-center gap-3">
                    {direction === "Saliente" && ticket.status !== "Cancelado" && (
                      <div className="flex items-center gap-1.5 text-xs text-subtle">
                        <label htmlFor="composer-status" className="whitespace-nowrap font-medium text-ink">
                          Estado:
                        </label>
                        <select
                          id="composer-status"
                          value={statusChange}
                          onChange={(e) => setStatusChange(e.target.value)}
                          className="h-8 rounded-lg border border-line-strong bg-white px-2 text-xs text-ink focus:border-brand-red focus:outline-none"
                        >
                          <option value="">(Sin cambio — {ticket.status})</option>
                          {ticket.status === "Abierto" && (
                            <>
                              <option value="En espera del cliente">En espera del cliente</option>
                              <option value="Reenvío de producto">Reenvío de producto</option>
                              <option value="Solucionado">Solucionado</option>
                            </>
                          )}
                          {ticket.status === "En espera del cliente" && (
                            <option value="Abierto">Abierto</option>
                          )}
                          {ticket.status === "Reenvío de producto" && (
                            <option value="Solucionado">Solucionado</option>
                          )}
                        </select>
                      </div>
                    )}

                    {direction === "Interna" ? (
                      <button
                        type="submit"
                        disabled={sending}
                        className="inline-flex items-center gap-2 rounded-lg bg-amber-500 px-4 py-2 text-xs font-bold uppercase tracking-wider text-white shadow-xs transition-colors hover:bg-amber-600 disabled:opacity-50"
                      >
                        {sending ? (
                          <Spinner size="sm" />
                        ) : (
                          <Lock className="h-3.5 w-3.5" />
                        )}
                        Guardar nota interna
                      </button>
                    ) : (
                      <Button
                        type="submit"
                        variant="primary"
                        isLoading={sending}
                        className="gap-2"
                      >
                        <Send className="h-3.5 w-3.5" />
                        Enviar respuesta
                      </Button>
                    )}
                  </div>
                </div>
              </form>
            </div>
          </div>

          {/* Columna Derecha: Tarjetas de contexto lateral (4 cols) */}
          <div className="space-y-5 lg:col-span-4">
            {/* Tarjeta 1: Cliente & Contacto */}
            <div className="rounded-xl border border-line-soft bg-white p-5 shadow-xs">
              <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-faint">
                <Building2 className="h-4 w-4 text-brand-red" />
                Cliente y Contacto
              </h3>
              <div className="mt-3.5 space-y-2 text-xs">
                <div>
                  <span className="text-subtle">Razón social:</span>
                  <p className="font-semibold text-ink">{ticket.clientName}</p>
                </div>
                <div>
                  <span className="text-subtle">Código:</span>
                  <p className="font-mono text-ink">{ticket.clientCode}</p>
                </div>
                {ticket.contactName && (
                  <div className="border-t border-line-soft pt-2">
                    <span className="text-subtle">Contacto:</span>
                    <p className="font-medium text-ink">{ticket.contactName}</p>
                  </div>
                )}
                {(ticket.contactEmail ?? ticket.requesterEmail) && (
                  <div className="flex items-center gap-1.5 text-subtle">
                    <Mail className="h-3.5 w-3.5 shrink-0" />
                    <a
                      href={`mailto:${ticket.contactEmail ?? ticket.requesterEmail}`}
                      className="truncate text-ink hover:underline"
                    >
                      {ticket.contactEmail ?? ticket.requesterEmail}
                    </a>
                  </div>
                )}
                {ticket.contactPhone && (
                  <div className="flex items-center gap-1.5 text-subtle">
                    <Phone className="h-3.5 w-3.5 shrink-0" />
                    <span className="text-ink">{ticket.contactPhone}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Tarjeta 2: Atributos del Caso */}
            <div className="rounded-xl border border-line-soft bg-white p-5 shadow-xs">
              <div className="flex items-center justify-between">
                <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-faint">
                  <User className="h-4 w-4 text-brand-red" />
                  Atributos del Ticket
                </h3>
                {ticket.status !== "Cancelado" && ticket.status !== "Cerrado" && (
                  <button
                    type="button"
                    onClick={() => void handleOpenEditModal()}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-brand-red transition-colors hover:underline cursor-pointer"
                    title="Editar campos clave del ticket"
                  >
                    <Pencil className="h-3 w-3" />
                    Editar
                  </button>
                )}
              </div>
              <div className="mt-3.5 space-y-2.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-subtle">Departamento:</span>
                  <span className="font-semibold text-ink">{ticket.departmentName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-subtle">Tema / Motivo:</span>
                  <span className="font-medium text-ink">{ticket.topicName}</span>
                </div>
                {ticket.productLineName && (
                  <div className="flex justify-between">
                    <span className="text-subtle">Línea de producto:</span>
                    <span className="font-medium text-ink">{ticket.productLineName}</span>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-subtle">Asignado a:</span>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-ink">
                      {ticket.assignedStaffName ?? "Sin asignar"}
                    </span>
                    {ticket.status !== "Cancelado" && (
                      <button
                        type="button"
                        onClick={() => void handleOpenAssignModal()}
                        className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-semibold text-brand-red transition-colors hover:bg-red-50 hover:underline"
                        title="Asignar o reasignar ticket"
                      >
                        <UserCheck className="h-3 w-3" />
                        {ticket.assignedStaffId ? "Cambiar" : "Asignar"}
                      </button>
                    )}
                  </div>
                </div>
                <div className="flex justify-between">
                  <span className="text-subtle">Canal de origen:</span>
                  <span className="font-medium text-ink">{ticket.channel}</span>
                </div>
              </div>
            </div>

            {/* Tarjeta 3: SLA y Tiempos */}
            <div className="rounded-xl border border-line-soft bg-white p-5 shadow-xs">
              <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-faint">
                <Clock className="h-4 w-4 text-brand-red" />
                SLA y Métricas de Tiempo
              </h3>
              <div className="mt-3.5 space-y-2.5 text-xs">
                <div>
                  <span className="text-subtle">Vencimiento de Resolución:</span>
                  <p className="font-medium text-ink">
                    {ticket.resolutionDueAt
                      ? formatDateTime(ticket.resolutionDueAt)
                      : "No configurado"}
                  </p>
                </div>

                <div>
                  <span className="text-subtle">Primera respuesta:</span>
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
            </div>

            {/* Tarjeta 4: Observadores */}
            {ticket.watchers && ticket.watchers.length > 0 && (
              <div className="rounded-xl border border-line-soft bg-white p-5 shadow-xs">
                <h3 className="text-xs font-bold uppercase tracking-wider text-faint">
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

            {/* Tarjeta 5: Todos los adjuntos del ticket */}
            {ticket.attachments && ticket.attachments.length > 0 && (
              <div className="rounded-xl border border-line-soft bg-white p-5 shadow-xs">
                <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-faint">
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
        </div>
      </div>

      {/* Modal para Cancelar Ticket (Sección 9.3: exige motivo explicativo) */}
      {showCancelModal && (
        <Modal
          eyebrow={ticket.number}
          title="Cancelar ticket"
          description="La cancelación es definitiva y cerrará el caso de forma permanente. Debes indicar un motivo explicativo obligatorio."
          onClose={() => {
            if (!transitioning) setShowCancelModal(false);
          }}
          footer={
            <>
              <Button
                type="button"
                variant="secondary"
                disabled={transitioning}
                onClick={() => setShowCancelModal(false)}
              >
                Volver
              </Button>
              <Button
                type="submit"
                form="cancel-ticket-form"
                variant="danger"
                isLoading={transitioning}
              >
                Confirmar cancelación
              </Button>
            </>
          }
        >
          <form id="cancel-ticket-form" onSubmit={handleConfirmCancel} className="space-y-4">
            {transitionError && <Alert variant="error">{transitionError}</Alert>}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="cancel-reason" className="text-xs font-semibold text-ink">
                Motivo de cancelación <span className="text-brand-red">*</span>
              </label>
              <textarea
                id="cancel-reason"
                rows={4}
                required
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="Explica detalladamente por qué se cancela este ticket..."
                className="w-full rounded-lg border border-line-strong p-3 text-xs text-ink placeholder:text-subtle focus:border-brand-red focus:outline-none focus:ring-1 focus:ring-brand-red"
              />
            </div>
          </form>
        </Modal>
      )}

      {/* Modal para Asignar Ticket (Sección 9.4) */}
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
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="assign-staff-select" className="text-xs font-semibold text-ink">
                    Colaborador asignado
                  </label>
                  <select
                    id="assign-staff-select"
                    value={selectedStaffId}
                    onChange={(e) => setSelectedStaffId(e.target.value)}
                    className="h-9 w-full rounded-lg border border-line-strong bg-white px-3 text-xs text-ink focus:border-brand-red focus:outline-none focus:ring-1 focus:ring-brand-red"
                  >
                    <option value="">— Sin asignar (desasignar) —</option>
                    {assignableStaff.map((s) => (
                      <option key={s.id} value={String(s.id)}>
                        {s.fullName} ({s.email})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label htmlFor="assign-comment-input" className="text-xs font-semibold text-ink">
                    Nota o comentario interno (opcional)
                  </label>
                  <input
                    id="assign-comment-input"
                    type="text"
                    value={assignComment}
                    onChange={(e) => setAssignComment(e.target.value)}
                    placeholder="Ej: Reasignado para soporte especializado de producto..."
                    className="h-9 w-full rounded-lg border border-line-strong bg-white px-3 text-xs text-ink placeholder:text-subtle focus:border-brand-red focus:outline-none focus:ring-1 focus:ring-brand-red"
                  />
                </div>
              </>
            )}
          </form>
        </Modal>
      )}

      {/* Modal para Editar Atributos del Ticket (RF-T10 / PUT /api/tickets/{id}) */}
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
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="edit-subject" className="text-xs font-semibold text-ink">
                    Asunto <span className="text-brand-red">*</span>
                  </label>
                  <input
                    id="edit-subject"
                    type="text"
                    required
                    maxLength={200}
                    value={editSubject}
                    onChange={(e) => setEditSubject(e.target.value)}
                    className="h-9 w-full rounded-lg border border-line-strong bg-white px-3 text-xs text-ink focus:border-brand-red focus:outline-none focus:ring-1 focus:ring-brand-red"
                  />
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="edit-topic" className="text-xs font-semibold text-ink">
                      Motivo / Tema <span className="text-brand-red">*</span>
                    </label>
                    <select
                      id="edit-topic"
                      value={editTopicId}
                      onChange={(e) => {
                        const newId = Number(e.target.value);
                        setEditTopicId(newId);
                        const foundTopic = editCatalogs?.topics.find((t) => t.id === newId);
                        if (foundTopic) {
                          if (foundTopic.defaultDepartmentId) {
                            setEditDepartmentId(foundTopic.defaultDepartmentId);
                          }
                          if (foundTopic.defaultPriority) {
                            setEditPriority(foundTopic.defaultPriority);
                          }
                        }
                      }}
                      className="h-9 w-full rounded-lg border border-line-strong bg-white px-3 text-xs text-ink focus:border-brand-red focus:outline-none focus:ring-1 focus:ring-brand-red"
                    >
                      {(editCatalogs?.topics ?? []).map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="edit-priority" className="text-xs font-semibold text-ink">
                      Prioridad <span className="text-brand-red">*</span>
                    </label>
                    <select
                      id="edit-priority"
                      value={editPriority}
                      onChange={(e) => setEditPriority(e.target.value)}
                      className="h-9 w-full rounded-lg border border-line-strong bg-white px-3 text-xs text-ink focus:border-brand-red focus:outline-none focus:ring-1 focus:ring-brand-red"
                    >
                      <option value="Emergencia">Emergencia</option>
                      <option value="Alta">Alta</option>
                      <option value="Normal">Normal</option>
                      <option value="Baja">Baja</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="edit-dept" className="text-xs font-semibold text-ink">
                      Departamento <span className="text-brand-red">*</span>
                    </label>
                    <select
                      id="edit-dept"
                      value={editDepartmentId}
                      onChange={(e) => setEditDepartmentId(Number(e.target.value))}
                      className="h-9 w-full rounded-lg border border-line-strong bg-white px-3 text-xs text-ink focus:border-brand-red focus:outline-none focus:ring-1 focus:ring-brand-red"
                    >
                      {(editCatalogs?.departments ?? []).map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="edit-line" className="text-xs font-semibold text-ink">
                      Línea de producto
                    </label>
                    <select
                      id="edit-line"
                      value={editProductLineId ?? ""}
                      onChange={(e) =>
                        setEditProductLineId(e.target.value ? Number(e.target.value) : null)
                      }
                      className="h-9 w-full rounded-lg border border-line-strong bg-white px-3 text-xs text-ink focus:border-brand-red focus:outline-none focus:ring-1 focus:ring-brand-red"
                    >
                      <option value="">— Ninguna / No aplica —</option>
                      {(editCatalogs?.productLines ?? []).map((pl) => (
                        <option key={pl.id} value={pl.id}>
                          {pl.name} ({pl.code})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <p className="text-[11.5px] text-subtle leading-relaxed">
                  Nota: Si cambias el departamento y el colaborador actualmente asignado no pertenece al nuevo departamento, será desasignado automáticamente según la regla 9.4.8.
                </p>
              </>
            )}
          </form>
        </Modal>
      )}
    </div>
  );
}
