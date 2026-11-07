import { zodResolver } from "@hookform/resolvers/zod";
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  Building2,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Info,
  PenLine,
  Plus,
  Trash2,
  Truck,
  Users,
  X,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { Fragment, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  Controller,
  useFieldArray,
  useForm,
  useWatch,
  type Control,
  type FieldErrors,
  type UseFormRegister,
  type UseFormSetValue,
} from "react-hook-form";
import { z } from "zod";
import { ApiError } from "../../api/client";
import { discrepanciesApi } from "../../api/discrepancies";
import { ticketsApi } from "../../api/tickets";
import { SubmitValidationButton } from "../../components/app/SubmitValidationButton";
import { EnterpriseFormCloseTicketModal } from "../../components/app/EnterpriseFormCloseTicketModal";
import { EnterpriseFormCompleteTaskModal } from "../../components/app/EnterpriseFormCompleteTaskModal";
import { shouldPromptEnterpriseFormHostClose } from "../../lib/enterpriseFormHostClose";
import { EnterpriseFormSaveDraftButton } from "../../components/app/EnterpriseFormSaveDraftButton";
import { EnterpriseFormSaveDraftConfirmModal } from "../../components/app/EnterpriseFormSaveDraftConfirmModal";
import { Button } from "../../components/ui/Button";
import { ControlInput } from "../../components/ui/ControlInput";
import {
  DateField,
  LookupField,
  SelectField,
  TextAreaField,
  TextField,
  type FieldState,
} from "../../components/ui/Field";
import { LookupSelect, type LookupOption } from "../../components/ui/LookupSelect";
import { FormLineTabStrip, formLineTabIndexAttr } from "../../components/ui/FormLineTabStrip";
import { Modal } from "../../components/ui/Modal";
import { useReceipts } from "../../context/useReceipts";
import {
  focusFormFieldByName,
  getDiscrepancyStepMissing,
} from "../../lib/enterpriseFormValidation";
import { focusFormField } from "../../lib/validationItems";
import { AppleSlidePanel, appleLineTabMotionClass } from "../../components/ui/AppleSlidePanel";
import { useAppleListMotion } from "../../hooks/useAppleListMotion";
import { useDialogMotion } from "../../hooks/useDialogMotion";
import { useModalAnimation } from "../../hooks/useModalAnimation";
import {
  cacheTicketInfo,
  DISCREPANCY_FORM_CONTROL,
  getCachedTicketInfo,
  resolveTicketLabel,
  searchTickets,
} from "../../lib/discrepancies";
import {
  clearEnterpriseFormDraft,
  enterpriseFormDraftKey,
  readEnterpriseFormDraft,
  writeEnterpriseFormDraft,
} from "../../lib/enterpriseFormDrafts";
import {
  resolveClientLabel,
  resolveProductLabel,
  resolveStaffLabel,
  searchActiveStaff,
  searchClients,
  searchProducts,
} from "../../lib/lookups";
import { autoResizeTextarea } from "../../lib/autoResizeTextarea";
import { toNumber } from "../../lib/numbers";
import { today } from "../../lib/quality";
import {
  ticketProductLabelMap,
  ticketProductsToLookupOptions,
} from "../../lib/ticketProducts";
import type { TicketProductResponse } from "../../types/api";
import type {
  DiscrepancyDetail,
  LoadDiscrepancy,
  SecurityCheckInput,
  SecurityCheckResult,
} from "../../types/discrepancies";

const quantity = z
  .string()
  .trim()
  .refine(
    (value) =>
      value !== "" &&
      !Number.isNaN(Number(value)) &&
      Number(value) >= 1 &&
      Number.isInteger(Number(value)),
    "Indica un número entero mayor a 0",
  );

// Espejo de DiscrepancyRules.ValidateLines (docs/plan/06, sección 13).
const lineSchema = z
  .object({
    productId: z.string().min(1, "Elige el producto"),
    invoiceRef: z
      .string()
      .trim()
      .min(1, "Indica la factura")
      .max(40, "Máximo 40 caracteres"),
    claimRef: z.string().trim().max(20, "Máximo 20 caracteres"),
    clientId: z.string(),
    discrepancyType: z.enum(["faltante", "sobrante"]),
    quantity: quantity,
    qualifies: z.enum(["", "si", "no"]),
    creditNoteNumber: z.string().trim().max(20, "Máximo 20 caracteres"),
    dispatcherMode: z.enum(["sistema", "manual"]),
    dispatcherStaffId: z.string().optional(),
    dispatcherName: z
      .string()
      .trim()
      .max(160, "Máximo 160 caracteres"),
    supervisorMode: z.enum(["sistema", "manual"]),
    supervisorStaffId: z.string().optional(),
    supervisorName: z.string().trim().max(160, "Máximo 160 caracteres"),
  })
  .superRefine((line, ctx) => {
    if (line.creditNoteNumber !== "" && line.qualifies !== "si") {
      ctx.addIssue({
        code: "custom",
        path: ["creditNoteNumber"],
        message: "Solo en una línea apta para nota de crédito",
      });
    }
    if (line.dispatcherMode === "sistema") {
      if (!line.dispatcherStaffId || !line.dispatcherName || line.dispatcherName.trim().length < 3) {
        ctx.addIssue({
          code: "custom",
          path: ["dispatcherName"],
          message: "Selecciona el despachador del sistema",
        });
      }
    } else {
      if (!line.dispatcherName || line.dispatcherName.trim().length < 3) {
        ctx.addIssue({
          code: "custom",
          path: ["dispatcherName"],
          message: "Escribe el despachador: al menos 3 caracteres",
        });
      }
    }
  });

const schema = z.object({
  ticketId: z.string().min(1, "Elige el ticket"),
  note: z.string().trim().max(4000, "Máximo 4000 caracteres"),
  lines: z.array(lineSchema).min(1, "Agrega al menos una línea"),
});

type FormValues = z.infer<typeof schema>;
type LineValues = FormValues["lines"][number];

const emptyLine = (defaultClientId = "", defaultClaimRef = ""): LineValues => ({
  productId: "",
  invoiceRef: "",
  claimRef: defaultClaimRef,
  clientId: defaultClientId,
  discrepancyType: "faltante",
  quantity: "",
  qualifies: "",
  creditNoteNumber: "",
  dispatcherMode: "sistema",
  dispatcherStaffId: "",
  dispatcherName: "",
  supervisorMode: "sistema",
  supervisorStaffId: "",
  supervisorName: "",
});

const DISCREPANCY_TYPE_OPTIONS = [
  { value: "faltante", label: "Faltante" },
  { value: "sobrante", label: "Sobrante" },
];

const QUALIFIES_OPTIONS = [
  { value: "", label: "Sin decidir" },
  { value: "si", label: "Sí" },
  { value: "no", label: "No" },
];

/** Lista oficial de los 9 puntos de seguridad de PF-FOR-291 */
const SECURITY_ITEMS = [
  {
    itemNumber: 1,
    text: "No se pudo evidenciar video de vigilancia de la carga al momento de la investigación",
  },
  {
    itemNumber: 2,
    text: "El despachador no realizó la inspeccion previa de contenedor vacio antes de iniciar la carga de materiales.",
  },
  {
    itemNumber: 3,
    text: "El despachador no utiliza las herramientas de inspeccion (Martillo de Goma, Formato de Inspección).",
  },
  {
    itemNumber: 4,
    text: "No hay suficiente iluminacion al momento de realizar la inspeccion del contenedor y no se utilizo linterna en caso falta de iluminacion.",
  },
  {
    itemNumber: 5,
    text: "La carga es introducida al contenedor antes de realizar la inspeccion de seguridad.",
  },
  {
    itemNumber: 6,
    text: "Durante el proceso de carga se pudo evidenciar la manipulación de empaques para introducir materiales sospechas dentro del empaque?",
  },
  {
    itemNumber: 7,
    text: "Durante el proceso de carga se pudo evidenciar la presencia de personal ajeno a la carga o no autorizado?",
  },
  {
    itemNumber: 8,
    text: "Alguna persona de las que trabajaron en la carga de contenedor nunca salió del contenedor al finalizar la carga? Contrabando de personas",
  },
  {
    itemNumber: 9,
    text: "En caso de positivo en alguna de las anteriores preguntas se notifico a las Gerencias de Seguridad y Logística del evento?",
  },
];

interface DiscrepancyFormModalProps {
  /** Ausente = alta. */
  discrepancy?: LoadDiscrepancy;
  /** Ticket fijado de antemano (alta desde un ticket concreto). */
  ticketId?: number;
  fixedTicketLabel?: string;
  ticketClientName?: string;
  ticketClientId?: number;
  ticketStatus?: string;
  onTicketStatusChanged?: () => void;
  /** Productos ligados al ticket: prellenan líneas y aparecen como recomendados al buscar. */
  ticketProducts?: TicketProductResponse[];
  initialData?: {
    note?: string;
    lines?: Array<{
      productId: string;
      invoiceRef?: string;
      clientId?: string;
      surplusQuantity?: string;
      shortageQuantity?: string;
    }>;
  };
  onClose: () => void;
  onSaved: (detail: DiscrepancyDetail) => void;
  formHostKind?: "ticket" | "task";
  hostTaskId?: number;
  hostTaskStatus?: string;
  /** Si es true, se renderiza como una página completa dentro de la pestaña en vez de una ve... */
  inline?: boolean;
}

/** Parsea la fecha y el cuerpo de la nota si existiera un prefijo [Fecha: ...] */
function parseNote(rawNote: string | null | undefined): { date: string; note: string } {
  if (!rawNote) return { date: today(), note: "" };
  const match = rawNote.match(/^(?:\[Fecha:\s*(\d{4}-\d{2}-\d{2})\]|Fecha:\s*(\d{4}-\d{2}-\d{2}))\s*\n?/i);
  if (match) {
    const date = match[1] || match[2];
    const cleanNote = rawNote.slice(match[0].length).trim();
    return { date, note: cleanNote };
  }
  return { date: today(), note: rawNote };
}

