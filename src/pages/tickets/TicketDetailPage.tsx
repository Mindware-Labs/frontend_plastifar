import {
  ArrowLeft,
  ArrowRight,
  Building2,
  Check,
  Clock,
  Copy,
  CornerUpLeft,
  Eye,
  FileText,
  Gavel,
  History,
  Lock,
  Mail,
  Package,
  Paperclip,
  Phone,
  Pencil,
  Plus,
  RotateCcw,
  Send,
  Tag,
  Upload,
  Users,
  Workflow,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type ComponentType, type ReactNode } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { departmentsApi } from "../../api/departments";
import { ticketsApi } from "../../api/tickets";
import { ticketVerdictsApi } from "../../api/ticketVerdicts";
import {
  MODULE_HEADER_TITLE_GUTTER_CLASS,
  ModuleHeader,
  type ModuleHeaderSection,
} from "../../components/app/ModuleHeader";
import { TicketPendingFileList } from "../../components/app/TicketPendingFileList";
import { SlaPolicyField } from "../../components/app/SlaPolicyField";
import { SubmitValidationButton } from "../../components/app/SubmitValidationButton";
import { TicketProductsField } from "../../components/app/TicketProductsField";
import { Alert } from "../../components/ui/Alert";
import { AnimatedCheckIcon } from "../../components/ui/AnimatedCheckIcon";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { dialogHeaderShellClass, dialogHeaderStackClass } from "../../components/ui/dialogHeaderStyles";
import { CheckboxField, SelectField, TextField } from "../../components/ui/Field";
import { LazyBlockEditor } from "../../components/ui/LazyBlockEditor";
import { Modal } from "../../components/ui/Modal";
import { Spinner } from "../../components/ui/Spinner";
import { TicketDetailSkeleton } from "../../components/ui/Skeleton";
import { openOverlay } from "../../hooks/overlayStack";
import { useSettle } from "../../hooks/useSettle";
import { useUploadFeedback } from "../../hooks/useUploadFeedback";
import { useAuth } from "../../context/useAuth";
import { useDynamicBreadcrumb } from "../../context/useBreadcrumb";
import { useEmailCounts } from "../../context/useEmailCounts";
import { useReceipts } from "../../context/useReceipts";
import { departmentPath, departmentPathOptions } from "../../lib/departments";
import { resolveSlaPolicyIdForPriority, sortSlaPolicies } from "../../lib/slaPolicyUi";
import { buildValidationItems, focusFormField } from "../../lib/validationItems";
import { useActiveSlaPolicies } from "../../lib/useActiveSlaPolicies";
import { blocksToEmailHtml, blocksToText } from "../../lib/emailHtml";
import { formatBytes, formatDateTime, formatPhoneNumber, formatSlaRemaining } from "../../lib/format";
import { formatTicketProductsSummary } from "../../lib/ticketProducts";
import { Avatar } from "../../components/ui/Avatar";
import type {
  DepartmentResponse,
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
import { TaskCommentsAside, type TaskCommentsAsideHandle } from "./TaskCommentsAside";
import { FormattedTicketBody } from "./FormattedTicketBody";
import { AttachmentChip, TicketMessageCard } from "./TicketMessageCard";
import { TicketTasksTab } from "./TicketTasksTab";
import { TicketTimelineSheet, type TicketDetailTab, type TimelineItem } from "./TicketTimelineSheet";
import { TicketFormsTab, type RegisteredFormItem } from "./TicketFormsTab";
import { ClaimDocumentSheet } from "../../components/claims/ClaimDocumentSheet";
import { WithdrawalDocumentSheet } from "../../components/withdrawals/WithdrawalDocumentSheet";
import type { CustomerClaim } from "../../types/claims";
import type { MerchandiseWithdrawal } from "../../types/withdrawals";
import { usePermissions } from "../../hooks/usePermissions";

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

function EditTicketFormDivider({ title }: { title: string }) {
  return (
    <div className="flex items-center gap-2 border-t border-zinc-100 pt-4 first:border-0 first:pt-0">
      <span className="select-none font-heading text-[10px] font-bold uppercase tracking-[0.08em] text-zinc-400">
        {title}
      </span>
      <div className="h-px flex-1 bg-zinc-100" />
    </div>
  );
}

interface EditTicketSectionHeadingProps {
  icon: ComponentType<{ className?: string; strokeWidth?: number }>;
  title: string;
  aside?: ReactNode;
}

function EditTicketSectionHeading({ icon: Icon, title, aside }: EditTicketSectionHeadingProps) {
  return (
    <div className="flex h-5 items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        <span
          aria-hidden
          className="flex size-5 shrink-0 items-center justify-center rounded-md bg-brand-red/10 text-brand-red"
        >
          <Icon className="size-3" strokeWidth={2.25} />
        </span>
        <span className="font-heading text-[10.5px] font-bold uppercase tracking-[0.08em] text-ink">{title}</span>
      </div>
      {aside && <span className="text-[11px] text-zinc-400">{aside}</span>}
    </div>
  );
}

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
  description: "Para tickets creados por error, duplicados o pruebas. Exige un motivo explicativo.",
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
  "text-[11.5px] font-medium text-zinc-600 shadow-2xs transition-all duration-300 hover:border-zinc-300 hover:bg-zinc-50 hover:text-zinc-900 active:scale-95";

const attachSuccessLabelClass =
  "inline-flex h-7 cursor-pointer items-center gap-1.5 rounded-lg border border-emerald-300 bg-emerald-50 px-2.5 " +
  "text-[11.5px] font-semibold text-emerald-700 shadow-2xs ring-2 ring-emerald-200/70 transition-all duration-300 active:scale-95";

const attachExitingLabelClass =
  "inline-flex h-7 cursor-pointer items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50/40 px-2.5 " +
  "text-[11.5px] font-medium text-emerald-600 shadow-2xs ring-1 ring-emerald-100/50 transition-all duration-300 active:scale-95";

/** Cuerpo de tarjeta con altura acotada al borde inferior de `alignToId` en escritorio; si excede, permite expandir (`onExpand`). */
function AlignedClampBody({
  alignToId,
  onExpand,
  children,
}: {
  alignToId: string;
  onExpand: () => void;
  children: React.ReactNode;
}) {
  const bodyRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const [maxHeight, setMaxHeight] = useState<number | null>(null);

  useEffect(() => {
    const body = bodyRef.current;
    const inner = innerRef.current;
    const target = document.getElementById(alignToId);
    if (!body || !inner || !target) return;
    const mq = window.matchMedia("(min-width: 1024px)");

    const measure = () => {
      if (!mq.matches) {
        setMaxHeight(null);
        return;
      }
      // -1: el borde inferior (1px) de la tarjeta contenedora queda fuera del cuerpo.
      const available = Math.round(target.getBoundingClientRect().bottom - body.getBoundingClientRect().top - 1);
      const needed = inner.offsetHeight;
      setMaxHeight(available > 80 && needed > available ? available : null);
    };

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(inner);
    ro.observe(target);
    // Observa todos los ancestros hasta el contenedor común porque pueden desplazar la posición vertical sin cambiar tamaño.
    for (let el: HTMLElement | null = body.parentElement; el && !el.contains(target); el = el.parentElement) {
      ro.observe(el);
    }
    for (let el: HTMLElement | null = target.parentElement; el && !el.contains(body); el = el.parentElement) {
      ro.observe(el);
    }
    ro.observe(document.body);
    window.addEventListener("resize", measure);
    void document.fonts?.ready.then(measure);
    mq.addEventListener("change", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
      mq.removeEventListener("change", measure);
    };
  }, [alignToId]);

  const clamped = maxHeight !== null;

  return (
    <div
      ref={bodyRef}
      style={clamped ? { maxHeight } : undefined}
      className={clamped ? "relative overflow-hidden" : "relative"}
    >
      <div ref={innerRef} className="p-4">
        {children}
      </div>
      {clamped && (
        <button
          type="button"
          onClick={onExpand}
          className="absolute inset-x-0 bottom-0 flex h-20 cursor-pointer items-end justify-center bg-gradient-to-t from-white via-white/95 to-transparent pb-3 outline-none focus-visible:ring-2 focus-visible:ring-brand-red/25"
        >
          <span className="inline-flex items-center gap-1.5 rounded-md border border-zinc-200 bg-white px-2.5 py-1 text-[11.5px] font-medium text-zinc-600 shadow-2xs transition-colors hover:border-zinc-300 hover:text-zinc-900">
            Haz clic para ver el mensaje completo
            <ArrowRight className="size-3" />
          </span>
        </button>
      )}
    </div>
  );
}

function CopyButton({ text, label = "Copiar" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      type="button"
      title={label}
      onClick={(e) => {
        e.stopPropagation();
        void navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className="inline-flex h-5 w-5 items-center justify-center rounded text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition-colors cursor-pointer"
    >
      {copied ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
    </button>
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
  // Formularios empresariales del ciclo de vida del ticket (PF-FOR-034, 068, 291, 109)
  const { can } = usePermissions();
  const readOnlyTicket = ticket?.accessLevel === "readOnly";
  const deptId = ticket?.departmentId ?? undefined;
  const canEditTicket = !readOnlyTicket && can("tickets.edit", deptId);
  const canReplyTicket = !readOnlyTicket && can("tickets.reply", deptId);
  const canUpdateStatus = !readOnlyTicket && can("tickets.close", deptId);
  const canCreateTask = !readOnlyTicket && can("tasks.create", deptId);
  const canEditTask = !readOnlyTicket && can("tasks.edit", deptId);
  const canCommentTask = !readOnlyTicket && can("tasks.comment", deptId);
  const canDeleteTask = !readOnlyTicket && can("tasks.delete", deptId);

  const canReadForms =
    can("claims.read", deptId) ||
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
  const [viewingDocumentForm, setViewingDocumentForm] = useState<RegisteredFormItem | null>(null);

  useEffect(() => {
    if (!viewingDocumentForm) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setViewingDocumentForm(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [viewingDocumentForm]);

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

    ticketsApi
      .getById(ticketId)
      .then((ticketData) => {
        if (!active) return;
        setTicket(ticketData);
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

  function pickFiles(
    input: HTMLInputElement,
    existing: File[],
    setFiles: (update: (prev: File[]) => File[]) => void,
    setFileError: (message: string | null) => void,
    onSuccess?: () => void,
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
    onSuccess?.();
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

  const updateStatusStep1Missing = useMemo(
    () =>
      buildValidationItems([
        {
          id: "update-status-radiogroup",
          label: "Falta elegir la nueva situación del ticket",
          short: "una opción",
          valid: updateTargetStatus.length > 0,
        },
      ]),
    [updateTargetStatus],
  );

  const updateStatusVerdictStep2Missing = useMemo(
    () =>
      buildValidationItems([
        {
          id: "update-verdict",
          label: "Falta elegir el veredicto",
          short: "el veredicto",
          valid: updateVerdictId.length > 0,
        },
      ]),
    [updateVerdictId],
  );

  const updateStatusVerdictStep3Missing = useMemo(
    () =>
      buildValidationItems([
        {
          id: "update-comment",
          label: "Falta el comentario del veredicto",
          short: "el comentario",
          valid: updateComment.trim().length > 0,
        },
      ]),
    [updateComment],
  );

  const updateStatusOtherStep2Missing = useMemo(() => {
    if (updateCategory !== "cancelar" && updateCategory !== "pausar") return [];
    return buildValidationItems([
      {
        id: "update-comment",
        label:
          updateCategory === "cancelar"
            ? "Falta el motivo de cancelación"
            : "Falta el motivo de la pausa",
        short: "el motivo",
        valid: updateComment.trim().length > 0,
      },
    ]);
  }, [updateCategory, updateComment]);

  const handleContinueUpdateStatus = (event?: React.MouseEvent) => {
    event?.preventDefault();
    if (!updateTargetStatus) {
      setTransitionError("Selecciona una opción");
      triggerUpdateSettle();
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
      triggerUpdateSettle();
      return;
    }
    setTransitionError(null);
    step2EnteredAtRef.current = Date.now();
    setStepDirection("forward");
    setUpdateStep(3);
  };

  const handleVerdictFilesSelected = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const chosen = Array.from(files);
    const problem = validateAttachments(chosen, verdictAttachments);
    if (problem) {
      setTransitionError(problem);
      triggerUpdateSettle();
      return;
    }
    setTransitionError(null);
    setVerdictAttachments((prev) => [...prev, ...chosen]);
    triggerVerdictAttachedFeedback();
  };

  const handleConfirmUpdateStatus = async (event: React.FormEvent) => {
    event.preventDefault();
    // Previene envíos accidentales disparados inmediatamente al avanzar de paso (doble clic o activación residual)
    if (Date.now() - step2EnteredAtRef.current < 400) {
      return;
    }
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
      triggerAssignSettle();
    } finally {
      setAssigning(false);
    }
  };

  // Edicion de atributos (PUT /api/tickets/{id}).
  const [showEditModal, setShowEditModal] = useState(false);
  const [editSubject, setEditSubject] = useState("");
  const [editTopicId, setEditTopicId] = useState<number | null>(null);
  const { policies: ticketSlaPolicies, loading: ticketSlaPoliciesLoading } = useActiveSlaPolicies("Ticket");
  const sortedTicketSlaPolicies = useMemo(
    () => (ticketSlaPolicies ? sortSlaPolicies(ticketSlaPolicies) : []),
    [ticketSlaPolicies],
  );
  const initialTicketSlaPolicyId = useMemo(() => {
    if (!ticket || sortedTicketSlaPolicies.length === 0) return "";
    return resolveSlaPolicyIdForPriority(sortedTicketSlaPolicies, ticket.priority);
  }, [ticket, sortedTicketSlaPolicies]);
  const [editDepartmentId, setEditDepartmentId] = useState<number | null>(null);
  const [editProducts, setEditProducts] = useState<
    { productId: number; productCode: string; productName: string }[]
  >([]);
  const [editError, setEditError] = useState<string | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [editCatalogs, setEditCatalogs] = useState<TicketCreateOptionsResponse | null>(null);
  const [loadingEditCatalogs, setLoadingEditCatalogs] = useState(false);
  // Arbol entero, para rotular con el camino: el catalogo trae solo id y nombre.
  const [editDepartmentTree, setEditDepartmentTree] = useState<DepartmentResponse[] | undefined>(undefined);

  // Carga el árbol de departamentos al entrar para mostrar la ruta jerárquica en la ficha y en el formulario de edición.
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
    setEditDepartmentId(ticket.departmentId ?? null);
    setEditProducts(
      (ticket.products ?? []).map((p) => ({
        productId: p.productId,
        productCode: p.productCode,
        productName: p.productName,
      })),
    );
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

  const submitTicketEdit = async () => {
    if (!editSubject.trim()) {
      setEditError("El asunto es obligatorio");
      triggerEditSettle();
      return;
    }

    try {
      setSavingEdit(true);
      setEditError(null);
      await ticketsApi.update(ticketId, {
        subject: editSubject.trim(),
        topicId: editTopicId,
        departmentId: editDepartmentId,
        productIds: editProducts.map((p) => p.productId),
      });
      setShowEditModal(false);
      await refreshTicket();
      receipts.done({ action: "editar-ticket", title: "Clasificación actualizada", detail: ticket?.number });
    } catch (err) {
      setEditError(err instanceof Error ? err.message : "Error al actualizar");
      triggerEditSettle();
    } finally {
      setSavingEdit(false);
    }
  };

  const handleConfirmEdit = (event: React.FormEvent) => {
    event.preventDefault();
    void submitTicketEdit();
  };

  const handleEditFormKeyDown = (event: React.KeyboardEvent<HTMLFormElement>) => {
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
      event.preventDefault();
      void submitTicketEdit();
    }
  };

  if (loading) {
    return <TicketDetailSkeleton />;
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
  const currentDepartmentPath = departmentPath(editDepartmentTree ?? [], ticket.departmentId);
  const departmentLabel = currentDepartmentPath ?? ticket.departmentName;
  const canAssign = ticket.status !== "Cancelado";

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

  const sections: ModuleHeaderSection[] = [
    {
      label: "Datos",
      active: activeTab === "datos",
      onClick: () => {
        setActiveTab("datos");
        setActiveCommentsTask(null);
      },
    },
    {
      label: `Conversación (${clientThread.length})`,
      active: activeTab === "conversacion",
      onClick: () => {
        setActiveTab("conversacion");
        setActiveCommentsTask(null);
      },
    },
    {
      label: `Tareas (${tasksCount})`,
      active: activeTab === "tareas",
      onClick: () => setActiveTab("tareas"),
    },
    {
      label: `Notas internas (${internalNotes.length})`,
      active: activeTab === "notas",
      onClick: () => {
        setActiveTab("notas");
        setActiveCommentsTask(null);
      },
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
            onClick: () => {
              setActiveTab("formularios");
              setActiveCommentsTask(null);
            },
          },
        ]
      : []),
  ];

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      {viewingDocumentForm ? (
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden animate-plf-receipt-in">
          {viewingDocumentForm.type === "reclamacion" && (
            <ClaimDocumentSheet
              claim={viewingDocumentForm.data as CustomerClaim}
              onBack={() => setViewingDocumentForm(null)}
              backLabel="Volver al ticket"
            />
          )}
          {viewingDocumentForm.type === "retiro" && (
            <WithdrawalDocumentSheet
              withdrawal={viewingDocumentForm.data as MerchandiseWithdrawal}
              onBack={() => setViewingDocumentForm(null)}
              backLabel="Volver al ticket"
            />
          )}
        </div>
      ) : (
        <>
          <ModuleHeader
        backTo="/tickets"
        backLabel="Volver al listado de tickets"
        title={ticket.number}
        badge={
          <div className="flex flex-wrap items-center gap-1.5">
            <StatusCell status={ticket.status} />
            {!isClosed && <PriorityCell priority={ticket.priority} />}
            {readOnlyTicket && (
              <Badge
                tone="slate"
                title="Consulta sin edición: el alcance de tu rol o departamento limita los cambios en este ticket."
                className="gap-1 px-2"
              >
                <Eye className="size-3 shrink-0 opacity-80" strokeWidth={2.25} aria-hidden />
                Solo lectura
              </Badge>
            )}
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
            {availableTransitions.length > 0 && canUpdateStatus ? (
              <Button
                type="button"
                size="sm"
                variant={isSolucionado ? "secondary" : "primary"}
                onClick={handleOpenUpdateStatusModal}
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
        <div className="pt-2 pr-3 lg:pr-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            {/* Asunto — mismo eje vertical que el código PLT-… del ModuleHeader */}
            <div
              className={`min-w-0 max-w-full lg:max-w-2xl ${MODULE_HEADER_TITLE_GUTTER_CLASS}`}
            >
              <h1
                className="font-heading text-[18px] sm:text-[20px] font-bold leading-snug tracking-[-0.02em] text-ink truncate"
                title={ticket.subject}
              >
                {ticket.subject}
              </h1>
            </div>

            <p className="flex shrink-0 flex-wrap items-center gap-x-1.5 text-[12px] text-zinc-500">
              <span>Creado el {formatDateTime(ticket.createdAt)} por</span>
              <span className="font-medium text-zinc-800">
                {ticket.createdByStaffName ?? ticket.requesterName ?? "Sistema"}
              </span>
              <span aria-hidden className="text-zinc-300">
                ·
              </span>
              <span className="font-heading text-[9.5px] font-bold uppercase tracking-[0.08em] text-zinc-400">
                {ticket.channel}
              </span>
            </p>
          </div>
        </div>

        <div
          className={`mt-3.5 transition-all duration-200 ${
            activeTab === "formularios" || activeTab === "reclamacion"
              ? "w-full"
              : "mx-auto max-w-6xl"
          }`}
        >
              {/* Animación de entrada fluida estilo Apple idéntica a la vista de clientes */}
              <div key={activeTab} className="animate-plf-apple-tab">
                {/* TAB: DATOS / RESUMEN */}
                {activeTab === "datos" && (
                  <div className="space-y-3.5">
                    {/* 1. Métricas rápidas superiores (4 tarjetas compactas tipo SaaS) */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                      {/* 1.1 Estado */}
                      <div className="rounded-card border border-zinc-200/80 bg-white p-3 shadow-2xs">
                        <div className="flex items-center justify-between text-zinc-400">
                          <span className="text-[11px] font-medium uppercase tracking-wider text-zinc-400">Estado</span>
                          <span
                            className={`h-2 w-2 rounded-full ${
                              ticket.status === "Cerrado" || ticket.status === "Solucionado"
                                ? "bg-emerald-500"
                                : ticket.status === "Cancelado"
                                ? "bg-zinc-400"
                                : ticket.pausedAt
                                ? "bg-amber-500"
                                : "bg-blue-500"
                            }`}
                          />
                        </div>
                        <div className="mt-1 flex items-baseline gap-2">
                          <span className="font-heading text-[15px] font-bold text-zinc-900 truncate">
                            {ticket.status}
                          </span>
                          {ticket.pausedAt ? (
                            <span className="text-[11px] font-medium text-amber-600 truncate">
                              Pausa ({ticket.pausedMinutes}m)
                            </span>
                          ) : ticket.verdictName ? (
                            <span className="text-[11px] font-medium text-emerald-700 truncate" title={ticket.verdictName}>
                              {ticket.verdictName}
                            </span>
                          ) : null}
                        </div>
                      </div>

                      {/* 1.2 Prioridad */}
                      <div className="rounded-card border border-zinc-200/80 bg-white p-3 shadow-2xs">
                        <div className="flex items-center justify-between text-zinc-400">
                          <span className="text-[11px] font-medium uppercase tracking-wider text-zinc-400">Prioridad</span>
                          <Tag className="h-3.5 w-3.5 text-zinc-400" />
                        </div>
                        <div className="mt-1 flex items-center justify-between">
                          <PriorityCell priority={ticket.priority} />
                          <span className="text-[10px] font-heading font-semibold uppercase tracking-wider text-zinc-400">
                            {ticket.channel}
                          </span>
                        </div>
                      </div>

                      {/* 1.3 Compromiso SLA */}
                      <div className="rounded-card border border-zinc-200/80 bg-white p-3 shadow-2xs">
                        <div className="flex items-center justify-between text-zinc-400">
                          <span className="text-[11px] font-medium uppercase tracking-wider text-zinc-400">SLA Resolución</span>
                          <Clock className="h-3.5 w-3.5 text-zinc-400" />
                        </div>
                        <div className="mt-1 flex items-center justify-between">
                          <SlaCell sla={sla} />
                          {ticket.resolutionDueAt && (
                            <span className="text-[11px] text-zinc-400 truncate tabular-nums">
                              {formatDateTime(ticket.resolutionDueAt)}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* 1.4 Responsable */}
                      <div className="rounded-card border border-zinc-200/80 bg-white p-3 shadow-2xs">
                        <div className="flex items-center justify-between text-zinc-400">
                          <span className="text-[11px] font-medium uppercase tracking-wider text-zinc-400">Responsable</span>
                          {canAssign && (
                            <button
                              type="button"
                              onClick={() => void handleOpenAssignModal()}
                              title={ticket.assignedStaffId ? "Cambiar responsable" : "Asignar responsable"}
                              className="text-zinc-400 hover:text-zinc-700 transition-colors p-0.5 rounded hover:bg-zinc-100 cursor-pointer"
                            >
                              <Pencil className="h-3 w-3" />
                            </button>
                          )}
                        </div>
                        <div className="mt-1 flex items-center gap-2">
                          {ticket.assignedStaffName && ticket.assignedStaffId !== null ? (
                            <>
                              <Avatar name={ticket.assignedStaffName} seed={ticket.assignedStaffId} size={20} />
                              <span className="font-heading text-[13.5px] font-bold text-zinc-900 truncate">
                                {ticket.assignedStaffName}
                              </span>
                            </>
                          ) : (
                            <span className="font-heading text-[13.5px] font-bold text-amber-600 italic">
                              Sin asignar
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* 2. Grilla principal (2/3 + 1/3) */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-3.5">
                      {/* Columna Izquierda (lg:col-span-2) */}
                      <div className="lg:col-span-2 space-y-3.5">
                        {/* Card: Clasificación y Enrutamiento */}
                        <div className="rounded-card border border-line bg-white shadow-card overflow-hidden">
                          <div className="flex items-center justify-between px-4 py-2.5 border-b border-zinc-100 bg-zinc-50/50">
                            <div className="flex items-center gap-2">
                              <Tag className="h-4 w-4 text-zinc-500" />
                              <h3 className="font-heading text-[11.5px] font-bold uppercase tracking-wider text-zinc-800">
                                Clasificación y Enrutamiento
                              </h3>
                            </div>
                            {!isClosed && canEditTicket && (
                              <button
                                type="button"
                                onClick={() => void handleOpenEditModal()}
                                className="inline-flex h-6 cursor-pointer items-center gap-1.5 rounded-md border border-zinc-200 bg-white px-2.5 text-[11px] font-medium text-zinc-600 shadow-2xs outline-none transition-colors hover:border-zinc-300 hover:bg-zinc-50 hover:text-zinc-900 active:scale-95 focus-visible:ring-2 focus-visible:ring-brand-red/25 motion-reduce:active:scale-100"
                              >
                                <Pencil className="size-3 text-zinc-400" />
                                <span>Editar clasificación</span>
                              </button>
                            )}
                          </div>

                          <div className="px-4 py-1 divide-y divide-zinc-100">
                            <div className="flex items-center justify-between py-2 text-[12.5px]">
                              <span className="text-zinc-500 font-medium">Asunto</span>
                              <div className="flex items-center gap-1.5 max-w-[70%]">
                                <span className="font-semibold text-zinc-900 text-right truncate" title={ticket.subject}>
                                  {ticket.subject}
                                </span>
                                <CopyButton text={ticket.subject} label="Copiar asunto" />
                              </div>
                            </div>

                            <div className="flex items-center justify-between py-2 text-[12.5px]">
                              <span className="text-zinc-500 font-medium">Código / Número</span>
                              <div className="flex items-center gap-1.5">
                                <span className="font-mono text-zinc-800 tabular-nums font-semibold">
                                  {ticket.number}
                                </span>
                                <CopyButton text={ticket.number} label="Copiar código" />
                              </div>
                            </div>

                            <div className="flex items-center justify-between py-2 text-[12.5px]">
                              <span className="text-zinc-500 font-medium">Departamento</span>
                              <span className="text-zinc-800 font-medium text-right truncate max-w-[65%]" title={departmentLabel ?? undefined}>
                                {departmentLabel ?? "—"}
                              </span>
                            </div>

                            <div className="flex items-center justify-between py-2 text-[12.5px]">
                              <span className="text-zinc-500 font-medium">Motivo</span>
                              <span className="text-zinc-800 font-medium text-right truncate max-w-[65%]" title={ticket.topicName ?? undefined}>
                                {ticket.topicName ?? "—"}
                              </span>
                            </div>

                            <div className="flex items-start justify-between gap-3 py-2 text-[12.5px]">
                              <span className="text-zinc-500 font-medium shrink-0">Productos</span>
                              <span
                                className="text-zinc-800 font-medium text-right max-w-[65%]"
                                title={formatTicketProductsSummary(ticket.products) ?? undefined}
                              >
                                {formatTicketProductsSummary(ticket.products) ?? (
                                  <span className="text-zinc-400 font-normal">Sin especificar</span>
                                )}
                              </span>
                            </div>

                            <div className="flex items-center justify-between py-2 text-[12.5px]">
                              <span className="text-zinc-500 font-medium">Canal de origen</span>
                              <span className="capitalize text-zinc-800 font-medium bg-zinc-100 border border-zinc-200/80 px-2 py-0.5 rounded text-[11.5px]">
                                {ticket.channel}
                              </span>
                            </div>

                            <div className="flex items-center justify-between py-2 text-[12.5px]">
                              <span className="text-zinc-500 font-medium">Creado por</span>
                              <span className="text-zinc-800 font-medium">
                                {ticket.createdByStaffName ?? ticket.requesterName ?? "Sistema"}
                                <span className="text-zinc-400 font-normal ml-1.5">({formatDateTime(ticket.createdAt)})</span>
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Card: Detalle Inicial del Caso (Mensaje de apertura) */}
                        {originMessage && (
                          <div className="rounded-card border border-line bg-white shadow-card overflow-hidden">
                            <div className="flex items-center justify-between px-4 py-2.5 border-b border-zinc-100 bg-zinc-50/50">
                              <div className="flex items-center gap-2">
                                <FileText className="h-4 w-4 text-zinc-500" />
                                <h3 className="font-heading text-[11.5px] font-bold uppercase tracking-wider text-zinc-800">
                                  Descripción Inicial del Caso
                                </h3>
                              </div>
                              <span className="text-[11px] text-zinc-400 font-mono tabular-nums">
                                {formatDateTime(originMessage.createdAt)}
                              </span>
                            </div>

                            <AlignedClampBody
                              alignToId="ticket-activity-summary-card"
                              onExpand={() => { setActiveTab("conversacion"); setActiveCommentsTask(null); }}
                            >
                              <div className="space-y-3">
                                <div className="text-[13px] leading-relaxed text-zinc-800">
                                  <FormattedTicketBody html={originMessage.bodyHtml} text={originMessage.bodyText} />
                                </div>

                                {originMessage.attachments && originMessage.attachments.length > 0 && (
                                  <div className="pt-2 border-t border-zinc-100">
                                    <span className="text-[10.5px] font-heading font-semibold uppercase tracking-wider text-zinc-400 block mb-2">
                                      Adjuntos incluidos ({originMessage.attachments.length})
                                    </span>
                                    <div className="flex flex-wrap gap-2">
                                      {originMessage.attachments.map((att) => (
                                        <AttachmentChip
                                          key={att.id}
                                          attachment={att}
                                          onOpen={() => openAttachment(originMessage.attachments, att.id)}
                                        />
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            </AlignedClampBody>
                          </div>
                        )}

                        {/* Card: Adjuntos generales del ticket */}
                        {ticket.attachments.length > 0 && (
                          <div className="rounded-card border border-line bg-white shadow-card overflow-hidden">
                            <div className="flex items-center justify-between px-4 py-2.5 border-b border-zinc-100 bg-zinc-50/50">
                              <div className="flex items-center gap-2">
                                <Paperclip className="h-4 w-4 text-zinc-500" />
                                <h3 className="font-heading text-[11.5px] font-bold uppercase tracking-wider text-zinc-800">
                                  Adjuntos del Ticket ({ticket.attachments.length})
                                </h3>
                              </div>
                            </div>

                            <div className="divide-y divide-zinc-100/80 px-4 py-1">
                              {ticket.attachments.map((att) => (
                                <button
                                  key={att.id}
                                  type="button"
                                  onClick={() => openAttachment(ticket.attachments, att.id)}
                                  title={`Abrir ${att.fileName}`}
                                  className="group flex w-full cursor-pointer items-center justify-between gap-3 py-2 text-left outline-none transition-colors hover:text-brand-red focus-visible:ring-2 focus-visible:ring-brand-red/25"
                                >
                                  <div className="flex min-w-0 items-center gap-2.5">
                                    <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-zinc-100 text-zinc-500 transition-colors group-hover:bg-brand-red/10 group-hover:text-brand-red">
                                      <FileText className="size-3.5" strokeWidth={2.25} />
                                    </span>
                                    <span className="truncate text-[12.5px] font-medium text-zinc-700 group-hover:text-zinc-900">
                                      {att.fileName}
                                    </span>
                                  </div>
                                  <div className="flex shrink-0 items-center gap-2 font-heading text-[11px] font-bold tabular-nums text-zinc-400">
                                    <span>{formatBytes(att.sizeBytes)}</span>
                                    <Eye className="size-3.5 text-zinc-400 opacity-0 transition-opacity group-hover:opacity-100" />
                                  </div>
                                </button>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Card: Observadores (si existen) */}
                        {ticket.watchers.length > 0 && (
                          <div className="rounded-card border border-line bg-white shadow-card overflow-hidden">
                            <div className="flex items-center justify-between px-4 py-2.5 border-b border-zinc-100 bg-zinc-50/50">
                              <div className="flex items-center gap-2">
                                <Users className="h-4 w-4 text-zinc-500" />
                                <h3 className="font-heading text-[11.5px] font-bold uppercase tracking-wider text-zinc-800">
                                  Observadores ({ticket.watchers.length})
                                </h3>
                              </div>
                            </div>
                            <div className="p-4 flex flex-wrap gap-2">
                              {ticket.watchers.map((watcher) => (
                                <div
                                  key={watcher.id}
                                  className="inline-flex h-7 items-center gap-2 rounded-md border border-zinc-200 bg-white pl-1.5 pr-2.5 text-[12px] text-zinc-800 shadow-2xs"
                                  title={`${watcher.staffName} (${watcher.staffEmail})`}
                                >
                                  <Avatar name={watcher.staffName} seed={watcher.id} size={18} />
                                  <span className="font-medium">{watcher.staffName}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Columna Derecha (lg:col-span-1) */}
                      <div className="space-y-3.5">
                        {/* Card: Cliente y Contacto */}
                        <div className="rounded-card border border-line bg-white shadow-card overflow-hidden">
                          <div className="flex items-center justify-between px-4 py-2.5 border-b border-zinc-100 bg-zinc-50/50">
                            <div className="flex items-center gap-2">
                              <Building2 className="h-4 w-4 text-zinc-500" />
                              <h3 className="font-heading text-[11.5px] font-bold uppercase tracking-wider text-zinc-800">
                                Cliente y Contacto
                              </h3>
                            </div>
                            {ticket.clientCode && (
                              <span className="font-mono text-[11px] font-medium text-zinc-500 bg-white border border-zinc-200/80 px-2 py-0.5 rounded shadow-2xs tabular-nums">
                                #{ticket.clientCode}
                              </span>
                            )}
                          </div>

                          <div className="p-4 space-y-3">
                            {ticket.clientName ? (
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex items-center gap-2.5 min-w-0">
                                  <div className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-zinc-200 bg-zinc-50 font-heading text-[11px] font-bold tracking-[0.04em] text-zinc-700">
                                    {ticket.clientName.slice(0, 2).toUpperCase()}
                                  </div>
                                  <div className="min-w-0">
                                    <span className="block truncate text-[13.5px] font-bold text-zinc-900 leading-tight" title={ticket.clientName}>
                                      {ticket.clientName}
                                    </span>
                                    {ticket.clientId && (
                                      <Link
                                        to={`/clientes/${ticket.clientId}`}
                                        className="inline-flex items-center gap-1 text-[11.5px] text-brand-red font-medium hover:underline mt-0.5"
                                      >
                                        <span>Ver ficha de cliente</span>
                                        <ArrowRight className="size-3" />
                                      </Link>
                                    )}
                                  </div>
                                </div>
                              </div>
                            ) : (
                              <div className="py-2 text-[12.5px] text-zinc-400 italic">Sin cliente asociado</div>
                            )}

                            <div className="pt-2 border-t border-zinc-100 divide-y divide-zinc-100 text-[12.5px]">
                              <div className="flex items-center justify-between py-2">
                                <span className="text-zinc-500 font-medium">Contacto</span>
                                <span className="font-semibold text-zinc-800 text-right truncate max-w-[65%]" title={ticket.contactName ?? undefined}>
                                  {ticket.contactName ?? <span className="text-zinc-400 font-normal">Sin contacto</span>}
                                </span>
                              </div>

                              {recipientEmail && (
                                <div className="flex items-center justify-between py-2">
                                  <div className="flex items-center gap-1.5 text-zinc-500 font-medium">
                                    <Mail className="size-3 text-zinc-400" />
                                    <span>Correo</span>
                                  </div>
                                  <div className="flex items-center gap-1.5 max-w-[65%]">
                                    <a
                                      href={`mailto:${recipientEmail}`}
                                      title={recipientEmail}
                                      className="text-zinc-900 font-medium hover:text-brand-red truncate"
                                    >
                                      {recipientEmail}
                                    </a>
                                    <CopyButton text={recipientEmail} label="Copiar correo" />
                                  </div>
                                </div>
                              )}

                              {ticket.contactPhone && (
                                <div className="flex items-center justify-between py-2">
                                  <div className="flex items-center gap-1.5 text-zinc-500 font-medium">
                                    <Phone className="size-3 text-zinc-400" />
                                    <span>Teléfono</span>
                                  </div>
                                  <div className="flex items-center gap-1.5">
                                    <a
                                      href={`tel:${ticket.contactPhone}`}
                                      className="font-mono text-zinc-900 font-medium hover:text-brand-red tabular-nums"
                                    >
                                      {formatPhoneNumber(ticket.contactPhone)}
                                    </a>
                                    <CopyButton text={ticket.contactPhone} label="Copiar teléfono" />
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Card: SLA y Tiempos */}
                        <div className="rounded-card border border-line bg-white shadow-card overflow-hidden">
                          <div className="flex items-center justify-between px-4 py-2.5 border-b border-zinc-100 bg-zinc-50/50">
                            <div className="flex items-center gap-2">
                              <Clock className="h-4 w-4 text-zinc-500" />
                              <h3 className="font-heading text-[11.5px] font-bold uppercase tracking-wider text-zinc-800">
                                SLA y Tiempos
                              </h3>
                            </div>
                            <SlaCell sla={sla} />
                          </div>

                          <div className="px-4 py-1 divide-y divide-zinc-100 text-[12.5px]">
                            <div className="flex items-center justify-between py-2">
                              <span className="text-zinc-500 font-medium">Compromiso resolución</span>
                              <span className={`tabular-nums font-medium ${sla.tone === "overdue" ? "text-brand-red font-semibold" : "text-zinc-900"}`}>
                                {ticket.resolutionDueAt ? formatDateTime(ticket.resolutionDueAt) : "Sin compromiso"}
                              </span>
                            </div>

                            <div className="flex items-center justify-between py-2">
                              <span className="text-zinc-500 font-medium">1.ª respuesta</span>
                              {ticket.firstResponseAt ? (
                                <span className="text-emerald-700 font-medium tabular-nums text-right truncate max-w-[60%]" title={`Lograda el ${formatDateTime(ticket.firstResponseAt)}`}>
                                  Lograda · {formatDateTime(ticket.firstResponseAt)}
                                </span>
                              ) : ticket.firstResponseDueAt ? (
                                <span className="tabular-nums text-zinc-800 text-right truncate max-w-[60%]">
                                  Límite · {formatDateTime(ticket.firstResponseDueAt)}
                                </span>
                              ) : (
                                <span className="text-zinc-400 font-normal">Pendiente</span>
                              )}
                            </div>

                            {ticket.pausedAt && (
                              <div className="flex items-center justify-between py-2">
                                <span className="text-zinc-500 font-medium">En pausa desde</span>
                                <span className="font-medium text-amber-700 tabular-nums">
                                  {formatDateTime(ticket.pausedAt)}
                                </span>
                              </div>
                            )}

                            {ticket.pausedMinutes > 0 && (
                              <div className="flex items-center justify-between py-2">
                                <span className="text-zinc-500 font-medium">Tiempo total pausado</span>
                                <span className="tabular-nums text-zinc-800 font-medium">{ticket.pausedMinutes} min</span>
                              </div>
                            )}

                            {ticket.reopenedCount > 0 && (
                              <div className="flex items-center justify-between py-2">
                                <span className="text-zinc-500 font-medium">Reaperturas</span>
                                <span className="font-bold tabular-nums text-amber-700">{ticket.reopenedCount}</span>
                              </div>
                            )}

                            {ticket.resolvedAt && (
                              <div className="flex items-center justify-between py-2">
                                <span className="text-zinc-500 font-medium">Resuelto</span>
                                <span className="tabular-nums text-zinc-800 font-medium">{formatDateTime(ticket.resolvedAt)}</span>
                              </div>
                            )}

                            {ticket.verdictName && (
                              <div className="flex items-center justify-between py-2">
                                <span className="text-zinc-500 font-medium">Veredicto</span>
                                <span className="font-semibold text-emerald-800 truncate max-w-[60%]" title={ticket.verdictName}>
                                  {ticket.verdictName}
                                </span>
                              </div>
                            )}

                            {ticket.closedAt && (
                              <div className="flex items-center justify-between py-2">
                                <span className="text-zinc-500 font-medium">Cerrado definitivamente</span>
                                <span className="tabular-nums text-zinc-800 font-medium">{formatDateTime(ticket.closedAt)}</span>
                              </div>
                            )}

                            <div className="flex items-center justify-between py-2">
                              <span className="text-zinc-500 font-medium">Última actividad</span>
                              <span className="tabular-nums text-zinc-600 font-medium">{formatDateTime(ticket.lastActivityAt)}</span>
                            </div>
                          </div>
                        </div>

                        {/* Card: Resumen de actividad e hitos */}
                        <div id="ticket-activity-summary-card" className="rounded-card border border-line bg-white shadow-card overflow-hidden">
                          <div className="flex items-center justify-between px-4 py-2.5 border-b border-zinc-100 bg-zinc-50/50">
                            <div className="flex items-center gap-2">
                              <History className="h-4 w-4 text-zinc-500" />
                              <h3 className="font-heading text-[11.5px] font-bold uppercase tracking-wider text-zinc-800">
                                Resumen de Actividad
                              </h3>
                            </div>
                          </div>

                          <div className="p-3.5 space-y-2.5">
                            <div className="grid grid-cols-3 gap-2 text-center">
                              <button
                                type="button"
                                onClick={() => { setActiveTab("conversacion"); setActiveCommentsTask(null); }}
                                className="rounded-lg border border-zinc-200/80 bg-zinc-50/60 p-2 text-left hover:border-zinc-300 hover:bg-zinc-100/70 transition-colors cursor-pointer group"
                              >
                                <span className="text-[10px] font-heading font-semibold uppercase tracking-wider text-zinc-400 group-hover:text-zinc-600 block">
                                  Mensajes
                                </span>
                                <span className="font-heading text-[16px] font-bold text-zinc-900 tabular-nums">
                                  {clientThread.length}
                                </span>
                              </button>

                              <button
                                type="button"
                                onClick={() => setActiveTab("tareas")}
                                className="rounded-lg border border-zinc-200/80 bg-zinc-50/60 p-2 text-left hover:border-zinc-300 hover:bg-zinc-100/70 transition-colors cursor-pointer group"
                              >
                                <span className="text-[10px] font-heading font-semibold uppercase tracking-wider text-zinc-400 group-hover:text-zinc-600 block">
                                  Tareas
                                </span>
                                <span className="font-heading text-[16px] font-bold text-zinc-900 tabular-nums">
                                  {tasksCount}
                                </span>
                              </button>

                              <button
                                type="button"
                                onClick={() => { setActiveTab("notas"); setActiveCommentsTask(null); }}
                                className="rounded-lg border border-zinc-200/80 bg-zinc-50/60 p-2 text-left hover:border-zinc-300 hover:bg-zinc-100/70 transition-colors cursor-pointer group"
                              >
                                <span className="text-[10px] font-heading font-semibold uppercase tracking-wider text-zinc-400 group-hover:text-zinc-600 block">
                                  Notas
                                </span>
                                <span className="font-heading text-[16px] font-bold text-zinc-900 tabular-nums">
                                  {internalNotes.length}
                                </span>
                              </button>
                            </div>

                            <Button
                              type="button"
                              variant="secondary"
                              size="sm"
                              onClick={() => setShowTimeline(true)}
                              className="w-full justify-center"
                            >
                              <History className="size-3.5" />
                              <span>Ver historial de eventos ({timeline.length})</span>
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* TAB: FORMULARIOS */}
                {canReadForms && (
                  <div className={activeTab === "formularios" || activeTab === "reclamacion" ? "block" : "hidden"}>
                    <TicketFormsTab
                      ticket={ticket}
                      onHasFormsChanged={(has) => setHasForms(has)}
                      onTicketStatusChanged={refreshTicket}
                      onViewDocument={(form) => setViewingDocumentForm(form)}
                    />
                  </div>
                )}

                {/* TAB: CONVERSACIÓN */}
                {activeTab === "conversacion" && (
                  <div className="space-y-2.5">
                    {/* La accion encabeza el hilo; el editor se pide, no esta siempre puesto. */}
                    <div className="flex items-center gap-3">
                      <span className="shrink-0 font-heading text-[10px] font-bold uppercase tracking-[0.08em] tabular-nums text-zinc-400">
                        {clientThread.length} {clientThread.length === 1 ? "mensaje" : "mensajes"}
                      </span>
                      <span aria-hidden className="h-px flex-1 bg-zinc-200/70" />
                      {canReplyTicket && (
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
                      )}
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

                {/* TAB: TAREAS (con panel de comentarios integrado si está activo) */}
                <div className={activeTab === "tareas" ? "block" : "hidden"}>
                  {/* El contenedor es siempre el mismo: cambiar de flex a bloque al cerrar el panel hacía saltar la lista (colapso de márgenes). */}
                  <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:gap-0">
                    <div className="min-w-0 flex-1">
                      <TicketTasksTab
                        ticketId={ticket.id}
                        isClosed={isClosed}
                        assignableStaff={assignableStaff}
                        currentStaffId={user?.staffId ?? 0}
                        canCreateTask={canCreateTask}
                        canEditTask={canEditTask}
                        canCommentTask={canCommentTask}
                        canDeleteTask={canDeleteTask}
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
                        canComment={canCommentTask}
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
                  <div className="space-y-2.5">
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
                        {canEditTicket && (
                          <Button type="button" size="sm" onClick={() => setShowNoteModal(true)} className="mt-4">
                            <Plus className="h-[14px] w-[14px]" />
                            Añadir nota
                          </Button>
                        )}
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-1.5 font-heading text-[10px] font-bold uppercase tracking-[0.08em] tabular-nums text-zinc-400">
                            <Lock className="h-3 w-3 text-amber-600" />
                            <span>{internalNotes.length} {internalNotes.length === 1 ? "nota interna" : "notas internas"}</span>
                          </div>
                          <span aria-hidden className="h-px flex-1 bg-zinc-200/70" />
                          {canEditTicket && (
                            <Button type="button" size="sm" onClick={() => setShowNoteModal(true)}>
                              <Plus className="h-[14px] w-[14px]" />
                              Añadir nota
                            </Button>
                          )}
                        </div>
                        {renderThread(internalNotes)}
                      </>
                    )}
                  </div>
                )}
              </div>
        </div>
      </div>
      </>
    )}

      {/* Vista de redacción a pantalla completa con preservación de borrador. */}
      {replyOpen && (
        <div className="fixed inset-0 z-50 flex flex-col bg-white">
          <div className={dialogHeaderShellClass}>
            <div className={dialogHeaderStackClass}>
              <p className="font-heading text-[11px] font-semibold tracking-[0.02em] tabular-nums text-subtle">
                {ticket.number}
              </p>
              <h2 className="truncate font-heading text-[17px] font-bold tracking-[-0.01em] text-ink">
                Re: {ticket.subject}
              </h2>
              <p className="truncate text-[12px] text-subtle">
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
            <TicketPendingFileList
              files={replyAttachments}
              onChange={setReplyAttachments}
              variant="inline"
              layout="wrap"
              className="mx-auto max-w-4xl"
            />

            <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <input
                  ref={replyFileInputRef}
                  id="reply-attachment-input"
                  type="file"
                  multiple
                  className="hidden"
                  onChange={(event) => {
                    pickFiles(
                      event.target,
                      replyAttachments,
                      setReplyAttachments,
                      setReplySendError,
                      () => triggerReplyAttachedFeedback(),
                    );
                    if (replySendError) setReplySendError(null);
                  }}
                />
                <label
                  htmlFor="reply-attachment-input"
                  className={
                    showReplyAttachedFeedback
                      ? replyAttachedExiting
                        ? attachExitingLabelClass
                        : attachSuccessLabelClass
                      : attachLabelClass
                  }
                >
                  {showReplyAttachedFeedback ? (
                    <span
                      className={`inline-flex items-center gap-1.5 ${
                        replyAttachedExiting ? "animate-plf-check-out" : "animate-plf-check-in"
                      }`}
                    >
                      <span className="flex size-3.5 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 animate-plf-check-breathe">
                        <AnimatedCheckIcon size={11} strokeWidth={3} />
                      </span>
                      <span>¡Adjuntado!</span>
                    </span>
                  ) : (
                    <>
                      <Paperclip className="h-3.5 w-3.5" />
                      Adjuntar
                    </>
                  )}
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
      {showNoteModal && canEditTicket && (
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
              <SubmitValidationButton
                ready={noteBody.trim().length > 0}
                busy={noteSending}
                missingItems={buildValidationItems([
                  {
                    id: "ticket-note-body",
                    label: "Falta el texto de la nota",
                    short: "el texto de la nota",
                    valid: noteBody.trim().length > 0,
                  },
                ])}
                onSubmit={() => void saveNote()}
                onFocusField={focusFormField}
                tone={noteSendError ? "ink" : "primary"}
                toneLabel={noteSendError}
                hintText="Para guardar la nota interna, completa lo siguiente:"
              >
                Guardar nota
              </SubmitValidationButton>
            </>
          }
        >
          <div className="space-y-3">
            <textarea
              id="ticket-note-body"
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

            {/* Carga de archivos adjuntos */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-heading text-[11px] font-semibold text-zinc-500">
                  Archivos adjuntos (opcional)
                </span>
                <span className="text-[11px] text-zinc-400">Máx. 10 MB por archivo</span>
              </div>

              <input
                ref={noteFileInputRef}
                id="note-attachment-input"
                type="file"
                multiple
                className="hidden"
                onChange={(event) => {
                  pickFiles(
                    event.target,
                    noteAttachments,
                    setNoteAttachments,
                    setNoteSendError,
                    () => triggerNoteAttachedFeedback(),
                  );
                }}
              />

              <button
                type="button"
                onClick={() => noteFileInputRef.current?.click()}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setIsDraggingNote(true);
                }}
                onDragLeave={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setIsDraggingNote(false);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setIsDraggingNote(false);
                  if (e.dataTransfer.files) {
                    const chosen = Array.from(e.dataTransfer.files);
                    const problem = validateAttachments(chosen, noteAttachments);
                    if (problem) {
                      setNoteSendError(problem);
                      return;
                    }
                    setNoteSendError(null);
                    setNoteAttachments((prev) => [...prev, ...chosen]);
                    triggerNoteAttachedFeedback();
                  }
                }}
                className={`group relative flex h-[106px] min-h-[106px] w-full cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed px-4 py-3 transition-colors duration-300 outline-none ${
                  showNoteAttachedFeedback
                    ? noteAttachedExiting
                      ? "border-emerald-200 bg-emerald-50/25"
                      : "border-emerald-400 bg-emerald-50/60 ring-2 ring-emerald-100/80"
                    : isDraggingNote
                      ? "border-brand-red bg-brand-red/5 ring-2 ring-brand-red/20"
                      : "border-zinc-200 bg-zinc-50/50 hover:border-brand-red/40 hover:bg-brand-red/5"
                }`}
              >
                {showNoteAttachedFeedback ? (
                  <div
                    className={`flex flex-col items-center justify-center text-center ${
                      noteAttachedExiting ? "animate-plf-check-out" : "animate-plf-check-in"
                    }`}
                  >
                    <div className="relative flex size-8 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 ring-2 ring-emerald-200/70 shadow-3xs animate-plf-check-breathe">
                      <AnimatedCheckIcon size={16} strokeWidth={2.8} />
                    </div>
                    <p className="mt-1.5 max-w-[360px] truncate font-heading text-[12px] font-bold text-emerald-700 leading-tight">
                      ¡{noteAttachments.length === 1 ? "Archivo adjuntado correctamente" : `${noteAttachments.length} archivos adjuntados correctamente`}!
                    </p>
                    <p className="mt-0.5 max-w-[360px] truncate text-[11px] text-emerald-600/80 leading-tight">
                      Haz clic o arrastra para añadir más si lo deseas
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center text-center transition-opacity duration-300">
                    <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-zinc-500 transition-transform group-hover:scale-105">
                      <Upload className="size-4" />
                    </div>
                    <p className="mt-1.5 max-w-[360px] truncate font-heading text-[12px] font-semibold text-zinc-700 leading-tight">
                      Haz clic para adjuntar archivos a la nota
                    </p>
                    <p className="mt-0.5 max-w-[360px] truncate text-[11px] text-zinc-400 leading-tight">
                      Imágenes (PNG, JPG), documentos PDF, hojas de Excel o reportes internos
                    </p>
                  </div>
                )}
              </button>

              <div className="flex items-center justify-between pt-0.5">
                <span className="text-[11px] text-zinc-400">{SAVE_SHORTCUT} para guardar</span>
              </div>

              <TicketPendingFileList
                files={noteAttachments}
                onChange={setNoteAttachments}
                className="pt-1"
                onRemove={() => {
                  if (noteSendError) setNoteSendError(null);
                }}
              />
            </div>
          </div>
        </Modal>
      )}

      {/* Flujo de 3 pasos para veredicto y 2 pasos para otras transiciones. */}
      {showUpdateStatusModal && (
        <Modal
          settle={updateSettle}
          eyebrow={
            updateSuccess
              ? undefined
              : updateCategory === "veredicto"
                ? `${ticket.number} · Paso ${updateStep} de 3`
                : updateStep === 2
                  ? `${ticket.number} · Paso 2 de 2`
                  : ticket.number
          }
          title={
            updateSuccess
              ? "¡Operación exitosa!"
              : updateCategory === "veredicto"
                ? updateStep === 1
                  ? "Actualizar ticket"
                  : updateStep === 2
                    ? "Marcar veredicto"
                    : "Resolución y evidencias"
                : updateStep === 1
                  ? "Actualizar ticket"
                  : updateCategory === "cancelar"
                    ? "Cancelar ticket"
                    : "Pausar ticket"
          }
          description={
            updateSuccess
              ? undefined
              : updateCategory === "veredicto"
                ? updateStep === 1
                  ? "Elige qué hacer con este ticket."
                  : updateStep === 2
                    ? "Selecciona el motivo y confirma si deseas notificar al cliente."
                    : "Redacta el comentario del veredicto y adjunta archivos de soporte."
                : updateStep === 1
                  ? "Elige qué hacer con este ticket."
                  : "Completa los datos para confirmar."
          }
          maxWidth={updateCategory === "veredicto" && updateStep === 3 ? "max-w-lg" : "max-w-md"}
          onClose={() => {
            if (!transitioning) {
              if (updateSuccessTimerRef.current) {
                clearTimeout(updateSuccessTimerRef.current);
                updateSuccessTimerRef.current = null;
              }
              setShowUpdateStatusModal(false);
              setUpdateSuccess(false);
            }
          }}
          footer={
            updateSuccess ? (
              <Button
                key="btn-status-success-close"
                type="button"
                size="sm"
                variant="primary"
                onClick={() => {
                  if (updateSuccessTimerRef.current) {
                    clearTimeout(updateSuccessTimerRef.current);
                    updateSuccessTimerRef.current = null;
                  }
                  setShowUpdateStatusModal(false);
                  setUpdateSuccess(false);
                }}
              >
                Entendido
              </Button>
            ) : updateStep === 1 ? (
              <div key="status-step-1" className="animate-plf-header-fade flex items-center justify-end gap-2">
                <Button
                  key="btn-status-cancel"
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => setShowUpdateStatusModal(false)}
                >
                  Cancelar
                </Button>
                <SubmitValidationButton
                  key="btn-status-continue"
                  ready={updateStatusStep1Missing.length === 0}
                  missingItems={updateStatusStep1Missing}
                  onSubmit={() => handleContinueUpdateStatus()}
                  onFocusField={focusFormField}
                  tone={transitionError ? "ink" : "primary"}
                  toneLabel={transitionError}
                  hintText="Para continuar, completa lo siguiente:"
                >
                  Continuar
                </SubmitValidationButton>
              </div>
            ) : updateStep === 2 && updateCategory === "veredicto" ? (
              <div key="status-step-2-verdict" className="animate-plf-header-fade flex items-center justify-end gap-2">
                <Button
                  key="btn-status-back-1"
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={transitioning}
                  onClick={() => {
                    setTransitionError(null);
                    setStepDirection("backward");
                    setUpdateStep(1);
                  }}
                >
                  Atrás
                </Button>
                <SubmitValidationButton
                  key="btn-status-continue-step2"
                  formId="update-status-step2-form"
                  ready={updateStatusVerdictStep2Missing.length === 0}
                  missingItems={updateStatusVerdictStep2Missing}
                  onFocusField={focusFormField}
                  tone={transitionError ? "ink" : "primary"}
                  toneLabel={transitionError}
                  hintText="Para continuar, completa lo siguiente:"
                >
                  Continuar
                </SubmitValidationButton>
              </div>
            ) : updateStep === 3 && updateCategory === "veredicto" ? (
              <div key="status-step-3-verdict" className="animate-plf-header-fade flex items-center justify-end gap-2">
                <Button
                  key="btn-status-back-2"
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={transitioning}
                  onClick={() => {
                    setTransitionError(null);
                    setStepDirection("backward");
                    setUpdateStep(2);
                  }}
                >
                  Atrás
                </Button>
                <SubmitValidationButton
                  key="btn-status-confirm-verdict"
                  formId="update-status-form"
                  ready={updateStatusVerdictStep3Missing.length === 0}
                  busy={transitioning}
                  missingItems={updateStatusVerdictStep3Missing}
                  onFocusField={focusFormField}
                  tone={transitionError ? "ink" : "primary"}
                  toneLabel={transitionError}
                  hintText="Para confirmar el veredicto, completa lo siguiente:"
                  className={
                    transitionError ? "" : "bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white"
                  }
                >
                  <Gavel className="h-3.5 w-3.5" />
                  Confirmar veredicto
                </SubmitValidationButton>
              </div>
            ) : (
              <div key="status-step-2-other" className="animate-plf-header-fade flex items-center justify-end gap-2">
                <Button
                  key="btn-status-back-other"
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={transitioning}
                  onClick={() => {
                    setTransitionError(null);
                    setStepDirection("backward");
                    setUpdateStep(1);
                  }}
                >
                  Atrás
                </Button>
                <SubmitValidationButton
                  key="btn-status-confirm-other"
                  formId="update-status-form"
                  ready={updateStatusOtherStep2Missing.length === 0}
                  busy={transitioning}
                  missingItems={updateStatusOtherStep2Missing}
                  onFocusField={focusFormField}
                  variant={updateCategory === "cancelar" ? "danger" : "primary"}
                  tone={transitionError ? "ink" : "primary"}
                  toneLabel={transitionError}
                  hintText="Para confirmar el cambio, completa lo siguiente:"
                >
                  {updateCategory === "cancelar" ? "Cancelar ticket" : "Confirmar"}
                </SubmitValidationButton>
              </div>
            )
          }
        >
          {updateSuccess ? (
            <div className="flex flex-col items-center justify-center py-6 text-center animate-plf-check-in">
              <div className="relative mb-4 flex items-center justify-center">
                <div className="absolute h-16 w-16 rounded-full bg-emerald-500/20 animate-ping opacity-60" />
                <div className="animate-plf-check-in relative flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 ring-8 ring-emerald-50 shadow-xs animate-plf-check-breathe">
                  <AnimatedCheckIcon size={32} strokeWidth={2.8} />
                </div>
              </div>
              <h3 className="text-base font-bold text-zinc-900 font-heading">
                El ticket se cerró correctamente
              </h3>
              <p className="mt-1.5 text-xs text-zinc-500 max-w-xs leading-relaxed">
                {updateCategory === "veredicto"
                  ? verdictAttachments.length > 0
                    ? `Se registró el veredicto con ${verdictAttachments.length} ${
                        verdictAttachments.length === 1
                          ? "archivo de evidencia adjunto"
                          : "archivos de evidencia adjuntos"
                      }.`
                    : "El veredicto fue registrado exitosamente."
                  : "El ticket ha sido actualizado correctamente."}
              </p>
            </div>
          ) : (
            <div
              key={`status-step-${updateStep}`}
              className={stepDirection === "forward" ? "animate-plf-step-forward" : "animate-plf-step-backward"}
            >
              {updateStep === 1 && (
                <div className="space-y-3">
                  <div
                    id="update-status-radiogroup"
                    role="radiogroup"
                    aria-label="Nueva situación"
                    className="space-y-1.5"
                    tabIndex={-1}
                  >
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
                            if (option.target !== updateTargetStatus) {
                              setUpdateTargetStatus(option.target);
                              setUpdateVerdictId("");
                              setUpdateComment("");
                            }
                            if (transitionError) setTransitionError(null);
                          }}
                          onDoubleClick={(e) => {
                            e.preventDefault();
                            setUpdateTargetStatus(option.target);
                            setUpdateVerdictId("");
                            setUpdateComment("");
                            setTransitionError(null);
                            setStepDirection("forward");
                            step2EnteredAtRef.current = Date.now();
                            setUpdateStep(2);
                          }}
                          className={`flex w-full items-start gap-2.5 rounded-lg border p-2.5 text-left outline-none cursor-pointer transition-all duration-200 ease-out active:scale-[0.99] focus-visible:ring-2 focus-visible:ring-brand-red/20 ${
                            isSelected
                              ? "border-brand-red bg-brand-red/[0.04] shadow-2xs"
                              : "border-zinc-200/80 hover:border-zinc-300 hover:bg-zinc-50"
                          }`}
                        >
                          <OptionIcon
                            aria-hidden
                            className={`mt-0.5 h-3.5 w-3.5 shrink-0 transition-colors duration-200 ${
                              option.danger ? "text-brand-red" : isSelected ? "text-brand-red" : "text-zinc-500"
                            }`}
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
              )}

                {updateStep === 2 && updateCategory === "veredicto" && (
                  <form id="update-status-step2-form" onSubmit={handleContinueToStep3} className="space-y-4">
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
                      error={transitionError && !updateVerdictId ? transitionError : undefined}
                      options={verdictOptions.map((v) => ({ value: String(v.id), label: v.name }))}
                      hint={
                        !loadingVerdicts && verdictOptions.length === 0
                          ? "No hay veredictos activos en el catálogo. Créalos en Tickets · Veredictos."
                          : undefined
                      }
                    />

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
                  </form>
                )}

                {updateStep === 3 && updateCategory === "veredicto" && (
                  <form id="update-status-form" onSubmit={handleConfirmUpdateStatus} className="space-y-4">
                    <div className="flex flex-col gap-1">
                      <label htmlFor="update-comment" className={labelClass}>
                        Comentario del veredicto
                        <span className="ml-1 text-brand-red">*</span>
                      </label>
                      <textarea
                        id="update-comment"
                        rows={3}
                        value={updateComment}
                        onChange={(event) => {
                          setUpdateComment(event.target.value);
                          if (transitionError) setTransitionError(null);
                        }}
                        placeholder="Explica el veredicto y las conclusiones de la reclamación…"
                        className={`${textareaClass} ${
                          transitionError && !updateComment.trim()
                            ? "border-brand-red ring-3 ring-brand-red/10 focus:border-brand-red"
                            : ""
                        }`}
                        autoFocus
                      />
                    </div>

                    {/* Carga de evidencias con el mismo diseño que CompleteTaskModal */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-heading text-[11px] font-semibold text-zinc-500">
                          Archivos de evidencia (opcional)
                        </span>
                        <span className="text-[11px] text-zinc-400">Máx. 10 MB por archivo</span>
                      </div>

                      <input
                        ref={verdictFileInputRef}
                        id="verdict-attachment-input"
                        type="file"
                        multiple
                        className="hidden"
                        onChange={(e) => {
                          handleVerdictFilesSelected(e.target.files);
                          if (verdictFileInputRef.current) verdictFileInputRef.current.value = "";
                        }}
                      />

                      <button
                        type="button"
                        onClick={() => verdictFileInputRef.current?.click()}
                        onDragOver={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setIsDraggingVerdict(true);
                        }}
                        onDragLeave={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setIsDraggingVerdict(false);
                        }}
                        onDrop={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setIsDraggingVerdict(false);
                          handleVerdictFilesSelected(e.dataTransfer.files);
                        }}
                        className={`group relative flex h-[106px] min-h-[106px] w-full cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed px-4 py-3 transition-colors duration-300 outline-none ${
                          showVerdictAttachedFeedback
                            ? verdictAttachedExiting
                              ? "border-emerald-200 bg-emerald-50/25"
                              : "border-emerald-400 bg-emerald-50/60 ring-2 ring-emerald-100/80"
                            : isDraggingVerdict
                              ? "border-brand-red bg-brand-red/5 ring-2 ring-brand-red/20"
                              : "border-zinc-200 bg-zinc-50/50 hover:border-brand-red/40 hover:bg-brand-red/5"
                        }`}
                      >
                        {showVerdictAttachedFeedback ? (
                          <div
                            className={`flex flex-col items-center justify-center text-center ${
                              verdictAttachedExiting ? "animate-plf-check-out" : "animate-plf-check-in"
                            }`}
                          >
                            <div className="relative flex size-8 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 ring-2 ring-emerald-200/70 shadow-3xs animate-plf-check-breathe">
                              <AnimatedCheckIcon size={16} strokeWidth={2.8} />
                            </div>
                            <p className="mt-1.5 max-w-[360px] truncate font-heading text-[12px] font-bold text-emerald-700 leading-tight">
                              ¡{verdictAttachments.length === 1 ? "Archivo adjuntado correctamente" : `${verdictAttachments.length} archivos adjuntados correctamente`}!
                            </p>
                            <p className="mt-0.5 max-w-[360px] truncate text-[11px] text-emerald-600/80 leading-tight">
                              Haz clic o arrastra para añadir más si lo deseas
                            </p>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center justify-center text-center transition-opacity duration-300">
                            <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-zinc-500 transition-transform group-hover:scale-105">
                              <Upload className="size-4" />
                            </div>
                            <p className="mt-1.5 max-w-[360px] truncate font-heading text-[12px] font-semibold text-zinc-700 leading-tight">
                              Haz clic para adjuntar evidencias
                            </p>
                            <p className="mt-0.5 max-w-[360px] truncate text-[11px] text-zinc-400 leading-tight">
                              Imágenes (PNG, JPG), reportes en PDF, hojas de Excel, etc.
                            </p>
                          </div>
                        )}
                      </button>

                      <TicketPendingFileList
                        files={verdictAttachments}
                        onChange={setVerdictAttachments}
                        className="pt-1"
                        onRemove={() => {
                          if (transitionError) setTransitionError(null);
                        }}
                      />
                    </div>
                  </form>
                )}

                {updateStep === 2 && updateCategory !== "veredicto" && (
                  <form id="update-status-form" onSubmit={handleConfirmUpdateStatus} className="space-y-3">
                    <div className="flex flex-col gap-1">
                      <label htmlFor="update-comment" className={labelClass}>
                        {updateCategory === "cancelar"
                          ? "Motivo de cancelación"
                          : updateCategory === "pausar"
                            ? "Motivo de la pausa"
                            : "Comentario"}
                        {updateCategory === "cancelar" || updateCategory === "pausar" ? (
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
                            ? "Explica la razón de anulación (creado por error, duplicado, prueba)…"
                            : updateCategory === "pausar"
                              ? "Explica por qué se pausa este ticket…"
                              : "Contexto adicional para el historial del ticket…"
                        }
                        className={`${textareaClass} ${
                          transitionError &&
                          !updateComment.trim() &&
                          (updateCategory === "cancelar" || updateCategory === "pausar")
                            ? "border-brand-red ring-3 ring-brand-red/10 focus:border-brand-red"
                            : ""
                        }`}
                        autoFocus
                      />
                    </div>

                    {updateCategory === "cancelar" && (
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
              </div>
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
          maxWidth="max-w-xl"
          onClose={() => {
            if (!savingEdit) setShowEditModal(false);
          }}
          footer={
            <div className="flex w-full items-center justify-between gap-3">
              <span className="hidden select-none items-center gap-1 text-[11px] text-zinc-400 sm:inline-flex">
                <kbd className="rounded border border-zinc-200 bg-zinc-100 px-1 py-0.5 font-mono text-[10px] text-zinc-500">
                  Ctrl
                </kbd>
                <span>+</span>
                <kbd className="rounded border border-zinc-200 bg-zinc-100 px-1 py-0.5 font-mono text-[10px] text-zinc-500">
                  Enter
                </kbd>
                <span className="ml-0.5">para guardar</span>
              </span>
              <div className="ml-auto flex items-center gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={savingEdit}
                  onClick={() => setShowEditModal(false)}
                >
                  Cancelar
                </Button>
                <SubmitValidationButton
                  formId="edit-ticket-form"
                  ready={editSubject.trim().length > 0}
                  busy={savingEdit}
                  missingItems={buildValidationItems([
                    {
                      id: "edit-subject",
                      label: "Falta el asunto del ticket",
                      short: "el asunto",
                      valid: editSubject.trim().length > 0,
                    },
                  ])}
                  onFocusField={focusFormField}
                  tone={editError ? "ink" : "primary"}
                  toneLabel={editError}
                  hintText="Para guardar la clasificación, completa lo siguiente:"
                >
                  Guardar cambios
                </SubmitValidationButton>
              </div>
            </div>
          }
        >
          <form
            id="edit-ticket-form"
            onSubmit={handleConfirmEdit}
            onKeyDown={handleEditFormKeyDown}
            className="flex flex-col gap-4 text-left"
          >
            {loadingEditCatalogs ? (
              <div className="flex justify-center py-10">
                <Spinner size="sm" label="Cargando catálogos…" />
              </div>
            ) : (
              <>
                {editError && (
                  <Alert variant="error" className="text-[12px]">
                    {editError}
                  </Alert>
                )}

                <EditTicketFormDivider title="Asunto" />

                <TextField
                  id="edit-subject"
                  label="Asunto del ticket"
                  size="sm"
                  required
                  maxLength={200}
                  value={editSubject}
                  onChange={(event) => {
                    setEditSubject(event.target.value);
                    if (editError) setEditError(null);
                  }}
                  state={editError && !editSubject.trim() ? "error" : "idle"}
                  placeholder="Ej.: Reclamación por lote defectuoso en empaque…"
                  hint={<span className="tabular-nums">{editSubject.length}/200</span>}
                />

                <EditTicketFormDivider title="Clasificación" />

                <div className="flex flex-col gap-3.5">
                  <EditTicketSectionHeading icon={Tag} title="Motivo y departamento" />

                  <div className="flex flex-col gap-2.5">
                    <SelectField
                      id="edit-topic"
                      label="Motivo del ticket"
                      size="sm"
                      searchable
                      value={editTopicId !== null ? String(editTopicId) : ""}
                      onChange={(value) => {
                        const nextId = value ? Number(value) : null;
                        setEditTopicId(nextId);
                        if (editError) setEditError(null);
                        const topic = nextId ? editCatalogs?.topics.find((t) => t.id === nextId) : undefined;
                        if (topic?.defaultDepartmentId) setEditDepartmentId(topic.defaultDepartmentId);
                      }}
                      placeholder="Aún sin motivo"
                      options={[
                        { value: "", label: "Aún sin motivo" },
                        ...(editCatalogs?.topics ?? []).map((t) => ({ value: String(t.id), label: t.name })),
                      ]}
                    />
                    <SelectField
                      id="edit-dept"
                      label="Departamento"
                      size="sm"
                      searchable
                      wrapValue
                      value={editDepartmentId !== null ? String(editDepartmentId) : ""}
                      onChange={(value) => {
                        setEditDepartmentId(value ? Number(value) : null);
                        if (editError) setEditError(null);
                      }}
                      placeholder="Aún sin departamento"
                      options={[
                        { value: "", label: "Aún sin departamento" },
                        ...departmentPathOptions(editCatalogs?.departments ?? [], editDepartmentTree),
                      ]}
                    />
                  </div>
                </div>

                <EditTicketFormDivider title="Productos" />

                <div className="flex flex-col gap-3">
                  <EditTicketSectionHeading icon={Package} title="Productos relacionados" />
                  <TicketProductsField
                    value={editProducts}
                    onChange={(rows) => {
                      setEditProducts(rows);
                      if (editError) setEditError(null);
                    }}
                  />
                </div>

                <SlaPolicyField
                  embeddedSection
                  sectionBorder
                  readOnly
                  policies={sortedTicketSlaPolicies}
                  loading={ticketSlaPoliciesLoading}
                  value={initialTicketSlaPolicyId}
                  onChange={() => {}}
                  fieldLabel="Compromiso SLA inicial"
                  readOnlyHint="Quedó fijado al abrir el ticket; no se cambia al editar la clasificación."
                />
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
