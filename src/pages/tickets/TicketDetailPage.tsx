import { ArrowLeft, History, Lock, RotateCcw, Workflow } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ticketsApi } from "../../api/tickets";
import { ModuleHeader, type ModuleHeaderSection } from "../../components/app/ModuleHeader";
import { Alert } from "../../components/ui/Alert";
import { Button } from "../../components/ui/Button";
import { Spinner } from "../../components/ui/Spinner";
import { openOverlay } from "../../hooks/overlayStack";
import { useSettle } from "../../hooks/useSettle";
import { useUploadFeedback } from "../../hooks/useUploadFeedback";
import { useAuth } from "../../context/useAuth";
import { useDynamicBreadcrumb } from "../../context/useBreadcrumb";
import { useEmailCounts } from "../../context/useEmailCounts";
import { useReceipts } from "../../context/useReceipts";
import { departmentPath } from "../../lib/departments";
import { blocksToEmailHtml, blocksToText } from "../../lib/emailHtml";
import { formatDateTime, formatSlaRemaining } from "../../lib/format";
import type { TicketAttachmentResponse, TicketDetailResponse, TicketTaskCommentResponse, TicketTaskResponse } from "../../types/api";
import { AttachmentPreviewModal } from "../bandeja/AttachmentPreviewModal";
import { PriorityCell, StatusCell } from "./ticketCells";
import { TaskCommentsAside, type TaskCommentsAsideHandle } from "./TaskCommentsAside";
import { TicketTasksTab } from "./TicketTasksTab";
import { TicketTimelineSheet, type TicketDetailTab, type TimelineItem } from "./TicketTimelineSheet";
import { TicketFormsTab } from "./TicketFormsTab";
import { usePermissions } from "../../hooks/usePermissions";
import { TicketAssignModal } from "./detail/TicketAssignModal";
import { TicketConversationTab } from "./detail/TicketConversationTab";
import { TicketEditModal } from "./detail/TicketEditModal";
import { TicketNoteModal } from "./detail/TicketNoteModal";
import { TicketNotesTab } from "./detail/TicketNotesTab";
import { TicketOverviewTab } from "./detail/TicketOverviewTab";
import { TicketReplyComposer } from "./detail/TicketReplyComposer";
import { TicketStatusUpdateModal } from "./detail/TicketStatusUpdateModal";
import { getAvailableTransitions } from "./detail/ticketTransitions";
import { useTicketAssign } from "./detail/useTicketAssign";
import { useTicketEdit } from "./detail/useTicketEdit";
import { useTicketStatusUpdate } from "./detail/useTicketStatusUpdate";