/** Divisor idéntico al de ClientModal */
function FormDivider({ title }: { title: string }) {
  return (
    <div className="flex items-center gap-2 pt-2 border-t border-zinc-100 first:border-0 first:pt-0">
      <span className="font-heading text-[10px] font-bold uppercase tracking-[0.08em] text-zinc-400 select-none">
        {title}
      </span>
      <div className="h-px flex-1 bg-zinc-100" />
    </div>
  );
}

/** Formulario de Investigación de Discrepancia de Carga (PF-FOR-291) Reestructurado en 3 p... */
/** Un paso del encabezado del asistente. Antes se copiaba tres veces con
 *  `focus:outline-hidden` y sin anillo: el teclado perdía de vista el foco. */
function StepperButton({
  n,
  current,
  title,
  caption,
  disabled,
  onSelect,
}: {
  n: 1 | 2 | 3;
  current: 1 | 2 | 3;
  title: string;
  caption: string;
  disabled: boolean;
  onSelect: () => void;
}) {
  const isCurrent = current === n;
  const isDone = current > n;
  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={disabled}
      aria-current={isCurrent ? "step" : undefined}
      className="group flex cursor-pointer items-center gap-2 rounded-edge outline-none focus-visible:ring-2 focus-visible:ring-brand-red/25 focus-visible:ring-offset-2 disabled:cursor-not-allowed"
    >
      <span
        className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold transition-all ${
          isCurrent
            ? "bg-brand-red text-white shadow-2xs ring-2 ring-brand-red/20"
            : isDone
            ? "bg-emerald-600 text-white"
            : "bg-zinc-200 text-zinc-600 group-hover:bg-zinc-300"
        }`}
      >
        {isDone ? <Check className="h-3.5 w-3.5" aria-hidden /> : n}
      </span>
      <span className="flex flex-col text-left">
        <span
          className={`text-[12px] font-heading font-semibold transition-colors ${
            isCurrent ? "text-zinc-900" : isDone ? "text-zinc-700" : "text-zinc-400"
          }`}
        >
          {title}
        </span>
        <span className="hidden text-[10px] text-zinc-400 sm:inline">{caption}</span>
      </span>
    </button>
  );
}

export function DiscrepancyFormModal({
  discrepancy,
  ticketId,
  fixedTicketLabel,
  ticketClientName,
  ticketClientId,
  ticketStatus,
  onTicketStatusChanged,
  ticketProducts,
  initialData,
  onClose,
  onSaved,
  inline = false,
  formHostKind = "ticket",
  hostTaskId,
  hostTaskStatus,
}: DiscrepancyFormModalProps) {
  const isEdit = discrepancy !== undefined;
  const contextCodeLabel = formHostKind === "task" ? "Tarea" : "Ticket";
  const draftLoadedRef = useRef(false);
  const recommendedProductOptions = useMemo(
    () => ticketProductsToLookupOptions(ticketProducts),
    [ticketProducts],
  );
  const ticketProductLabels = useMemo(
    () => ticketProductLabelMap(ticketProducts),
    [ticketProducts],
  );
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [saveDraftConfirmOpen, setSaveDraftConfirmOpen] = useState(false);
  const receipts = useReceipts();

  // Almacena el resultado para entregarlo a onSaved cuando termine la animación de salida
  const savedResultRef = useRef<DiscrepancyDetail | null>(null);

  // Modal para preguntar si desea cerrar el ticket al completar la investigación
  const [showClosePrompt, setShowClosePrompt] = useState(false);
  const [completedDiscrepancy, setCompletedDiscrepancy] = useState<DiscrepancyDetail | null>(null);

  const finishModal = (saved: DiscrepancyDetail) => {
    setShowClosePrompt(false);
    if (inline) {
      savedResultRef.current = saved;
      requestClose();
    } else {
      onSaved(saved);
      requestClose();
    }
  };

  const handleFinishedExit = () => {
    if (savedResultRef.current) {
      onSaved(savedResultRef.current);
    } else {
      onClose();
    }
  };

  const modalAnimation = useModalAnimation();
  const inlineMotion = useDialogMotion(handleFinishedExit);

  const requestClose = inline ? inlineMotion.requestClose : modalAnimation.requestClose;
  const isExiting = inline ? inlineMotion.isExiting : modalAnimation.isExiting;

  // Parsing de nota inicial y fecha de despacho
  const parsedNote = parseNote(discrepancy?.note ?? initialData?.note);
  const [discrepancyDate, setDiscrepancyDate] = useState<string>(parsedNote.date);

  // Ticket label y cliente resueltos de inmediato (sin delay de red ni mostrar ID en bruto)
  const initialTicketId = discrepancy ? discrepancy.ticketId : ticketId;
  const draftStorageKey =
    !isEdit && initialTicketId ? enterpriseFormDraftKey("pf291", initialTicketId) : null;
  const initialTicketLabel =
    fixedTicketLabel ??
    (discrepancy ? `${discrepancy.ticketNumber} · ${discrepancy.ticketSubject}` : undefined) ??
    (initialTicketId ? getCachedTicketInfo(initialTicketId)?.label : undefined);

  const [ticketLabel, setTicketLabel] = useState<string | undefined>(initialTicketLabel);

  const initialClientName =
    ticketClientName ||
    discrepancy?.clientName ||
    (initialTicketId ? getCachedTicketInfo(initialTicketId)?.clientName : undefined) ||
    undefined;

  const initialClientId =
    ticketClientId ||
    discrepancy?.clientId ||
    (initialTicketId ? getCachedTicketInfo(initialTicketId)?.clientId : undefined) ||
    undefined;

  const [effectiveTicketClientName, setEffectiveTicketClientName] = useState<string | undefined>(initialClientName);
  const [effectiveTicketClientId, setEffectiveTicketClientId] = useState<number | undefined>(initialClientId);

  const scopeDisplayCode = useMemo(() => {
    if (formHostKind !== "task" || !fixedTicketLabel) return null;
    const match = /^([A-Z0-9_-]+)\s*(?:[·–—\-:]|\s-\s)/i.exec(fixedTicketLabel.trim());
    return match?.[1]?.trim() ?? fixedTicketLabel.split("·")[0]?.trim() ?? null;
  }, [formHostKind, fixedTicketLabel]);

  // Derivar número de caso para autocompletar # Reclamo
  const derivedTicketNumber =
    scopeDisplayCode ||
    discrepancy?.ticketNumber ||
    (ticketLabel ? ticketLabel.split(" ")[0].trim() : "");

  const parsedTicketInfo = useMemo(() => {
    if (!ticketLabel) {
      return {
        code: derivedTicketNumber || null,
        subject: null,
      };
    }
    const match = /^([A-Z0-9_-]+)\s*(?:[·–—\-:]|\s-\s)\s*(.+)$/i.exec(ticketLabel.trim());
    if (match) {
      return {
        code: match[1].trim(),
        subject: match[2].trim(),
      };
    }
    return {
      code: derivedTicketNumber || null,
      subject: ticketLabel,
    };
  }, [ticketLabel, derivedTicketNumber]);

  // Caché inmediata
  if (initialTicketId && initialTicketLabel) {
    cacheTicketInfo(initialTicketId, initialTicketLabel, initialClientName, initialClientId);
  }

  // Consulta en segundo plano si falta el cliente. Se mantiene como efecto (se
  // repite al quitar el ticket), pero comparte la petición y la caché del ticket.
  const queryClient = useQueryClient();
  useEffect(() => {
    if (initialTicketId && !effectiveTicketClientName) {
      queryClient
        .fetchQuery({ queryKey: ["tickets", initialTicketId], queryFn: () => ticketsApi.getById(initialTicketId) })
        .then((t) => {
          const label = `${t.number} · ${t.subject}`;
          setTicketLabel(label);
          cacheTicketInfo(t.id, label, t.clientName, t.clientId);
          if (t.clientName) setEffectiveTicketClientName(t.clientName);
          if (t.clientId) setEffectiveTicketClientId(t.clientId);
        })
        .catch(() => {});
    }
  }, [initialTicketId, effectiveTicketClientName, queryClient]);

  const defaultClientIdForLines = initialClientId ? String(initialClientId) : "";

  // React Hook Form
  const {
    control,
    register,
    handleSubmit,
    setValue,
    getValues,
    reset,
    trigger,
    formState: { errors, touchedFields, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    mode: "onTouched",
    defaultValues: {
      ticketId: discrepancy
        ? String(discrepancy.ticketId)
        : ticketId
        ? String(ticketId)
        : "",
      note: parsedNote.note,
      lines:
        discrepancy && discrepancy.lines.length > 0
          ? discrepancy.lines.map((line) => {
              const isSurplus = line.surplusQuantity > 0;
              const qty = isSurplus
                ? String(line.surplusQuantity)
                : line.shortageQuantity > 0
                ? String(line.shortageQuantity)
                : "";
              return {
                productId: String(line.productId),
                invoiceRef: line.invoiceRef,
                claimRef: line.claimRef || derivedTicketNumber || "",
                clientId: line.clientId ? String(line.clientId) : defaultClientIdForLines,
                discrepancyType: isSurplus ? ("sobrante" as const) : ("faltante" as const),
                quantity: qty,
                qualifies:
                  line.qualifiesForCreditNote === null
                    ? ""
                    : line.qualifiesForCreditNote
                    ? "si"
                    : "no",
                creditNoteNumber: line.creditNoteNumber ?? "",
                dispatcherMode: line.dispatcherStaffId
                  ? ("sistema" as const)
                  : line.dispatcherName
                  ? ("manual" as const)
                  : ("sistema" as const),
                dispatcherStaffId: line.dispatcherStaffId ? String(line.dispatcherStaffId) : "",
                dispatcherName: line.dispatcherName,
                supervisorMode: line.supervisorStaffId
                  ? ("sistema" as const)
                  : line.supervisorName
                  ? ("manual" as const)
                  : ("sistema" as const),
                supervisorStaffId: line.supervisorStaffId ? String(line.supervisorStaffId) : "",
                supervisorName: line.supervisorName ?? "",
              };
            })
          : initialData?.lines && initialData.lines.length > 0
          ? initialData.lines.map((l) => {
              const isSurplus = Number(l.surplusQuantity) > 0;
              const qty = isSurplus
                ? String(l.surplusQuantity)
                : Number(l.shortageQuantity) > 0
                ? String(l.shortageQuantity)
                : "";
              return {
                ...emptyLine(defaultClientIdForLines, derivedTicketNumber),
                productId: l.productId,
                invoiceRef: l.invoiceRef ?? "",
                clientId: l.clientId ?? defaultClientIdForLines,
                discrepancyType: isSurplus ? ("sobrante" as const) : ("faltante" as const),
                quantity: qty,
              };
            })
          : !isEdit && ticketProducts && ticketProducts.length > 0
          ? ticketProducts.map((p) => ({
              ...emptyLine(defaultClientIdForLines, derivedTicketNumber),
              productId: String(p.productId),
            }))
          : [emptyLine(defaultClientIdForLines, derivedTicketNumber)],
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: "lines" });
  const watchLines = useWatch({ control, name: "lines" });
  const [activeLineIndex, setActiveLineIndex] = useState(0);

  const safeActiveLineIndex = Math.min(
    activeLineIndex,
    Math.max(0, fields.length - 1),
  );

  const formValues = useWatch({ control });

  const lineMotion = useAppleListMotion(
    fields.map((field) => field.id),
    { minItems: 1, enterMs: 440, exitMs: 400 },
  );
  const lineCardAnchorRef = useRef<HTMLDivElement>(null);

  const handleAddLine = () => {
    const nextIndex = fields.length;
    append(emptyLine(defaultClientIdForLines, derivedTicketNumber));
    setActiveLineIndex(nextIndex);
  };

  const handleRemoveLine = (idxToRemove: number) => {
    if (fields.length <= 1) return;
    const field = fields[idxToRemove];
    if (!field) return;
    lineMotion.requestRemove(field.id, () => {
      remove(idxToRemove);
      setActiveLineIndex((current) => {
        if (current === idxToRemove) {
          return Math.max(0, idxToRemove - 1);
        }
        if (current > idxToRemove) {
          return current - 1;
        }
        return current;
      });
    });
  };
  const noteValue = useWatch({ control, name: "note" }) ?? "";
  const noteField = register("note");
  const noteTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const ticketIdValue = useWatch({ control, name: "ticketId" }) ?? "";

  useLayoutEffect(() => {
    autoResizeTextarea(noteTextareaRef.current, 64);
  }, [noteValue, step]);

  // Puntos de Seguridad (Paso 3)
  type CheckChoice = "Positivo" | "Negativo" | "";
  const [checks, setChecks] = useState<Record<number, CheckChoice>>(() => {
    if (discrepancy?.checks && discrepancy.checks.length > 0) {
      return Object.fromEntries(
        discrepancy.checks.map((c) => [c.itemNumber, (c.result as CheckChoice) ?? ""]),
      );
    }
    return { 1: "", 2: "", 3: "", 4: "", 5: "", 6: "", 7: "", 8: "", 9: "" };
  });

  // Verifica si hay algún hallazgo positivo en los puntos 1 al 8
  const anyPositive = Object.entries(checks).some(
    ([n, val]) => Number(n) !== 9 && val === "Positivo",
  );

  const discrepancyStepMissing = useMemo(
    () =>
      getDiscrepancyStepMissing({
        step: step as 1 | 2 | 3,
        ticketId: ticketIdValue,
        discrepancyDate,
        lines: formValues?.lines ?? [],
        checks,
        anyPositive,
      }),
    [step, ticketIdValue, discrepancyDate, formValues?.lines, checks, anyPositive],
  );

  async function invalidateDiscrepancyStep() {
    if (step === 1) await trigger("ticketId");
    else if (step === 2) await trigger("lines");
  }

  function focusDiscrepancyField(fieldId: string) {
    if (fieldId === "ticketId" || fieldId === "discrepancy-date") {
      if (step !== 1) setStep(1);
      setTimeout(() => {
        if (fieldId === "ticketId") focusFormFieldByName("ticketId");
        else focusFormField("discrepancy-date");
      }, 60);
      return;
    }
    const lineMatch = /^lines\.(\d+)\./.exec(fieldId);
    if (lineMatch) {
      setActiveLineIndex(Number(lineMatch[1]));
      if (step !== 2) setStep(2);
      setTimeout(() => focusFormFieldByName(fieldId), 60);
      return;
    }
    if (fieldId.startsWith("security-check-")) {
      if (step !== 3) setStep(3);
      setTimeout(() => focusFormField(fieldId), 60);
      return;
    }
    focusFormFieldByName(fieldId);
  }

  function toggleCheck(itemNumber: number, choice: "Positivo" | "Negativo") {
    // Si es el punto 9 y no hay ningún positivo en 1..8, no aplica
    if (itemNumber === 9 && !anyPositive) return;

    const current = checks[itemNumber];
    const willBePositive = current !== "Positivo" && choice === "Positivo";
    if (willBePositive && itemNumber !== 9) {
      receipts.failed({
        action: "hallazgo-seguridad",
        title: "Hallazgo de seguridad detectado",
        detail: `Punto #${itemNumber}: el punto #9 se ha habilitado y es obligatorio para notificar a Seguridad y Logística.`,
      });
    }

    setChecks((prev) => {
      const nextVal: CheckChoice = current === choice ? "" : choice;
      const updated: Record<number, CheckChoice> = { ...prev, [itemNumber]: nextVal };

      // Si ningún punto 1-8 quedó positivo, limpiamos el punto 9 automáticamente
      const stillPositive = Object.entries(updated).some(
        ([n, val]) => Number(n) !== 9 && val === "Positivo",
      );
      if (!stillPositive) {
        updated[9] = "";
      }
      return updated;
    });
  }

  function stateOf(field: "ticketId"): FieldState {
    if (errors[field]) return "error";
    return touchedFields[field] ? "valid" : "idle";
  }

  useEffect(() => {
    if (!draftStorageKey || draftLoadedRef.current) return;
    const draft = readEnterpriseFormDraft<{
      step?: number;
      values?: FormValues;
      activeLineIndex?: number;
      discrepancyDate?: string;
      checks?: Record<number, CheckChoice>;
    }>(draftStorageKey);
    if (!draft?.values) return;
    draftLoadedRef.current = true;
    reset(draft.values);
    if (typeof draft.step === "number" && draft.step >= 1 && draft.step <= 3) {
      setStep(draft.step as 1 | 2 | 3);
    }
    if (typeof draft.activeLineIndex === "number") {
      setActiveLineIndex(Math.max(0, draft.activeLineIndex));
    }
    if (typeof draft.discrepancyDate === "string") setDiscrepancyDate(draft.discrepancyDate);
    if (draft.checks && typeof draft.checks === "object") setChecks(draft.checks);
  }, [draftStorageKey, reset]);

  function handleSaveDraft() {
    if (!draftStorageKey || isSubmitting) return;
    const ticketLabelShort = ticketLabel?.split(" ")[0] ?? fixedTicketLabel?.split(" ")[0] ?? "";
    if (
      !writeEnterpriseFormDraft(draftStorageKey, {
        step,
        values: getValues(),
        activeLineIndex: safeActiveLineIndex,
        discrepancyDate,
        checks,
      })
    ) {
      receipts.failed({
        action: "guardar-borrador-discrepancia",
        title: "No se pudo guardar el borrador",
        detail: "Revisa el espacio del navegador e inténtalo de nuevo.",
      });
      return;
    }
    receipts.done({
      action: "guardar-borrador-discrepancia",
      title: "Borrador guardado",
      detail: `${DISCREPANCY_FORM_CONTROL.code}${ticketLabelShort ? ` · ${ticketLabelShort}` : ""}`,
    });
  }

  // Navegación entre pasos con validación
  async function handleNextStep() {
    if (step === 1) {
      const validTicket = await trigger("ticketId");
      if (!validTicket || !ticketIdValue || !discrepancyDate) {
        return;
      }
      // Autocompleta # Reclamo si quedó en blanco
      fields.forEach((_, idx) => {
        const currentRef = control._formValues.lines?.[idx]?.claimRef;
        if (!currentRef && derivedTicketNumber) {
          setValue(`lines.${idx}.claimRef`, derivedTicketNumber);
        }
      });
      setStep(2);
    } else if (step === 2) {
      const validLines = await trigger("lines");
      if (!validLines) {
        const currentErrors = control._formState.errors.lines;
        if (Array.isArray(currentErrors)) {
          const firstErrIdx = currentErrors.findIndex((err) => Boolean(err));
          if (firstErrIdx !== -1) {
            setActiveLineIndex(firstErrIdx);
          }
        }
        return;
      }
      setStep(3);
    }
  }

  async function onSubmit(values: FormValues) {
    // Requiere que los puntos 1 al 8 estén evaluados
    const unanswered = [1, 2, 3, 4, 5, 6, 7, 8].filter((n) => !checks[n]);
    if (unanswered.length > 0) {
      receipts.failed({
        action: "seguridad-incompleta",
        title: "Puntos de seguridad requeridos",
        detail: `Faltan ${unanswered.length} puntos de seguridad por evaluar (marca Positivo o Negativo).`,
      });
      setStep(3);
      return;
    }

    // Validación del punto 9 según la regla de negocio
    if (anyPositive && !checks[9]) {
      receipts.failed({
        action: "seguridad-punto-9",
        title: "Punto 9 obligatorio",
        detail: "Hay un hallazgo de seguridad positivo. Debes indicar si se notificó a las Gerencias de Seguridad y Logística.",
      });
      setStep(3);
      return;
    }

    const blank = (value: string) => (value.trim() === "" ? null : value.trim());

    // Construye la nota final incluyendo la fecha de despacho seleccionada
    const cleanUserNote = values.note.trim();
    const finalNote = discrepancyDate
      ? `[Fecha: ${discrepancyDate}]${cleanUserNote ? `\n${cleanUserNote}` : ""}`
      : cleanUserNote;

    const checksPayload: SecurityCheckInput[] = Object.entries(checks).map(([n, val]) => ({
      itemNumber: Number(n),
      result: val === "" ? null : (val as SecurityCheckResult),
    }));

    const request = {
      note: blank(finalNote),
      lines: values.lines.map((line) => ({
        productId: Number(line.productId),
        invoiceRef: line.invoiceRef.trim(),
        claimRef: blank(line.claimRef),
        clientId: line.clientId === "" ? null : Number(line.clientId),
        surplusQuantity: line.discrepancyType === "sobrante" ? toNumber(line.quantity) : 0,
        shortageQuantity: line.discrepancyType === "faltante" ? toNumber(line.quantity) : 0,
        qualifiesForCreditNote:
          line.qualifies === "" ? null : line.qualifies === "si",
        creditNoteNumber: blank(line.creditNoteNumber),
        dispatcherName: line.dispatcherName.trim(),
        dispatcherStaffId:
          line.dispatcherMode === "sistema" && line.dispatcherStaffId
            ? Number(line.dispatcherStaffId)
            : null,
        supervisorName: blank(line.supervisorName),
        supervisorStaffId:
          line.supervisorMode === "sistema" && line.supervisorStaffId
            ? Number(line.supervisorStaffId)
            : null,
      })),
      checks: checksPayload,
    };

    try {
      const saved = isEdit
        ? await discrepanciesApi.update(discrepancy.id, request)
        : await discrepanciesApi.create(Number(values.ticketId), request);
      clearEnterpriseFormDraft(draftStorageKey);
      receipts.done({
        action: "guardar-discrepancia",
        title: isEdit ? "Investigación actualizada" : "Investigación creada",
        detail: `PF-FOR-291 · ${saved.discrepancy.number}`,
      });

      const effectiveTicketId = Number(values.ticketId || ticketId);

      if (
        shouldPromptEnterpriseFormHostClose(
          formHostKind,
          effectiveTicketId,
          hostTaskId,
          ticketStatus,
          hostTaskStatus,
        )
      ) {
        setCompletedDiscrepancy(saved);
        setShowClosePrompt(true);
      } else {
        finishModal(saved);
      }
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.message
          : isEdit
          ? "No se pudo guardar la investigación"
          : "No se pudo crear la investigación";
      receipts.failed({
        action: "error-discrepancia",
        title: isEdit ? "Error al guardar cambios" : "Error al crear investigación",
        detail: msg,
      });
    }
  }

  // Dinamismo de ancho para modal: amplio para la tabla editorial sin apretar columnas ni s...
  const modalMaxWidth =
    step === 1 ? "max-w-3xl" : "max-w-[96vw] 2xl:max-w-[1720px] w-full";

  const ticketInheritedLabel = effectiveTicketClientName
    ? effectiveTicketClientName
    : "Buscar cliente…";

  // Stepper Header
  const stepperSteps: { n: 1 | 2 | 3; title: string; caption: string; enabled: boolean }[] = [
    { n: 1, title: "Origen y Despacho", caption: "Ticket y fecha", enabled: true },
    { n: 2, title: "Líneas y Detalle", caption: "Productos y nota", enabled: !!ticketIdValue },
    {
      n: 3,
      title: "Puntos de Seguridad",
      caption: "9 puntos de control",
      enabled: !!ticketIdValue && fields.length > 0,
    },
  ];

  const renderStepper = () => (
    <nav aria-label="Pasos del formulario" className="mx-auto w-full max-w-lg select-none">
      <ol className="flex w-full items-center justify-between">
        {stepperSteps.map((item, index) => (
          <Fragment key={item.n}>
            {index > 0 && (
              <li
                aria-hidden
                className={`mx-3 h-0.5 flex-1 rounded-full transition-colors ${
                  step > index ? "bg-emerald-600/40" : "bg-zinc-200"
                }`}
              />
            )}
            <li className="flex">
              <StepperButton
                n={item.n}
                current={step}
                title={item.title}
                caption={item.caption}
                disabled={!item.enabled}
                onSelect={() => {
                  if (item.enabled) setStep(item.n);
                }}
              />
            </li>
          </Fragment>
        ))}
      </ol>
    </nav>
  );

  // Paso 1: Origen e Identificación (Diseño Editorial Simétrico y Dividido)
  const renderStep1 = () => (
    <div className="flex flex-col gap-4 animate-plf-fade">
      <div className="rounded-xl border border-zinc-200/90 bg-white shadow-2xs overflow-hidden">
        {/** Cabecera sobria y editorial (sin mayúsculas sostenidas ni badges repetitivos) */}
        <div className="border-b border-zinc-100 bg-zinc-50/70 px-5 sm:px-6 py-3.5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="flex size-7 items-center justify-center rounded-lg bg-zinc-200/60 text-zinc-700">
              <Truck className="size-4 text-zinc-700" />
            </div>
            <div>
              <h3 className="font-heading text-xs font-semibold text-zinc-900">
                Origen del caso y fecha de investigación
              </h3>
              <p className="text-[11px] text-zinc-500">
                Información vinculada al caso y fecha oficial para la investigación.
              </p>
            </div>
          </div>
          {ticketLabel && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 border border-emerald-200/80 px-2.5 py-0.5 text-[11px] font-medium text-emerald-700">
              <CheckCircle2 className="size-3 text-emerald-600" />
              <span>{contextCodeLabel} vinculada</span>
            </span>
          )}
        </div>

        {/** Fila 1: Ticket vinculado y Cliente asociado */}
        <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-zinc-100 border-b border-zinc-100">
          {/** Columna 1: Ticket vinculado */}
          <div className="p-5 flex flex-col justify-center gap-1.5">
            <label className="font-heading text-[11.5px] font-semibold text-faint">
              {contextCodeLabel} vinculada
            </label>
            {ticketIdValue ? (
              <div className="flex items-center justify-between gap-2 h-9">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="shrink-0 font-mono text-xs font-bold text-zinc-900 bg-zinc-100 border border-zinc-200/80 px-2.5 py-1 rounded-md">
                    {parsedTicketInfo.code || ticketIdValue}
                  </span>
                  <span className="text-[11.5px] text-zinc-400 truncate">
                    Caso registrado
                  </span>
                </div>
                {!isEdit && ticketId === undefined && (
                  <button
                    type="button"
                    onClick={() => {
                      setValue("ticketId", "");
                      setTicketLabel(undefined);
                      setEffectiveTicketClientName(undefined);
                    }}
                    className="shrink-0 text-xs text-brand-red hover:underline font-medium cursor-pointer"
                  >
                    Cambiar
                  </button>
                )}
                <input type="hidden" {...register("ticketId")} value={ticketIdValue} />
              </div>
            ) : (
              <Controller
                name="ticketId"
                control={control}
                render={({ field }) => (
                  <LookupField
                    size="sm"
                    label=""
                    required
                    name={field.name}
                    value={field.value}
                    selectedLabel={ticketLabel}
                    onChange={(value, option) => {
                      field.onChange(value);
                      if (option) {
                        setTicketLabel(option.label);
                        if (option.hint) {
                          setEffectiveTicketClientName(option.hint);
                        }
                      }
                    }}
                    onBlur={field.onBlur}
                    placeholder="Elige un ticket…"
                    searchPlaceholder="Número, asunto o cliente…"
                    search={searchTickets}
                    resolveSelectedLabel={resolveTicketLabel}
                    disabled={isEdit || ticketId !== undefined}
                    state={stateOf("ticketId")}
                    error={errors.ticketId?.message}
                  />
                )}
              />
            )}
          </div>

          {/** Columna 2: Cliente asociado */}
          <div className="p-5 flex flex-col justify-center gap-1.5">
            <label className="font-heading text-[11.5px] font-semibold text-faint">
              Cliente asociado
            </label>
            <div className="flex items-center gap-2 h-9 min-w-0">
              <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-zinc-100 border border-zinc-200/60 text-zinc-500">
                <Building2 className="size-3.5" />
              </div>
              <span
                className="text-xs font-semibold text-zinc-800 truncate"
                title={effectiveTicketClientName || "No especificado"}
              >
                {effectiveTicketClientName || "No especificado"}
              </span>
            </div>
          </div>
        </div>

        {/** Fila 2: Asunto del caso y Fecha de investigación */}
        <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-zinc-100">
          {/** Columna 1: Asunto del caso */}
          <div className="p-5 flex flex-col justify-center gap-1.5">
            <label className="font-heading text-[11.5px] font-semibold text-faint">
              Asunto del caso
            </label>
            <div className="flex items-center h-9 min-w-0">
              <p
                className="text-xs font-semibold text-zinc-800 truncate leading-normal"
                title={parsedTicketInfo.subject || ticketLabel || "Sin asunto"}
              >
                {parsedTicketInfo.subject || ticketLabel || "Sin asunto registrado"}
              </p>
            </div>
          </div>

          {/** Columna 2: Fecha de investigación */}
          <div className="p-5 flex flex-col justify-center">
            <DateField
              id="discrepancy-date"
              label="Fecha de investigación"
              required
              value={discrepancyDate}
              onChange={setDiscrepancyDate}
              placeholder="Seleccionar fecha…"
              headerLabel="Fecha de investigación"
              align="end"
            />
          </div>
        </div>

        {/** Pie unificado informativo y sobrio */}
        <div className="bg-zinc-50/50 px-5 sm:px-6 py-2.5 border-t border-zinc-100 text-[11px] text-zinc-400 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <Info className="size-3.5 shrink-0 text-zinc-400" />
            <span>Documenta diferencias entre la carga facturada y la despachada físicamente.</span>
          </div>
          {recommendedProductOptions.length > 0 ? (
            <div className="flex items-center gap-1.5 text-zinc-500 font-medium">
              <span>{recommendedProductOptions.length} producto{recommendedProductOptions.length === 1 ? "" : "s"} para revisar en el Paso 2</span>
            </div>
          ) : (
            <div className="hidden sm:flex items-center gap-1.5 text-zinc-400">
              <span>Trazabilidad de precinto y contenedor</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  // Paso 2: Líneas en Discrepancia y Nota Operativa (Diseño con Pestañas y Transición Fluida)
  const renderStep2 = () => {
    const activeField = fields[safeActiveLineIndex] ?? fields[0];
    const activeIndex = activeField ? fields.indexOf(activeField) : 0;
    const activeLineErrors = errors.lines?.[activeIndex];
    const activeExistingLine = discrepancy?.lines?.[activeIndex];

    return (
      <div className="flex min-w-0 flex-col gap-3.5 animate-plf-fade">
        {/** Encabezado con divisor oficial y pestañas interactivas */}
        <div className="flex min-w-0 flex-col gap-2">
          <div className="flex items-center justify-between">
            <FormDivider title="Líneas en discrepancia (Formato PF-FOR-291)" />
            <span className="text-xs font-medium text-zinc-400 select-none">
              {fields.length} {fields.length === 1 ? "línea registrada" : "líneas registradas"}
            </span>
          </div>

          {/** Barra de pestañas interactiva */}
          <div className="animate-plf-tabs-in min-w-0 border-b border-zinc-200/80 pb-2">
            <FormLineTabStrip
              activeIndex={safeActiveLineIndex}
              tabCount={fields.length}
              trailing={
                <button
                  type="button"
                  onClick={handleAddLine}
                  className="inline-flex shrink-0 cursor-pointer items-center gap-1 rounded-lg border border-dashed border-zinc-300 bg-white/60 px-2.5 py-1.5 text-xs font-medium text-zinc-600 shadow-2xs transition-all hover:border-zinc-400 hover:bg-white hover:text-zinc-900"
                  title="Agregar otra línea en discrepancia"
                >
                  <Plus className="size-3.5 text-zinc-500" />
                  <span>Agregar línea</span>
                </button>
              }
            >
              {fields.map((field, idx) => {
                const lineDiscrepancyType = watchLines?.[idx]?.discrepancyType ?? "faltante";
                const lineQty = Number(watchLines?.[idx]?.quantity) || 0;
                const hasError = Boolean(errors.lines?.[idx]);
                const isActive = idx === safeActiveLineIndex;
                const tabExiting = lineMotion.isExiting(field.id);
                const tabEntering = lineMotion.isEntering(field.id);

                return (
                  <button
                    key={field.id}
                    type="button"
                    {...formLineTabIndexAttr(idx)}
                    onClick={() => setActiveLineIndex(idx)}
                    aria-hidden={tabExiting || undefined}
                    disabled={tabExiting}
                    className={`group relative inline-flex shrink-0 cursor-pointer select-none items-center gap-2 rounded-lg border px-3 py-1.5 text-xs transition-all duration-150 ${
                      isActive
                        ? "border-zinc-200/90 bg-white font-semibold text-zinc-900 shadow-2xs ring-1 ring-zinc-950/5"
                        : "border-transparent bg-zinc-100/80 font-medium text-zinc-500 hover:bg-zinc-200/70 hover:text-zinc-800"
                    } ${appleLineTabMotionClass(tabEntering, tabExiting)}`}
                  >
                    <span
                      className={`flex size-4.5 items-center justify-center rounded-md font-heading text-[10px] font-bold ${
                        isActive ? "bg-zinc-900 text-white" : "bg-zinc-200 text-zinc-600"
                      }`}
                    >
                      {idx + 1}
                    </span>

                    <span>Línea #{idx + 1}</span>

                    {lineQty > 0 && (
                      <span
                        className={`rounded px-1.5 py-0.5 text-[10px] font-semibold tabular-nums leading-none ${
                          lineDiscrepancyType === "sobrante"
                            ? "border border-emerald-200/60 bg-emerald-50 text-emerald-700"
                            : "border border-amber-200/60 bg-amber-50 text-amber-700"
                        }`}
                      >
                        {lineDiscrepancyType === "sobrante" ? `+${lineQty}` : `-${lineQty}`}
                      </span>
                    )}

                    {hasError && (
                      <span
                        className="size-1.5 animate-pulse rounded-full bg-brand-red"
                        title="Tiene campos pendientes"
                      />
                    )}

                    {fields.length > 1 && (
                      <span
                        role="button"
                        tabIndex={0}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemoveLine(idx);
                        }}
                        title={`Quitar línea #${idx + 1}`}
                        className="-mr-1 ml-0.5 cursor-pointer rounded p-0.5 text-zinc-400 opacity-60 transition-all hover:bg-rose-100 hover:text-brand-red group-hover:opacity-100"
                      >
                        <X className="size-3" />
                      </span>
                    )}
                  </button>
                );
              })}
            </FormLineTabStrip>
          </div>
        </div>

        {/** Ficha de la línea activa — entrada/salida alineada con PF-FOR-068 */}
        {activeField && (
          <AppleSlidePanel
            key={activeField.id}
            motionKey={activeField.id}
            enter={lineMotion.isEntering(activeField.id)}
            exit={lineMotion.isExiting(activeField.id)}
            className={
              lineMotion.isExiting(activeField.id) ? "pointer-events-none" : undefined
            }
          >
            <div ref={lineCardAnchorRef}>
              <DiscrepancyLineCard
                index={activeIndex}
                control={control}
                register={register}
                setValue={setValue}
                lineErrors={activeLineErrors}
                existingLine={activeExistingLine}
                ticketClientName={effectiveTicketClientName}
                ticketClientId={effectiveTicketClientId}
                ticketInheritedLabel={ticketInheritedLabel}
                recommendedProductOptions={recommendedProductOptions}
                ticketProductLabels={ticketProductLabels}
                formHostKind={formHostKind}
                canRemove={fields.length > 1 && !lineMotion.isExiting(activeField.id)}
                onRemove={() => handleRemoveLine(activeIndex)}
              />
            </div>
          </AppleSlidePanel>
        )}

        {/** SECCIÓN DE LA NOTA (según PF-FOR-291) */}
        <div className="mt-2 flex flex-col gap-1.5">
        <FormDivider title="Uso interno" />
        <TextAreaField
          id="discrepancy-notes"
          label="Notas operativas"
          rows={2}
          className="min-h-[64px] resize-none overflow-hidden text-[12.5px] py-2"
          placeholder="Observaciones de entrega, horarios de recepción, particularidades de la carga, precinto o contenedor…"
          hint={
            <span className="flex items-center justify-between text-[11px] text-zinc-400">
              <span>Contexto de la carga, contenedor o precinto</span>
              <span
                className={`tabular-nums ${
                  noteValue.length > 3800 ? "text-brand-red font-medium" : ""
                }`}
              >
                {noteValue.length} / 4000
              </span>
            </span>
          }
          error={errors.note?.message}
          name={noteField.name}
          onBlur={noteField.onBlur}
          onChange={(event) => {
            noteField.onChange(event);
            autoResizeTextarea(event.target, 64);
          }}
          ref={(element) => {
            noteField.ref(element);
            noteTextareaRef.current = element;
            autoResizeTextarea(element, 64);
          }}
        />
        </div>
      </div>
    );
  };

  // Paso 3: Puntos de Seguridad a Evaluar
  const renderStep3 = () => (
    <div className="flex flex-col gap-3.5 animate-plf-fade">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <FormDivider title="Puntos de seguridad a evaluar (PF-FOR-291)" />
        <div className="flex items-center gap-2 shrink-0">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => {
              setChecks({
                1: "Negativo",
                2: "Negativo",
                3: "Negativo",
                4: "Negativo",
                5: "Negativo",
                6: "Negativo",
                7: "Negativo",
                8: "Negativo",
                9: "",
              });
            }}
          >
            Marcar todos como Negativo
          </Button>
        </div>
      </div>

      {/** TABLA DE PUNTOS DE SEGURIDAD */}
      <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-2xs">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-zinc-200 bg-zinc-50/90 text-[11px] font-heading font-bold uppercase tracking-wider text-zinc-500 select-none">
              <th className="py-2.5 pl-3 pr-2 w-10 text-center whitespace-nowrap">#</th>
              <th className="py-2.5 px-3 whitespace-nowrap">Puntos de Seguridad a Evaluar</th>
              <th className="py-2.5 px-2 w-28 text-center whitespace-nowrap">
                <span className="block text-[9px] text-zinc-400 font-normal lowercase tracking-normal">marcar X</span>
                <span className="text-brand-red">Positivo</span>
              </th>
              <th className="py-2.5 px-2 w-28 text-center whitespace-nowrap">
                <span className="block text-[9px] text-zinc-400 font-normal lowercase tracking-normal">marcar X</span>
                <span>Negativo</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 text-[12.5px]">
            {SECURITY_ITEMS.map((item) => {
              const isNinth = item.itemNumber === 9;
              const disabled = isNinth && !anyPositive;
              const currentVal = checks[item.itemNumber] || "";

              return (
                <tr
                  key={item.itemNumber}
                  className={`transition-colors ${
                    currentVal === "Positivo" && !isNinth
                      ? "bg-rose-50/50 hover:bg-rose-50/80"
                      : "hover:bg-zinc-50/70"
                  } ${disabled ? "opacity-45" : ""}`}
                >
                  <td
                    id={`security-num-${item.itemNumber}`}
                    aria-label={`Punto ${item.itemNumber}`}
                    className="py-2.5 pl-3 pr-2 text-center font-mono text-[11px] font-semibold text-zinc-400"
                  >
                    {item.itemNumber}
                  </td>
                  <td className="py-2.5 px-3 leading-relaxed text-zinc-800">
                    <p id={`security-item-${item.itemNumber}`}>{item.text}</p>
                    {isNinth && !anyPositive && (
                      <span className="mt-0.5 inline-block text-[11px] text-zinc-400 italic">
                        (Aplica únicamente cuando al menos un punto del 1 al 8 es Positivo)
                      </span>
                    )}
                  </td>
                  {/** Una sola elección por punto: grupo de radio con flechas,
                       como un radio nativo (Positivo y Negativo comparten foco). */}
                  <td colSpan={2} className="py-2 px-2">
                    <div
                      role="radiogroup"
                      aria-labelledby={`security-num-${item.itemNumber} security-item-${item.itemNumber}`}
                      aria-disabled={disabled || undefined}
                      className="grid grid-cols-2"
                    >
                      {(["Positivo", "Negativo"] as const).map((choice) => {
                        const checked = currentVal === choice;
                        const other = choice === "Positivo" ? "Negativo" : "Positivo";
                        const focusable = checked || (currentVal === "" && choice === "Positivo");
                        return (
                          <button
                            key={choice}
                            type="button"
                            role="radio"
                            aria-checked={checked}
                            data-choice={choice}
                            disabled={disabled}
                            tabIndex={focusable ? 0 : -1}
                            onClick={() => toggleCheck(item.itemNumber, choice)}
                            onKeyDown={(event) => {
                              if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) {
                                return;
                              }
                              event.preventDefault();
                              if (currentVal !== other) toggleCheck(item.itemNumber, other);
                              event.currentTarget.parentElement
                                ?.querySelector<HTMLButtonElement>(`[data-choice="${other}"]`)
                                ?.focus();
                            }}
                            className="group/radio mx-auto inline-flex cursor-pointer select-none items-center gap-1.5 rounded-edge px-1 py-0.5 outline-none focus-visible:ring-2 focus-visible:ring-brand-red/25 disabled:cursor-not-allowed disabled:opacity-35"
                          >
                            <span
                              aria-hidden
                              className={`flex size-7 items-center justify-center rounded-lg border-2 transition-all ${
                                checked
                                  ? choice === "Positivo"
                                    ? "border-brand-red bg-brand-red text-white"
                                    : "border-zinc-900 bg-zinc-900 text-white"
                                  : choice === "Positivo"
                                  ? "border-zinc-300 bg-white text-transparent group-hover/radio:border-brand-red/60 group-hover/radio:text-brand-red/40"
                                  : "border-zinc-300 bg-white text-transparent group-hover/radio:border-zinc-500 group-hover/radio:text-zinc-400"
                              }`}
                            >
                              <X className="size-3.5 stroke-[3]" />
                            </span>
                            <span
                              className={`text-[11px] font-medium ${
                                checked ? "text-ink" : "text-subtle"
                              }`}
                            >
                              {choice}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );

  // Footer izquierda (indicador de paso y atajo de teclado)
  const renderFooterLeft = () => (
    <>
      {step === 3 ? (
        <span className="hidden sm:inline-flex items-center gap-1 text-[11px] text-zinc-400 select-none">
          <kbd className="rounded border border-zinc-200 bg-zinc-100 px-1 py-0.5 text-[10px] font-mono text-zinc-500">
            Ctrl
          </kbd>
          <span>+</span>
          <kbd className="rounded border border-zinc-200 bg-zinc-100 px-1 py-0.5 text-[10px] font-mono text-zinc-500">
            Enter
          </kbd>
          <span className="ml-0.5">para finalizar</span>
        </span>
      ) : (
        <span className="text-[11.5px] text-zinc-400">
          Paso {step} de 3
        </span>
      )}
    </>
  );

  // Footer derecha (botones de navegación y guardado)
  const renderFooterButtons = () => (
    <div className="flex items-center gap-2 ml-auto">
      {step > 1 ? (
        <Button
          key="btn-prev-step"
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => {
            setStep((s) => (s - 1) as 1 | 2);
          }}
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          <span>Anterior</span>
        </Button>
      ) : (
        <Button
          key="btn-cancel-modal"
          type="button"
          variant="secondary"
          size="sm"
          onClick={requestClose}
        >
          Cancelar
        </Button>
      )}

      <EnterpriseFormSaveDraftButton
        visible={Boolean(draftStorageKey)}
        disabled={isSubmitting}
        onClick={() => setSaveDraftConfirmOpen(true)}
      />

      {step < 3 ? (
        <SubmitValidationButton
          key={`btn-next-step-${step}`}
          ready={discrepancyStepMissing.length === 0}
          busy={isSubmitting}
          missingItems={discrepancyStepMissing}
          onSubmit={() => void handleNextStep()}
          onInvalidClick={() => void invalidateDiscrepancyStep()}
          onFocusField={focusDiscrepancyField}
          blockTitle="No se puede continuar"
          hintText="Para avanzar, completa lo siguiente:"
          shortcutLabel={null}
        >
          <span>Siguiente paso</span>
          <ChevronRight className="h-3.5 w-3.5" />
        </SubmitValidationButton>
      ) : (
        <SubmitValidationButton
          key="btn-submit-discrepancy"
          formId="discrepancy-form"
          ready={discrepancyStepMissing.length === 0}
          busy={isSubmitting}
          missingItems={discrepancyStepMissing}
          onInvalidClick={() => void invalidateDiscrepancyStep()}
          onFocusField={focusDiscrepancyField}
          blockTitle="No se puede crear"
          hintText="Para registrar la investigación, completa lo siguiente:"
          shortcutLabel={null}
        >
          {isEdit ? "Guardar cambios" : "Crear investigación"}
        </SubmitValidationButton>
      )}
    </div>
  );

  const renderSaveDraftConfirmModal = () =>
    saveDraftConfirmOpen ? (
      <EnterpriseFormSaveDraftConfirmModal
        open
        formCode={DISCREPANCY_FORM_CONTROL.code}
        ticketLabel={ticketLabel?.split(" ")[0] ?? fixedTicketLabel?.split(" ")[0]}
        onClose={() => setSaveDraftConfirmOpen(false)}
        onConfirm={() => {
          handleSaveDraft();
          setSaveDraftConfirmOpen(false);
        }}
      />
    ) : null;

  const renderClosePromptModal = () => {
    if (!showClosePrompt || !completedDiscrepancy) return null;
    const currentTicketId = Number(getValues("ticketId") || ticketId);
    const taskNumberLabel = scopeDisplayCode ?? derivedTicketNumber ?? "Tarea";
    const recordNumber = completedDiscrepancy.discrepancy.number;

    if (formHostKind === "task" && hostTaskId) {
      return (
        <EnterpriseFormCompleteTaskModal
          open={showClosePrompt}
          taskId={hostTaskId}
          taskNumber={taskNumberLabel}
          formCode="PF-FOR-291"
          recordNumber={recordNumber}
          defaultComment={`Completada tras investigación de discrepancia ${recordNumber}`}
          onClose={() => finishModal(completedDiscrepancy)}
          onSuccess={() => onTicketStatusChanged?.()}
        />
      );
    }

    return (
      <EnterpriseFormCloseTicketModal
        open={showClosePrompt}
        ticketId={currentTicketId}
        formCode="PF-FOR-291"
        recordNumber={recordNumber}
        descriptionText="La investigación de discrepancia ha sido registrada exitosamente. Puedes dar por concluido y cerrar este ticket indicando el veredicto oficial y el comentario de resolución."
        defaultReason={`Cerrado tras completar investigación de discrepancia ${recordNumber}`}
        receiptDetail={`El ticket ha sido marcado como solucionado en base a ${recordNumber}.`}
        extraAlert={
          completedDiscrepancy.discrepancy.hasSecurityFinding ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50/70 p-3 text-xs text-amber-900 flex items-start gap-2">
              <AlertTriangle className="size-4 text-amber-600 shrink-0 mt-0.5" />
              <span>
                <strong>Atención:</strong> Esta discrepancia contiene un hallazgo de seguridad positivo reportado al área de Seguridad y Logística.
              </span>
            </div>
          ) : undefined
        }
        onClose={() => finishModal(completedDiscrepancy)}
        onSuccess={() => onTicketStatusChanged?.()}
        onTicketStatusChanged={onTicketStatusChanged}
      />
    );
  };

  // RENDER MODO PÁGINA (INLINE EN TAB)
  if (inline) {
    return (
      <div
        ref={inlineMotion.panelRef}
        className="rounded-xl border border-zinc-200 bg-white shadow-2xs overflow-hidden"
      >
        {/** Encabezado Editorial Limpio, Simétrico y Organizado */}
        <div className="border-b border-zinc-200/80 bg-white px-4 sm:px-6 py-3">
          <div className="flex items-center justify-between gap-4">
            {/** Lado Izquierdo: Botón volver + Identidad Estructurada */}
            <div className="flex items-center gap-3.5 min-w-0">
              <button
                type="button"
                onClick={requestClose}
                className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg border border-zinc-200 bg-zinc-50/60 text-zinc-600 shadow-2xs hover:bg-zinc-100 hover:text-zinc-900 transition-colors focus:outline-hidden cursor-pointer"
                title="Volver a formularios"
                aria-label="Volver a formularios"
              >
                <ArrowLeft className="size-4 text-zinc-600" />
              </button>

              <div className="flex flex-col min-w-0">
                <div className="flex items-center gap-2">
                  <span className="shrink-0 font-heading text-[10px] font-bold uppercase tracking-wider text-purple-700 bg-purple-50 border border-purple-200/90 px-1.5 py-0.5 rounded">
                    PF-FOR-291
                  </span>
                  <span className="text-xs font-heading font-medium text-zinc-500">
                    {step === 1
                      ? "Identificación y fecha de investigación"
                      : step === 2
                      ? "Líneas en discrepancia y nota operativa"
                      : "Evaluación de 9 puntos de seguridad"}
                  </span>
                </div>
                <h2 className="text-base sm:text-lg font-bold text-zinc-900 font-heading truncate leading-tight mt-0.5">
                  {isEdit ? `Editar ${discrepancy.number}` : "Investigación de Discrepancia de Cargas"}
                </h2>
              </div>
            </div>

            {/** Lado Derecho: Metadatos del Caso con balance visual y simetría */}
            {ticketLabel && (
              <div className="shrink-0 flex items-center gap-2 rounded-lg border border-zinc-200/90 bg-zinc-50/70 px-3 py-1.5 text-xs text-zinc-700 shadow-2xs">
                <span className="font-heading font-semibold text-zinc-500 text-xs">
                  Caso:
                </span>
                <span className="font-mono text-xs font-bold text-zinc-900">
                  {derivedTicketNumber || contextCodeLabel}
                </span>
                {effectiveTicketClientName && (
                  <>
                    <span className="text-zinc-300">·</span>
                    <span className="inline-flex items-center gap-1 text-xs text-zinc-600 font-medium truncate max-w-[180px] sm:max-w-[260px]">
                      <Building2 className="size-3 text-zinc-400 shrink-0" />
                      <span className="truncate">{effectiveTicketClientName}</span>
                    </span>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        {/** Stepper centrado en su propia barra limpia */}
        <div className="border-b border-zinc-100 bg-white py-3 px-4 sm:px-6">
          {renderStepper()}
        </div>

        {/** Cuerpo del formulario según el paso */}
        <div className="p-4 sm:p-6">
          <form
            id="discrepancy-form"
            onSubmit={handleSubmit(onSubmit)}
            noValidate
            className="flex flex-col gap-3 text-left"
          >
            {/** Paso 1: Reformulado con máxima simetría y balance editorial */}
            {step === 1 && (
              <div className="max-w-3xl mx-auto w-full py-3">
                {renderStep1()}
              </div>
            )}

            {/** Paso 2: Todo el ancho de la página para la tabla editorial */}
            {step === 2 && (
              <div className="w-full -mt-2 sm:-mt-4">
                {renderStep2()}
              </div>
            )}

            {/** Paso 3: Centrado de manera cómoda para los 9 puntos */}
            {step === 3 && (
              <div className="max-w-4xl mx-auto w-full py-2">
                {renderStep3()}
              </div>
            )}
          </form>
        </div>

        {/** Barra inferior de navegación y guardado */}
        <div className="border-t border-zinc-200/80 bg-zinc-50/70 px-5 sm:px-6 py-3.5 flex flex-wrap items-center justify-between gap-3">
          {renderFooterLeft()}
          {renderFooterButtons()}
        </div>
        {renderClosePromptModal()}
        {renderSaveDraftConfirmModal()}
      </div>
    );
  }

  // RENDER MODO MODAL
  return (
    <>
      <Modal
        closeOnBackdropClick={false}
        maxWidth={modalMaxWidth}
        eyebrow={
          isEdit
            ? `Investigación #${discrepancy.id} · ${discrepancy.number}`
            : "PF-FOR-291 · INVESTIGACIÓN DE DISCREPANCIA"
        }
        title={isEdit ? `Editar ${discrepancy.number}` : "Nueva investigación de discrepancia"}
        description={
          step === 1
            ? "Paso 1 de 3: Identificación del caso y fecha de investigación."
            : step === 2
            ? "Paso 2 de 3: Tabla de productos en discrepancia y notas operativas."
            : "Paso 3 de 3: Evaluación de los 9 puntos de seguridad de la carga."
        }
        onClose={onClose}
        isExiting={isExiting}
        onRequestClose={requestClose}
        footer={
          <div className="flex w-full items-center justify-between gap-3">
            {renderFooterLeft()}
            {renderFooterButtons()}
          </div>
        }
      >
        <div className="mb-4 -mt-2 border-b border-zinc-100 pb-3">
          {renderStepper()}
        </div>

        <form
          id="discrepancy-form"
          onSubmit={handleSubmit(onSubmit)}
          noValidate
          className="flex flex-col gap-3 text-left"
        >
          {step === 1 && renderStep1()}
          {step === 2 && <div className="-mt-2">{renderStep2()}</div>}
          {step === 3 && renderStep3()}
        </form>
      </Modal>
      {renderClosePromptModal()}
      {renderSaveDraftConfirmModal()}
    </>
  );
}

/** Ficha estructurada de línea en discrepancia con 2 filas organizadas (CERO SCROLL HORIZO... */
interface DiscrepancyLineCardProps {
  index: number;
  control: Control<FormValues>;
  register: UseFormRegister<FormValues>;
  setValue: UseFormSetValue<FormValues>;
  lineErrors: FieldErrors<LineValues> | undefined;
  existingLine?: any;
  ticketClientName?: string;
  ticketClientId?: number;
  ticketInheritedLabel: string;
  recommendedProductOptions: LookupOption[];
  ticketProductLabels: Map<string, string>;
  formHostKind?: "ticket" | "task";
  canRemove: boolean;
  onRemove: () => void;
}

function DiscrepancyLineCard({
  index,
  control,
  register,
  setValue,
  lineErrors,
  existingLine,
  ticketClientName,
  ticketClientId,
  ticketInheritedLabel,
  recommendedProductOptions,
  ticketProductLabels,
  formHostKind = "ticket",
  canRemove,
  onRemove,
}: DiscrepancyLineCardProps) {
  const productPickerId = useId();
  const discrepancyType = useWatch({ control, name: `lines.${index}.discrepancyType` }) ?? "faltante";
  const quantityValue = useWatch({ control, name: `lines.${index}.quantity` }) ?? "";
  const qtyNum = Number(quantityValue) || 0;
  const dispatcherMode = useWatch({ control, name: `lines.${index}.dispatcherMode` }) ?? "sistema";
  const dispatcherName = useWatch({ control, name: `lines.${index}.dispatcherName` }) ?? "";
  const supervisorMode = useWatch({ control, name: `lines.${index}.supervisorMode` }) ?? "sistema";
  const supervisorName = useWatch({ control, name: `lines.${index}.supervisorName` }) ?? "";

  const handleDispatcherModeChange = (newMode: "sistema" | "manual") => {
    if (newMode === dispatcherMode) return;
    setValue(`lines.${index}.dispatcherMode`, newMode, { shouldDirty: true });
    if (newMode === "manual") {
      setValue(`lines.${index}.dispatcherStaffId`, "", { shouldDirty: true });
    }
  };

  const handleSupervisorModeChange = (newMode: "sistema" | "manual") => {
    if (newMode === supervisorMode) return;
    setValue(`lines.${index}.supervisorMode`, newMode, { shouldDirty: true });
    if (newMode === "manual") {
      setValue(`lines.${index}.supervisorStaffId`, "", { shouldDirty: true });
    }
  };

  return (
    <div className="rounded-xl border border-zinc-200/90 bg-white shadow-2xs overflow-hidden transition-all hover:border-zinc-300">
      {/** Cabecera de la línea con número, estado de balance y acción quitar */}
      <div className="border-b border-zinc-100 bg-zinc-50/70 px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span className="flex size-5.5 items-center justify-center rounded-md bg-zinc-200/80 text-zinc-700 font-heading text-xs font-bold">
            {index + 1}
          </span>
          <span className="font-heading text-xs font-bold text-zinc-800">
            Línea #{index + 1}
          </span>
          {qtyNum > 0 ? (
            discrepancyType === "sobrante" ? (
              <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 border border-emerald-200/80 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                Sobrante: {qtyNum} und
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 border border-amber-200/80 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
                Faltante: {qtyNum} und
              </span>
            )
          ) : (
            <span className="text-[11px] text-zinc-400">
              (Indica la cantidad de {discrepancyType})
            </span>
          )}
        </div>

        {canRemove && (
          <button
            type="button"
            onClick={onRemove}
            className="inline-flex items-center gap-1 text-[11.5px] font-medium text-zinc-400 hover:text-brand-red px-2 py-1 rounded hover:bg-rose-50 transition-colors cursor-pointer"
            title={`Quitar línea ${index + 1}`}
          >
            <Trash2 className="size-3.5" />
            <span>Quitar línea</span>
          </button>
        )}
      </div>

      {/** Cuerpo en 2 sub-filas 100% responsivas sin scroll */}
      <div className="p-3.5 sm:p-4 flex flex-col gap-3">
        {/** Fila 1: Documentos & Producto (12 columnas) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 items-start">
          {/** 1. # Reclamo */}
          <div className="lg:col-span-2">
            <TextField
              size="sm"
              label="# Reclamo"
              placeholder={formHostKind === "task" ? "El de la tarea" : "El del ticket"}
              error={lineErrors?.claimRef?.message}
              {...register(`lines.${index}.claimRef`)}
            />
          </div>

          {/** 2. Factura * */}
          <div className="lg:col-span-2">
            <TextField
              size="sm"
              label="Factura"
              required
              placeholder="B1500000123"
              error={lineErrors?.invoiceRef?.message}
              {...register(`lines.${index}.invoiceRef`)}
            />
          </div>

          {/** 3. Cliente */}
          <div className="lg:col-span-3">
            <Controller
              name={`lines.${index}.clientId`}
              control={control}
              render={({ field: clientField }) => {
                const isTicketClient =
                  clientField.value === "" ||
                  (ticketClientId !== undefined && clientField.value === String(ticketClientId));

                const selectedLabel = isTicketClient
                  ? ticketClientName || undefined
                  : existingLine?.clientName && clientField.value === String(existingLine.clientId)
                  ? existingLine.clientName
                  : undefined;

                return (
                  <LookupField
                    size="sm"
                    label="Cliente"
                    name={clientField.name}
                    value={clientField.value}
                    selectedLabel={selectedLabel}
                    onChange={(value) => clientField.onChange(value)}
                    onBlur={clientField.onBlur}
                    placeholder={ticketInheritedLabel}
                    searchPlaceholder="Buscar cliente…"
                    clearLabel={ticketInheritedLabel}
                    search={searchClients}
                    resolveSelectedLabel={resolveClientLabel}
                    error={lineErrors?.clientId?.message}
                  />
                );
              }}
            />
          </div>

          {/** 4. Producto * */}
          <div className="lg:col-span-5">
            <Controller
              name={`lines.${index}.productId`}
              control={control}
              render={({ field: productField }) => (
                <LookupField
                  size="sm"
                  label="Producto"
                  required
                  id={productPickerId}
                  value={productField.value}
                  selectedLabel={ticketProductLabels.get(productField.value)}
                  onChange={(value) => productField.onChange(value)}
                  onBlur={productField.onBlur}
                  placeholder="Buscar producto…"
                  searchPlaceholder="Código o descripción…"
                  search={searchProducts}
                  recommendedOptions={recommendedProductOptions}
                  resolveSelectedLabel={resolveProductLabel}
                  error={lineErrors?.productId?.message}
                />
              )}
            />
          </div>
        </div>

        {/** Fila 2: Problemática, Cantidad, Nota de Crédito y Personal (12 columnas) */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-12 gap-3 items-start pt-2 border-t border-zinc-100/90">
          {/** 5. Problemática (Faltante / Sobrante) */}
          <div className="lg:col-span-2">
            <Controller
              name={`lines.${index}.discrepancyType`}
              control={control}
              render={({ field }) => (
                <SelectField
                  size="sm"
                  label="Problemática"
                  required
                  name={field.name}
                  value={field.value}
                  onChange={(val) => {
                    field.onChange(val);
                    if (val === "sobrante") {
                      setValue(`lines.${index}.qualifies`, "no");
                      setValue(`lines.${index}.creditNoteNumber`, "");
                    }
                  }}
                  onBlur={field.onBlur}
                  options={DISCREPANCY_TYPE_OPTIONS}
                  error={lineErrors?.discrepancyType?.message}
                />
              )}
            />
          </div>

          {/** 6. Cantidad */}
          <div className="lg:col-span-2">
            <TextField
              size="sm"
              label="Cantidad"
              required
              type="number"
              min="1"
              step="1"
              inputMode="numeric"
              className="text-center font-mono"
              placeholder="0"
              error={lineErrors?.quantity?.message}
              {...register(`lines.${index}.quantity`)}
            />
          </div>

          {/** 7. ¿Cumple para N/C? */}
          <div className="lg:col-span-2">
            <Controller
              name={`lines.${index}.qualifies`}
              control={control}
              render={({ field: qualifiesField }) => (
                <SelectField
                  size="sm"
                  label="¿Cumple N/C?"
                  name={qualifiesField.name}
                  value={qualifiesField.value}
                  onChange={(val) => {
                    qualifiesField.onChange(val);
                    if (val !== "si") {
                      setValue(`lines.${index}.creditNoteNumber`, "");
                    }
                  }}
                  onBlur={qualifiesField.onBlur}
                  options={QUALIFIES_OPTIONS}
                  error={lineErrors?.qualifies?.message}
                />
              )}
            />
          </div>

          {/** 8. # N/C */}
          <div className="lg:col-span-2">
            <Controller
              name={`lines.${index}.qualifies`}
              control={control}
              render={({ field: qualifiesField }) => {
                const isQualifies = qualifiesField.value === "si";
                return (
                  <TextField
                    size="sm"
                    label="# N/C"
                    disabled={!isQualifies}
                    placeholder={isQualifies ? "NC-00124" : "Si cumple N/C"}
                    error={lineErrors?.creditNoteNumber?.message}
                    {...register(`lines.${index}.creditNoteNumber`)}
                  />
                );
              }}
            />
          </div>

          {/** 9. Despachador * */}
          <div className="lg:col-span-2 flex flex-col gap-1.5">
            <label
              htmlFor={
                dispatcherMode === "sistema"
                  ? `lines.${index}.dispatcherSelect`
                  : `lines.${index}.dispatcherName`
              }
              className="font-heading text-[11.5px] font-semibold text-faint flex items-center"
            >
              <span>Despachador</span>
              <span className="ml-1 text-brand-red">*</span>
            </label>

            {dispatcherMode === "sistema" ? (
              <Controller
                name={`lines.${index}.dispatcherStaffId`}
                control={control}
                render={({ field: staffField }) => (
                  <LookupSelect
                    size="sm"
                    id={`lines.${index}.dispatcherSelect`}
                    value={staffField.value || ""}
                    selectedLabel={dispatcherName || undefined}
                    onChange={(value, option) => {
                      staffField.onChange(value);
                      setValue(
                        `lines.${index}.dispatcherName`,
                        option ? option.label : "",
                        {
                          shouldValidate: true,
                          shouldDirty: true,
                        },
                      );
                    }}
                    onBlur={staffField.onBlur}
                    placeholder="Buscar usuario…"
                    searchPlaceholder="Buscar por nombre o correo…"
                    search={searchActiveStaff}
                    resolveSelectedLabel={resolveStaffLabel}
                    clearLabel="Quitar despachador"
                    state={lineErrors?.dispatcherName ? "error" : "idle"}
                    rightAction={
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDispatcherModeChange("manual");
                        }}
                        tabIndex={-1}
                        title="Escribir nombre manualmente"
                        aria-label="Escribir nombre manualmente"
                        className="flex h-5.5 w-5.5 items-center justify-center rounded text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition-colors cursor-pointer"
                      >
                        <PenLine className="h-3.5 w-3.5" />
                      </button>
                    }
                  />
                )}
              />
            ) : (
              <div className="relative">
                <ControlInput
                  size="sm"
                  id={`lines.${index}.dispatcherName`}
                  placeholder="Nombre despachador"
                  state={lineErrors?.dispatcherName ? "error" : "idle"}
                  className="w-full pr-8"
                  {...register(`lines.${index}.dispatcherName`)}
                />
                <button
                  type="button"
                  onClick={() => handleDispatcherModeChange("sistema")}
                  tabIndex={-1}
                  title="Buscar usuario en el sistema"
                  aria-label="Buscar usuario en el sistema"
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 flex h-5.5 w-5.5 items-center justify-center rounded text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition-colors cursor-pointer"
                >
                  <Users className="h-3.5 w-3.5" />
                </button>
              </div>
            )}

            {lineErrors?.dispatcherName?.message && (
              <p
                id={`lines.${index}.dispatcherName-error`}
                title={lineErrors.dispatcherName.message}
                className="animate-plf-shake flex items-center gap-1.5 text-[11px] font-medium text-brand-red-dark leading-none truncate"
              >
                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">
                  {lineErrors.dispatcherName.message}
                </span>
              </p>
            )}
          </div>

          {/** 10. Supervisor */}
          <div className="lg:col-span-2 flex flex-col gap-1.5">
            <label
              htmlFor={
                supervisorMode === "sistema"
                  ? `lines.${index}.supervisorSelect`
                  : `lines.${index}.supervisorName`
              }
              className="font-heading text-[11.5px] font-semibold text-faint flex items-center justify-between"
            >
              <span>Supervisor</span>
              <span className="text-[10px] text-zinc-400 font-normal">Opcional</span>
            </label>

            {supervisorMode === "sistema" ? (
              <Controller
                name={`lines.${index}.supervisorStaffId`}
                control={control}
                render={({ field: staffField }) => (
                  <LookupSelect
                    size="sm"
                    id={`lines.${index}.supervisorSelect`}
                    value={staffField.value || ""}
                    selectedLabel={supervisorName || undefined}
                    onChange={(value, option) => {
                      staffField.onChange(value);
                      setValue(
                        `lines.${index}.supervisorName`,
                        option ? option.label : "",
                        {
                          shouldValidate: true,
                          shouldDirty: true,
                        },
                      );
                    }}
                    onBlur={staffField.onBlur}
                    placeholder="Buscar supervisor…"
                    searchPlaceholder="Buscar por nombre o correo…"
                    search={searchActiveStaff}
                    resolveSelectedLabel={resolveStaffLabel}
                    clearLabel="Quitar supervisor"
                    state={lineErrors?.supervisorName ? "error" : "idle"}
                    rightAction={
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSupervisorModeChange("manual");
                        }}
                        tabIndex={-1}
                        title="Escribir nombre manualmente"
                        aria-label="Escribir nombre manualmente"
                        className="flex h-5.5 w-5.5 items-center justify-center rounded text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition-colors cursor-pointer"
                      >
                        <PenLine className="h-3.5 w-3.5" />
                      </button>
                    }
                  />
                )}
              />
            ) : (
              <div className="relative">
                <ControlInput
                  size="sm"
                  id={`lines.${index}.supervisorName`}
                  placeholder="Nombre supervisor"
                  state={lineErrors?.supervisorName ? "error" : "idle"}
                  className="w-full pr-8"
                  {...register(`lines.${index}.supervisorName`)}
                />
                <button
                  type="button"
                  onClick={() => handleSupervisorModeChange("sistema")}
                  tabIndex={-1}
                  title="Buscar usuario en el sistema"
                  aria-label="Buscar usuario en el sistema"
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 flex h-5.5 w-5.5 items-center justify-center rounded text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition-colors cursor-pointer"
                >
                  <Users className="h-3.5 w-3.5" />
                </button>
              </div>
            )}

            {lineErrors?.supervisorName?.message && (
              <p
                id={`lines.${index}.supervisorName-error`}
                title={lineErrors.supervisorName.message}
                className="animate-plf-shake flex items-center gap-1.5 text-[11px] font-medium text-brand-red-dark leading-none truncate"
              >
                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">
                  {lineErrors.supervisorName.message}
                </span>
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