export function TicketDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const ticketId = id ? parseInt(id, 10) : 0;

  const [ticket, setTicket] = useState<TicketDetailResponse | null>(null);
  const [loading, setLoading] = useState(Boolean(ticketId));
  const [error, setError] = useState<string | null>(ticketId ? null : "Identificador de ticket no válido.");

  const { user } = useAuth();
  // Formularios empresariales del ciclo de vida del ticket (PF-FOR-034, 068, 291, 109)
  const { can } = usePermissions();
  const canReadForms =
    can("claims.read", ticket?.departmentId ?? undefined) ||
    can("withdrawals.read") ||
    can("discrepancies.read") ||
    can("quality.read");
  const [hasForms, setHasForms] = useState<boolean | null>(null);
  const [searchParams] = useSearchParams();
  const initialUrlTab = searchParams.get("tab") as TicketDetailTab | null;
  const [activeTab, setActiveTab] = useState<TicketDetailTab>(
    initialUrlTab && ["datos", "conversacion", "tareas", "notas", "formularios", "reclamacion"].includes(initialUrlTab)
      ? initialUrlTab
      : "datos"
  );

  useEffect(() => {
    const tab = searchParams.get("tab") as TicketDetailTab | null;
    if (tab && ["datos", "conversacion", "tareas", "notas", "formularios", "reclamacion"].includes(tab)) {
      setActiveTab(tab);
    }
  }, [searchParams]);
  const [tasksCount, setTasksCount] = useState(0);
  useDynamicBreadcrumb(ticket?.number ?? null);
  const [showTimeline, setShowTimeline] = useState(false);
  const [activeCommentsTask, setActiveCommentsTask] = useState<TicketTaskResponse | null>(null);
  const commentsAsideRef = useRef<TaskCommentsAsideHandle>(null);
  const [latestAddedComment, setLatestAddedComment] = useState<{
    taskId: number;
    comment: TicketTaskCommentResponse;
  } | null>(null);

  const handleToggleTaskComments = useCallback((task: TicketTaskResponse) => {
    setActiveCommentsTask((prev) => {
      if (prev?.id === task.id) {
        if (commentsAsideRef.current) {
          commentsAsideRef.current.requestClose();
          return prev;
        }
        return null;
      }
      return task;
    });
  }, []);

  // Respuesta al cliente: el mismo editor que la bandeja, porque lo que sale de aqui tambien es un correo.
  const [replyOpen, setReplyOpen] = useState(false);
  const [replyBlocks, setReplyBlocks] = useState<unknown>(null);
  // Remontar el editor es la forma de vaciarlo: su contenido inicial no es controlado.
  const [replyEditorKey, setReplyEditorKey] = useState(0);
  const [replyAttachments, setReplyAttachments] = useState<File[]>([]);
  const {
    isShowing: showReplyAttachedFeedback,
    isExiting: replyAttachedExiting,
    trigger: triggerReplyAttachedFeedback,
  } = useUploadFeedback({ duration: 2200, exitDuration: 360 });
  const [replySending, setReplySending] = useState(false);
  const [replySendError, setReplySendError] = useState<string | null>(null);
  const replyFileInputRef = useRef<HTMLInputElement>(null);

  const [showNoteModal, setShowNoteModal] = useState(false);
  const [noteBody, setNoteBody] = useState("");
  const [noteAttachments, setNoteAttachments] = useState<File[]>([]);
  const [isDraggingNote, setIsDraggingNote] = useState(false);
  const {
    isShowing: showNoteAttachedFeedback,
    isExiting: noteAttachedExiting,
    trigger: triggerNoteAttachedFeedback,
  } = useUploadFeedback({ duration: 2200, exitDuration: 360 });
  const [noteSending, setNoteSending] = useState(false);
  const [noteSendError, setNoteSendError] = useState<string | null>(null);
  const noteFileInputRef = useRef<HTMLInputElement>(null);

  // Que adjunto se esta mirando y con que vecinos, para poder saltar entre ellos.
  const [preview, setPreview] = useState<{ attachments: TicketAttachmentResponse[]; index: number } | null>(null);

  // Varias recargas seguidas (avisos del hub, acciones propias) solo dejan pintar la ultima pedida.
  const refreshSeq = useRef(0);
  const refreshTicket = useCallback(async () => {
    if (!ticketId) return;
    const seq = ++refreshSeq.current;
    try {
      const [ticketData, tasksData] = await Promise.all([
        ticketsApi.getById(ticketId),
        ticketsApi.getTasks(ticketId).catch(() => null),
      ]);
      if (seq !== refreshSeq.current) return;
      setTicket(ticketData);
      if (tasksData) {
        setTasksCount(tasksData.length);
      }
    } catch (err) {
      if (seq !== refreshSeq.current) return;
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

    Promise.all([
      ticketsApi.getById(ticketId),
      ticketsApi.getTasks(ticketId).catch(() => null),
    ])
      .then(([ticketData, tasksData]) => {
        if (!active) return;
        setTicket(ticketData);
        if (tasksData) {
          setTasksCount(tasksData.length);
        }
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
  const receipts = useReceipts();

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

  // El editor tapa la pagina entera: Escape tiene que devolverte a donde estabas, salvo que haya un modal encima.
  useEffect(() => {
    if (!replyOpen) return;
    const overlay = openOverlay();
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape" && overlay.isTop()) setReplyOpen(false);
    }
    document.addEventListener("keydown", handleEscape);
    return () => {
      overlay.close();
      document.removeEventListener("keydown", handleEscape);
    };
  }, [replyOpen]);

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
      receipts.done({ action: "responder-ticket", title: "Respuesta enviada", detail: ticket?.number });
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
      receipts.done({ action: "nota-ticket", title: "Nota interna guardada", detail: ticket?.number });
    } catch (err) {
      setNoteSendError(err instanceof Error ? err.message : "Error al guardar nota");
      triggerNoteSettle();
    } finally {
      setNoteSending(false);
    }
  };

  const statusUpdate = useTicketStatusUpdate({
    ticket,
    ticketId,
    refreshTicket,
    receipts,
    triggerSettle: triggerUpdateSettle,
  });
  const assign = useTicketAssign({ ticket, ticketId, refreshTicket, receipts, triggerSettle: triggerAssignSettle });
  const edit = useTicketEdit({ ticket, ticketId, refreshTicket, receipts, triggerSettle: triggerEditSettle });

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
  const normStatus = ticket.status.toLowerCase().trim();
  const isSolucionado = normStatus === "solucionado" || normStatus === "solucionada";
  const isCancelado = normStatus === "cancelado";
  const isCerrado = normStatus === "cerrado";
  const isClosed = isCancelado || isCerrado;

  const byDate = (a: { createdAt: string }, b: { createdAt: string }) =>
    new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();

  const timeline: TimelineItem[] = [
    ...ticket.messages.map((m): TimelineItem => ({ kind: "message", data: m, createdAt: m.createdAt })),
    ...ticket.events.map((e): TimelineItem => ({ kind: "event", data: e, createdAt: e.createdAt })),
  ].sort(byDate);

  const sortedMessages = [...ticket.messages].sort(byDate);
  const originMessage = sortedMessages.find((m) => m.isOrigin) ?? sortedMessages[0];
  const clientThread = sortedMessages.filter((m) => m.direction.toLowerCase() !== "interna");
  const internalNotes = sortedMessages.filter((m) => m.direction.toLowerCase() === "interna");
  const recipientEmail = ticket.contactEmail ?? ticket.requesterEmail ?? null;
  const currentDepartmentPath = departmentPath(edit.editDepartmentTree ?? [], ticket.departmentId);
  const departmentLabel = currentDepartmentPath ?? ticket.departmentName;
  const canAssign = ticket.status !== "Cancelado";

  // Se declaran aqui, con el destinatario: sendReply las lee al ejecutarse, no al definirse.
  const replyText = blocksToText(replyBlocks);
  const replyReady = Boolean(recipientEmail) && replyText.trim().length > 0;

  /** Cambia de pestana; fuera de Tareas el panel de comentarios se cierra. */
  const goToTab = (tab: TicketDetailTab) => {
    setActiveTab(tab);
    if (tab !== "tareas") setActiveCommentsTask(null);
  };

  const sections: ModuleHeaderSection[] = [
    {
      label: "Datos",
      active: activeTab === "datos",
      onClick: () => goToTab("datos"),
    },
    {
      label: `Conversación (${clientThread.length})`,
      active: activeTab === "conversacion",
      onClick: () => goToTab("conversacion"),
    },
    {
      label: `Tareas (${tasksCount})`,
      active: activeTab === "tareas",
      onClick: () => goToTab("tareas"),
    },
    {
      label: `Notas internas (${internalNotes.length})`,
      active: activeTab === "notas",
      onClick: () => goToTab("notas"),
    },
    ...(canReadForms
      ? [
          {
            label: (
              <span className="inline-flex items-center gap-1.5">
                Formularios
                {hasForms && (
                  <span className="size-1.5 rounded-full bg-brand-red" title="Tiene formularios registrados" />
                )}
              </span>
            ),
            active: activeTab === "formularios" || activeTab === "reclamacion",
            onClick: () => goToTab("formularios"),
          },
        ]
      : []),
  ];

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <ModuleHeader
        backTo="/tickets"
        backLabel="Volver al listado de tickets"
        title={ticket.number}
        badge={
          <div className="flex items-center gap-1.5">
            <StatusCell status={ticket.status} />
            {!isClosed && <PriorityCell priority={ticket.priority} />}
          </div>
        }
        sections={sections}
        action={
          <div className="flex items-center gap-2">
            <Button type="button" variant="secondary" size="sm" onClick={() => setShowTimeline(true)}>
              <History className="h-[15px] w-[15px]" />
              Historial
              <span className="tabular-nums text-subtle">{timeline.length}</span>
            </Button>
            {availableTransitions.length > 0 ? (
              <Button
                type="button"
                size="sm"
                variant={isSolucionado ? "secondary" : "primary"}
                onClick={statusUpdate.handleOpenUpdateStatusModal}
                className="group font-heading font-semibold tracking-[-0.01em] shadow-xs hover:shadow-sm transition-all active:scale-[0.98]"
              >
                {isSolucionado ? (
                  <>
                    <RotateCcw className="h-3.5 w-3.5 transition-transform duration-200 group-hover:-rotate-45" />
                    Reabrir Ticket
                  </>
                ) : (
                  <>
                    <Workflow className="h-3.5 w-3.5 transition-transform duration-200 group-hover:scale-110" />
                    Actualizar ticket
                  </>
                )}
              </Button>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200/80 bg-zinc-50/80 px-2.5 py-1 text-[11.5px] font-semibold text-zinc-600 shadow-2xs">
                <Lock className="size-3 text-zinc-400" strokeWidth={2.25} />
                <span>Cierre definitivo</span>
              </span>
            )}
          </div>
        }
      />

      {/* Zona de contenido con scroll vertical asegurado */}
      <div className="flex-1 min-h-0 overflow-y-auto pr-0.5 pb-8">
        <div
          className={`w-full transition-all duration-200 ${
            activeTab === "formularios" || activeTab === "reclamacion"
              ? "px-4 sm:px-6 2xl:px-8"
              : "mx-auto max-w-6xl"
          }`}
        >
          <div className="pt-2">
            <h1 className="text-balance font-heading text-[20px] font-bold leading-snug tracking-[-0.02em] text-ink">
              {ticket.subject}
            </h1>
            <p className="mt-1.5 flex flex-wrap items-center gap-x-1.5 text-[12px] text-zinc-500">
              <span>Creado el {formatDateTime(ticket.createdAt)} por</span>
              <span className="font-medium text-zinc-800">{ticket.createdByStaffName ?? ticket.requesterName ?? "Sistema"}</span>
              <span aria-hidden className="text-zinc-300">·</span>
              <span className="font-heading text-[9.5px] font-bold uppercase tracking-[0.08em] text-zinc-400">{ticket.channel}</span>
            </p>

            <div className="mt-5">
              {/* Animación de entrada fluida estilo Apple idéntica a la vista de clientes */}
              <div key={activeTab} className="animate-plf-apple-tab">
                {/* TAB: DATOS / RESUMEN */}
                {activeTab === "datos" && (
                  <TicketOverviewTab
                    ticket={ticket}
                    sla={sla}
                    departmentLabel={departmentLabel}
                    originMessage={originMessage}
                    recipientEmail={recipientEmail}
                    isClosed={isClosed}
                    canAssign={canAssign}
                    messagesCount={clientThread.length}
                    tasksCount={tasksCount}
                    notesCount={internalNotes.length}
                    timelineCount={timeline.length}
                    onOpenAssign={() => void assign.handleOpenAssignModal()}
                    onOpenEdit={() => void edit.handleOpenEditModal()}
                    onOpenAttachment={openAttachment}
                    onOpenConversation={() => goToTab("conversacion")}
                    onOpenTasks={() => goToTab("tareas")}
                    onOpenNotes={() => goToTab("notas")}
                    onShowTimeline={() => setShowTimeline(true)}
                  />
                )}

                {/* TAB: FORMULARIOS */}
                {canReadForms && (
                  <div className={activeTab === "formularios" || activeTab === "reclamacion" ? "block" : "hidden"}>
                    <TicketFormsTab
                      ticket={ticket}
                      onHasFormsChanged={(has) => setHasForms(has)}
                      onTicketStatusChanged={refreshTicket}
                    />
                  </div>
                )}

                {/* TAB: CONVERSACIÓN */}
                {activeTab === "conversacion" && (
                  <TicketConversationTab
                    ticket={ticket}
                    clientThread={clientThread}
                    recipientEmail={recipientEmail}
                    onReply={() => setReplyOpen(true)}
                    onOpenAttachment={openAttachment}
                  />
                )}

                {/* TAB: TAREAS (con panel de comentarios integrado si está activo) */}
                <div className={activeTab === "tareas" ? "block" : "hidden"}>
                  {/* El contenedor es siempre el mismo: cambiar de flex a bloque al cerrar el panel hacía saltar la lista (colapso de márgenes). */}
                  <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:gap-0">
                    <div className="min-w-0 flex-1">
                      <TicketTasksTab
                        ticketId={ticket.id}
                        isClosed={isClosed}
                        assignableStaff={assign.assignableStaff}
                        currentStaffId={user?.staffId ?? 0}
                        onTasksCountChanged={setTasksCount}
                        activeCommentsTaskId={activeCommentsTask?.id}
                        onToggleTaskComments={handleToggleTaskComments}
                        latestAddedComment={latestAddedComment}
                        onActivity={() => void refreshTicket()}
                      />
                    </div>

                    {activeCommentsTask && (
                      <TaskCommentsAside
                        ref={commentsAsideRef}
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
                          receipts.done({ action: "comentar-tarea", title: "Comentario añadido", detail: activeCommentsTask.title });
                          void refreshTicket();
                        }}
                        className="w-full shrink-0 lg:ml-6 lg:w-[360px] lg:sticky lg:top-2 self-start"
                      />
                    )}
                  </div>
                </div>

                {/* TAB: NOTAS INTERNAS */}
                {activeTab === "notas" && (
                  <TicketNotesTab
                    ticket={ticket}
                    internalNotes={internalNotes}
                    onAddNote={() => setShowNoteModal(true)}
                    onOpenAttachment={openAttachment}
                  />
                )}
              </div>
            </div>
      </div>
    </div>
  </div>

      {/* Vista de redacción a pantalla completa con preservación de borrador. */}
      {replyOpen && (
        <TicketReplyComposer
          ticketNumber={ticket.number}
          subject={ticket.subject}
          recipientEmail={recipientEmail}
          editorKey={replyEditorKey}
          blocks={replyBlocks}
          setBlocks={setReplyBlocks}
          attachments={replyAttachments}
          setAttachments={setReplyAttachments}
          fileInputRef={replyFileInputRef}
          showAttachedFeedback={showReplyAttachedFeedback}
          attachedExiting={replyAttachedExiting}
          triggerAttachedFeedback={triggerReplyAttachedFeedback}
          sending={replySending}
          sendError={replySendError}
          setSendError={setReplySendError}
          ready={replyReady}
          onClose={() => setReplyOpen(false)}
          onSend={sendReply}
        />
      )}

      {showNoteModal && (
        <TicketNoteModal
          ticketNumber={ticket.number}
          settle={noteSettle}
          body={noteBody}
          setBody={setNoteBody}
          attachments={noteAttachments}
          setAttachments={setNoteAttachments}
          isDragging={isDraggingNote}
          setIsDragging={setIsDraggingNote}
          fileInputRef={noteFileInputRef}
          showAttachedFeedback={showNoteAttachedFeedback}
          attachedExiting={noteAttachedExiting}
          triggerAttachedFeedback={triggerNoteAttachedFeedback}
          sending={noteSending}
          sendError={noteSendError}
          setSendError={setNoteSendError}
          onClose={() => setShowNoteModal(false)}
          onSave={saveNote}
        />
      )}

      {statusUpdate.showUpdateStatusModal && (
        <TicketStatusUpdateModal
          flow={statusUpdate}
          ticketNumber={ticket.number}
          settle={updateSettle}
          availableTransitions={availableTransitions}
          recipientEmail={recipientEmail}
        />
      )}

      {assign.showAssignModal && <TicketAssignModal flow={assign} ticketNumber={ticket.number} settle={assignSettle} />}

      {edit.showEditModal && <TicketEditModal flow={edit} ticketNumber={ticket.number} settle={editSettle} />}

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
