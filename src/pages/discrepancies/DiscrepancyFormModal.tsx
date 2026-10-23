import { zodResolver } from "@hookform/resolvers/zod";
import {
  AlertTriangle,
  ArrowLeft,
  Building2,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Info,
  Plus,
  Trash2,
  Truck,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
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
import { ticketVerdictsApi } from "../../api/ticketVerdicts";
import { Button } from "../../components/ui/Button";
import {
  DateField,
  LookupField,
  SelectField,
  TextAreaField,
  TextField,
  type FieldState,
} from "../../components/ui/Field";
import { Modal } from "../../components/ui/Modal";
import { useReceipts } from "../../context/useReceipts";
import { useDialogMotion } from "../../hooks/useDialogMotion";
import { useModalAnimation } from "../../hooks/useModalAnimation";
import {
  cacheTicketInfo,
  getCachedTicketInfo,
  resolveTicketLabel,
  searchTickets,
  toNumber,
} from "../../lib/discrepancies";
import {
  resolveClientLabel,
  resolveProductLabel,
  searchClients,
  searchProducts,
} from "../../lib/lookups";
import { today } from "../../lib/quality";
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
    dispatcherName: z
      .string()
      .trim()
      .min(3, "Escribe el despachador: al menos 3 caracteres")
      .max(160, "Máximo 160 caracteres"),
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
  dispatcherName: "",
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
  /** Si es true, se renderiza como una página completa dentro de la pestaña en vez de una ventana emergente modal */
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

/**
 * Formulario de Investigación de Discrepancia de Carga (PF-FOR-291)
 * Reestructurado en 3 pasos con diseño editorial y simetría perfecta:
 * 1. Identificación y Origen (Ticket + Fecha de despacho)
 * 2. Tabla editorial de Líneas en discrepancia + Nota operativa
 * 3. Checklist de Puntos de Seguridad (Positivo / Negativo con 'X')
 */
export function DiscrepancyFormModal({
  discrepancy,
  ticketId,
  fixedTicketLabel,
  ticketClientName,
  ticketClientId,
  ticketStatus,
  onTicketStatusChanged,
  initialData,
  onClose,
  onSaved,
  inline = false,
}: DiscrepancyFormModalProps) {
  const isEdit = discrepancy !== undefined;
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const receipts = useReceipts();

  // Almacena el resultado para entregarlo a onSaved cuando termine la animación de salida
  const savedResultRef = useRef<DiscrepancyDetail | null>(null);

  // Modal para preguntar si desea cerrar el ticket al completar la investigación
  const [showClosePrompt, setShowClosePrompt] = useState(false);
  const [completedDiscrepancy, setCompletedDiscrepancy] = useState<DiscrepancyDetail | null>(null);
  const [closingTicket, setClosingTicket] = useState(false);
  const [verdicts, setVerdicts] = useState<Array<{ id: number; name: string }>>([]);
  const [selectedVerdictId, setSelectedVerdictId] = useState<string>("");
  const [closeReason, setCloseReason] = useState<string>("");

  useEffect(() => {
    if (showClosePrompt && completedDiscrepancy) {
      setCloseReason(
        `Cerrado tras completar investigación de discrepancia ${completedDiscrepancy.discrepancy.number}`
      );
      ticketVerdictsApi
        .list({ page: 1, pageSize: 100, status: "activos" })
        .then((res) => {
          const activeVerdicts = res.items.map((v) => ({ id: v.id, name: v.name }));
          setVerdicts(activeVerdicts);
          if (activeVerdicts.length > 0) {
            setSelectedVerdictId(String(activeVerdicts[0].id));
          }
        })
        .catch(() => setVerdicts([]));
    }
  }, [showClosePrompt, completedDiscrepancy]);

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

  // Derivar número de ticket para autocompletar # Reclamo
  const derivedTicketNumber =
    discrepancy?.ticketNumber ||
    (ticketLabel ? ticketLabel.split(" ")[0].trim() : "");

  // Caché inmediata
  if (initialTicketId && initialTicketLabel) {
    cacheTicketInfo(initialTicketId, initialTicketLabel, initialClientName, initialClientId);
  }

  // Consulta en segundo plano si falta el cliente
  useEffect(() => {
    if (initialTicketId && !effectiveTicketClientName) {
      ticketsApi
        .getById(initialTicketId)
        .then((t) => {
          const label = `${t.number} · ${t.subject}`;
          setTicketLabel(label);
          cacheTicketInfo(t.id, label, t.clientName, t.clientId);
          if (t.clientName) setEffectiveTicketClientName(t.clientName);
          if (t.clientId) setEffectiveTicketClientId(t.clientId);
        })
        .catch(() => {});
    }
  }, [initialTicketId, effectiveTicketClientName]);

  const defaultClientIdForLines = initialClientId ? String(initialClientId) : "";

  // React Hook Form
  const {
    control,
    register,
    handleSubmit,
    setValue,
    getValues,
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
                dispatcherName: line.dispatcherName,
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
          : [emptyLine(defaultClientIdForLines, derivedTicketNumber)],
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: "lines" });
  const noteValue = useWatch({ control, name: "note" }) ?? "";
  const ticketIdValue = useWatch({ control, name: "ticketId" }) ?? "";

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

  // Navegación entre pasos con validación
  async function handleNextStep() {
    if (step === 1) {
      const validTicket = await trigger("ticketId");
      if (!validTicket || !ticketIdValue) {
        receipts.failed({
          action: "ticket-requerido",
          title: "Ticket no seleccionado",
          detail: "Por favor selecciona un ticket para continuar con la investigación.",
        });
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
        receipts.failed({
          action: "lineas-incompletas",
          title: "Campos obligatorios requeridos",
          detail: "Revisa las líneas en discrepancia. Completa los campos obligatorios marcados.",
        });
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
        dispatcherStaffId: null,
        supervisorName: blank(line.supervisorName),
        supervisorStaffId: null,
      })),
      checks: checksPayload,
    };

    try {
      const saved = isEdit
        ? await discrepanciesApi.update(discrepancy.id, request)
        : await discrepanciesApi.create(Number(values.ticketId), request);
      receipts.done({
        action: "guardar-discrepancia",
        title: isEdit ? "Investigación actualizada" : "Investigación creada",
        detail: `PF-FOR-291 · ${saved.discrepancy.number}`,
      });

      const isAlreadyClosed =
        ticketStatus === "Solucionado" ||
        ticketStatus === "Cancelado";

      const effectiveTicketId = Number(values.ticketId || ticketId);

      if (!isAlreadyClosed && effectiveTicketId > 0) {
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

  // Dinamismo de ancho para modal: amplio para la tabla editorial sin apretar columnas ni saltos bruscos
  const modalMaxWidth =
    step === 1 ? "max-w-2xl" : "max-w-[96vw] 2xl:max-w-[1720px] w-full";

  const ticketInheritedLabel = effectiveTicketClientName
    ? effectiveTicketClientName
    : "Buscar cliente…";

  // Stepper Header
  const renderStepper = () => (
    <div className="flex w-full items-center justify-between max-w-lg mx-auto select-none">
      {/* Paso 1 */}
      <button
        type="button"
        onClick={() => setStep(1)}
        className="flex items-center gap-2 cursor-pointer focus:outline-hidden group"
      >
        <span
          className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold transition-all ${
            step === 1
              ? "bg-brand-red text-white shadow-2xs ring-2 ring-brand-red/20"
              : step > 1
              ? "bg-emerald-600 text-white"
              : "bg-zinc-200 text-zinc-600 group-hover:bg-zinc-300"
          }`}
        >
          {step > 1 ? <Check className="h-3.5 w-3.5" /> : "1"}
        </span>
        <div className="flex flex-col text-left">
          <span
            className={`text-[12px] font-heading font-semibold transition-colors ${
              step === 1 ? "text-zinc-900" : step > 1 ? "text-zinc-700" : "text-zinc-400"
            }`}
          >
            Origen y Despacho
          </span>
          <span className="text-[10px] text-zinc-400 hidden sm:inline">Ticket y fecha</span>
        </div>
      </button>

      <div
        className={`h-0.5 flex-1 mx-3 rounded-full transition-colors ${
          step > 1 ? "bg-emerald-600/40" : "bg-zinc-200"
        }`}
      />

      {/* Paso 2 */}
      <button
        type="button"
        onClick={() => {
          if (ticketIdValue) setStep(2);
        }}
        disabled={!ticketIdValue}
        className="flex items-center gap-2 cursor-pointer disabled:cursor-not-allowed focus:outline-hidden group"
      >
        <span
          className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold transition-all ${
            step === 2
              ? "bg-brand-red text-white shadow-2xs ring-2 ring-brand-red/20"
              : step > 2
              ? "bg-emerald-600 text-white"
              : "bg-zinc-200 text-zinc-600 group-hover:bg-zinc-300"
          }`}
        >
          {step > 2 ? <Check className="h-3.5 w-3.5" /> : "2"}
        </span>
        <div className="flex flex-col text-left">
          <span
            className={`text-[12px] font-heading font-semibold transition-colors ${
              step === 2 ? "text-zinc-900" : step > 2 ? "text-zinc-700" : "text-zinc-400"
            }`}
          >
            Líneas y Detalle
          </span>
          <span className="text-[10px] text-zinc-400 hidden sm:inline">Productos y nota</span>
        </div>
      </button>

      <div
        className={`h-0.5 flex-1 mx-3 rounded-full transition-colors ${
          step > 2 ? "bg-emerald-600/40" : "bg-zinc-200"
        }`}
      />

      {/* Paso 3 */}
      <button
        type="button"
        onClick={() => {
          if (ticketIdValue && fields.length > 0) setStep(3);
        }}
        disabled={!ticketIdValue || fields.length === 0}
        className="flex items-center gap-2 cursor-pointer disabled:cursor-not-allowed focus:outline-hidden group"
      >
        <span
          className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold transition-all ${
            step === 3
              ? "bg-brand-red text-white shadow-2xs ring-2 ring-brand-red/20"
              : "bg-zinc-200 text-zinc-600 group-hover:bg-zinc-300"
          }`}
        >
          3
        </span>
        <div className="flex flex-col text-left">
          <span
            className={`text-[12px] font-heading font-semibold transition-colors ${
              step === 3 ? "text-zinc-900" : "text-zinc-400"
            }`}
          >
            Puntos de Seguridad
          </span>
          <span className="text-[10px] text-zinc-400 hidden sm:inline">9 puntos de control</span>
        </div>
      </button>
    </div>
  );

  // Paso 1: Origen e Identificación (Diseño Editorial Simétrico de 2 Columnas)
  const renderStep1 = () => (
    <div className="flex flex-col gap-5 animate-plf-fade">
      {/* Grilla simétrica de 2 paneles principales */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-stretch">
        {/* Panel 1 (Izquierda): Identificación del Caso & Ticket */}
        <div className="flex flex-col justify-between rounded-xl border border-zinc-200/90 bg-white shadow-2xs overflow-hidden">
          {/* Cabecera del panel */}
          <div className="border-b border-zinc-100 bg-zinc-50/70 px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="flex size-6 items-center justify-center rounded-md bg-zinc-200/60 text-zinc-700 font-heading text-xs font-bold">
                1
              </span>
              <h3 className="font-heading text-xs font-bold uppercase tracking-wider text-zinc-800">
                Identificación del Caso
              </h3>
            </div>
            <span className="font-heading text-[10.5px] font-bold uppercase tracking-wider text-purple-700 bg-purple-50 border border-purple-200/80 px-2 py-0.5 rounded-md">
              PF-FOR-291
            </span>
          </div>

          {/* Cuerpo del panel */}
          <div className="p-4 sm:p-5 flex-1 flex flex-col gap-4">
            <Controller
              name="ticketId"
              control={control}
              render={({ field }) => (
                <LookupField
                  size="sm"
                  label="Ticket vinculado"
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

            {/* Ficha sintética del ticket seleccionado */}
            {ticketLabel ? (
              <div className="rounded-lg border border-zinc-200/80 bg-zinc-50/50 p-3.5 space-y-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex flex-col min-w-0">
                    <span className="text-[10px] font-heading font-bold uppercase tracking-wider text-zinc-400">
                      Asunto del caso
                    </span>
                    <span className="text-xs font-semibold text-zinc-900 mt-0.5 line-clamp-2" title={ticketLabel}>
                      {ticketLabel}
                    </span>
                  </div>
                </div>

                {effectiveTicketClientName && (
                  <div className="pt-2 border-t border-zinc-200/60 flex items-center justify-between text-xs">
                    <span className="text-zinc-500 font-medium flex items-center gap-1.5">
                      <Building2 className="size-3.5 text-zinc-400" />
                      <span>Cliente</span>
                    </span>
                    <span className="font-semibold text-zinc-800 truncate max-w-[220px]">
                      {effectiveTicketClientName}
                    </span>
                  </div>
                )}
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-zinc-200 bg-zinc-50/30 p-4 text-center">
                <p className="text-xs text-zinc-400">
                  Selecciona un ticket para vincular automáticamente los datos del cliente y reclamo.
                </p>
              </div>
            )}
          </div>

          {/* Pie informativo del panel */}
          <div className="bg-zinc-50/50 px-4 py-2.5 border-t border-zinc-100 text-[11px] text-zinc-400 flex items-center gap-1.5">
            <Info className="size-3.5 shrink-0 text-zinc-400" />
            <span>Documenta diferencias entre la carga facturada y la despachada.</span>
          </div>
        </div>

        {/* Panel 2 (Derecha): Fecha de Despacho & Parámetros Operativos */}
        <div className="flex flex-col justify-between rounded-xl border border-zinc-200/90 bg-white shadow-2xs overflow-hidden">
          {/* Cabecera del panel */}
          <div className="border-b border-zinc-100 bg-zinc-50/70 px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="flex size-6 items-center justify-center rounded-md bg-zinc-200/60 text-zinc-700 font-heading text-xs font-bold">
                2
              </span>
              <h3 className="font-heading text-xs font-bold uppercase tracking-wider text-zinc-800">
                Fecha del Despacho y Registro
              </h3>
            </div>
            <span className="font-heading text-[10.5px] font-medium uppercase tracking-wider text-zinc-400">
              Control Operativo
            </span>
          </div>

          {/* Cuerpo del panel */}
          <div className="p-4 sm:p-5 flex-1 flex flex-col gap-4">
            <DateField
              label="Fecha del despacho"
              required
              value={discrepancyDate}
              onChange={setDiscrepancyDate}
              placeholder="Seleccionar fecha…"
              headerLabel="Fecha del despacho"
              align="end"
            />

            {/* Pauta operativa */}
            <div className="rounded-lg border border-zinc-200/80 bg-zinc-50/50 p-3.5 space-y-2">
              <span className="text-[10px] font-heading font-bold uppercase tracking-wider text-zinc-400 block">
                Criterios de verificación inicial
              </span>
              <ul className="text-xs text-zinc-600 space-y-1.5 leading-relaxed">
                <li className="flex items-start gap-2">
                  <span className="size-1.5 rounded-full bg-brand-red mt-1.5 shrink-0" />
                  <span>Verificar concordancia con la factura y conduce de salida.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="size-1.5 rounded-full bg-brand-red mt-1.5 shrink-0" />
                  <span>En el siguiente paso se registrarán los productos sobrantes o faltantes.</span>
                </li>
              </ul>
            </div>
          </div>

          {/* Pie informativo del panel */}
          <div className="bg-zinc-50/50 px-4 py-2.5 border-t border-zinc-100 text-[11px] text-zinc-400 flex items-center gap-1.5">
            <Truck className="size-3.5 shrink-0 text-zinc-400" />
            <span>Fecha oficial para trazabilidad de precinto y contenedor.</span>
          </div>
        </div>
      </div>

      {/* Banner de Flujo de Investigación (3 Fases) */}
      <div className="rounded-xl border border-zinc-200/80 bg-zinc-50/60 p-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <span className="font-heading font-bold text-zinc-900 text-xs">
              Estructura Oficial del Formato:
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-zinc-500">
            <span className="inline-flex items-center gap-1 font-semibold text-zinc-800">
              <span className="flex size-4 items-center justify-center rounded-full bg-emerald-600 text-white text-[9px] font-bold">1</span>
              Origen y Ticket
            </span>
            <span className="text-zinc-300">→</span>
            <span className="inline-flex items-center gap-1 font-medium text-zinc-600">
              <span className="flex size-4 items-center justify-center rounded-full bg-zinc-200 text-zinc-700 text-[9px] font-bold">2</span>
              Líneas en Discrepancia
            </span>
            <span className="text-zinc-300">→</span>
            <span className="inline-flex items-center gap-1 font-medium text-zinc-600">
              <span className="flex size-4 items-center justify-center rounded-full bg-zinc-200 text-zinc-700 text-[9px] font-bold">3</span>
              9 Puntos de Seguridad
            </span>
          </div>
        </div>
      </div>
    </div>
  );

  // Paso 2: Líneas en Discrepancia y Nota Operativa (Diseño en Fichas Estructuradas sin Scroll)
  const renderStep2 = () => (
    <div className="flex flex-col gap-4 animate-plf-fade">
      <div className="flex items-center justify-between">
        <FormDivider title="Líneas en discrepancia (Formato PF-FOR-291)" />
        <span className="text-xs font-medium text-zinc-400 select-none">
          {fields.length} {fields.length === 1 ? "línea registrada" : "líneas registradas"}
        </span>
      </div>

      {/* Lista de Fichas de Líneas - 100% visible sin scroll horizontal */}
      <div className="flex flex-col gap-3.5">
        {fields.map((field, index) => {
          const lineErrors = errors.lines?.[index];
          const existingLine = discrepancy?.lines?.[index];

          return (
            <DiscrepancyLineCard
              key={field.id}
              index={index}
              control={control}
              register={register}
              setValue={setValue}
              lineErrors={lineErrors}
              existingLine={existingLine}
              ticketClientName={effectiveTicketClientName}
              ticketClientId={effectiveTicketClientId}
              ticketInheritedLabel={ticketInheritedLabel}
              canRemove={fields.length > 1}
              onRemove={() => remove(index)}
            />
          );
        })}
      </div>

      {/* Pie con botón agregar línea */}
      <div className="flex items-center justify-between pt-1">
        <Button
          type="button"
          size="sm"
          variant="secondary"
          onClick={() =>
            append(emptyLine(defaultClientIdForLines, derivedTicketNumber))
          }
        >
          <Plus className="h-3.5 w-3.5 text-zinc-500" />
          <span>Agregar otra línea</span>
        </Button>
      </div>

      {/* SECCIÓN DE LA NOTA (según PF-FOR-291) */}
      <div className="mt-2 flex flex-col gap-1.5">
        <FormDivider title="Uso interno" />
        <TextAreaField
          id="discrepancy-notes"
          label="Notas operativas"
          rows={3}
          className="text-[12.5px] py-2"
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
          {...register("note")}
        />
      </div>
    </div>
  );

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

      {/* TABLA DE PUNTOS DE SEGURIDAD */}
      <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-2xs">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-zinc-200 bg-zinc-50/90 text-[11px] font-heading font-bold uppercase tracking-wider text-zinc-500 select-none">
              <th className="py-2.5 pl-3 pr-2 w-10 text-center whitespace-nowrap">#</th>
              <th className="py-2.5 px-3 whitespace-nowrap">Puntos de Seguridad a Evaluar</th>
              <th className="py-2.5 px-2 w-24 text-center whitespace-nowrap">
                <span className="block text-[9px] text-zinc-400 font-normal lowercase tracking-normal">marcar X</span>
                <span className="text-brand-red">Positivo</span>
              </th>
              <th className="py-2.5 px-2 w-24 text-center whitespace-nowrap">
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
                  <td className="py-2.5 pl-3 pr-2 text-center font-mono text-[11px] font-semibold text-zinc-400">
                    {item.itemNumber}
                  </td>
                  <td className="py-2.5 px-3 leading-relaxed text-zinc-800">
                    <p>{item.text}</p>
                    {isNinth && !anyPositive && (
                      <span className="mt-0.5 inline-block text-[11px] text-zinc-400 italic">
                        (Aplica únicamente cuando al menos un punto del 1 al 8 es Positivo)
                      </span>
                    )}
                  </td>
                  {/* Checkbox / Botón POSITIVO */}
                  <td className="py-2 px-2 text-center">
                    <button
                      type="button"
                      disabled={disabled}
                      onClick={() => toggleCheck(item.itemNumber, "Positivo")}
                      className={`mx-auto flex size-7 items-center justify-center rounded-lg border-2 transition-all cursor-pointer select-none disabled:opacity-35 disabled:cursor-not-allowed ${
                        currentVal === "Positivo"
                          ? "border-brand-red bg-brand-red text-white"
                          : "border-zinc-300 bg-white text-transparent hover:border-brand-red/60 hover:text-brand-red/40"
                      }`}
                      title={`Marcar punto ${item.itemNumber} como Positivo`}
                    >
                      <X className="size-3.5 stroke-[3]" />
                    </button>
                  </td>
                  {/* Checkbox / Botón NEGATIVO */}
                  <td className="py-2 px-2 text-center">
                    <button
                      type="button"
                      disabled={disabled}
                      onClick={() => toggleCheck(item.itemNumber, "Negativo")}
                      className={`mx-auto flex size-7 items-center justify-center rounded-lg border-2 transition-all cursor-pointer select-none disabled:opacity-35 disabled:cursor-not-allowed ${
                        currentVal === "Negativo"
                          ? "border-zinc-900 bg-zinc-900 text-white"
                          : "border-zinc-300 bg-white text-transparent hover:border-zinc-500 hover:text-zinc-400"
                      }`}
                      title={`Marcar punto ${item.itemNumber} como Negativo`}
                    >
                      <X className="size-3.5 stroke-[3]" />
                    </button>
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

      {step < 3 ? (
        <Button
          key={`btn-next-step-${step}`}
          type="button"
          size="sm"
          onClick={handleNextStep}
        >
          <span>Siguiente paso</span>
          <ChevronRight className="h-3.5 w-3.5" />
        </Button>
      ) : (
        <Button
          key="btn-submit-discrepancy"
          type="submit"
          form="discrepancy-form"
          size="sm"
          isLoading={isSubmitting}
        >
          {isEdit ? "Guardar cambios" : "Crear investigación"}
        </Button>
      )}
    </div>
  );

  const renderClosePromptModal = () => {
    if (!showClosePrompt || !completedDiscrepancy) return null;
    return (
      <Modal
        title="¿Deseas cerrar este ticket ahora?"
        eyebrow="PF-FOR-291 · Resolución de Caso"
        onClose={() => finishModal(completedDiscrepancy)}
        maxWidth="max-w-md"
        closeOnBackdropClick={false}
        footer={
          <div className="flex items-center justify-end gap-2 w-full">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => finishModal(completedDiscrepancy)}
            >
              Mantener ticket abierto
            </Button>
            <Button
              type="button"
              variant="primary"
              size="sm"
              disabled={closingTicket}
              onClick={async () => {
                setClosingTicket(true);
                try {
                  const currentTicketId = Number(getValues("ticketId") || ticketId);
                  const finalVerdictId = selectedVerdictId
                    ? Number(selectedVerdictId)
                    : (verdicts.length > 0 ? verdicts[0].id : undefined);

                  await ticketsApi.updateStatus(currentTicketId, {
                    status: "Solucionado",
                    verdictId: finalVerdictId,
                    reason: closeReason.trim() || `Cerrado tras completar investigación de discrepancia ${completedDiscrepancy.discrepancy.number}`,
                  });
                  receipts.done({
                    action: "cerrar-ticket",
                    title: "Ticket cerrado y solucionado",
                    detail: `El ticket ha sido marcado como solucionado en base a ${completedDiscrepancy.discrepancy.number}.`,
                  });
                  onTicketStatusChanged?.();
                } catch (err) {
                  receipts.failed({
                    action: "error-cerrar-ticket",
                    title: "No se pudo cerrar el ticket",
                    detail: err instanceof ApiError ? err.message : "Error al actualizar estado del ticket",
                  });
                } finally {
                  setClosingTicket(false);
                  finishModal(completedDiscrepancy);
                }
              }}
            >
              <CheckCircle2 className="size-3.5 mr-1" />
              {closingTicket ? "Cerrando..." : "Sí, cerrar ticket"}
            </Button>
          </div>
        }
      >
        <div className="space-y-3.5 py-1 text-left">
          <div className="rounded-xl border border-zinc-200 bg-zinc-50/80 p-3.5">
            <p className="text-xs text-zinc-700 leading-relaxed">
              La investigación de discrepancia <strong className="font-semibold text-zinc-900 font-mono">{completedDiscrepancy.discrepancy.number}</strong> ha sido registrada exitosamente.
            </p>
            <p className="mt-1.5 text-xs text-zinc-500 leading-relaxed">
              Puedes dar por resuelto y cerrar este ticket indicando el veredicto oficial.
            </p>
          </div>

          {verdicts.length > 0 && (
            <SelectField
              size="sm"
              label="Veredicto de resolución"
              required
              value={selectedVerdictId}
              onChange={setSelectedVerdictId}
              options={verdicts.map((v) => ({
                value: String(v.id),
                label: v.name,
              }))}
            />
          )}

          <TextField
            size="sm"
            label="Comentario de cierre"
            required
            value={closeReason}
            onChange={(e) => setCloseReason(e.target.value)}
            placeholder="Motivo o comentario de resolución..."
          />

          {completedDiscrepancy.discrepancy.hasSecurityFinding && (
            <div className="rounded-lg border border-amber-200 bg-amber-50/70 p-3 text-xs text-amber-900 flex items-start gap-2">
              <AlertTriangle className="size-4 text-amber-600 shrink-0 mt-0.5" />
              <span>
                <strong>Atención:</strong> Esta discrepancia contiene un hallazgo de seguridad positivo reportado al área de Seguridad y Logística.
              </span>
            </div>
          )}
        </div>
      </Modal>
    );
  };

  // RENDER MODO PÁGINA (INLINE EN TAB)
  if (inline) {
    return (
      <div
        ref={inlineMotion.panelRef}
        className="rounded-xl border border-zinc-200 bg-white shadow-2xs overflow-hidden"
      >
        {/* Encabezado Editorial Limpio, Simétrico y Organizado */}
        <div className="border-b border-zinc-200/80 bg-white px-4 sm:px-6 py-3">
          <div className="flex items-center justify-between gap-4">
            {/* Lado Izquierdo: Botón volver + Identidad Estructurada */}
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
                      ? "Identificación y fecha de despacho"
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

            {/* Lado Derecho: Metadatos del Caso con balance visual y simetría */}
            {ticketLabel && (
              <div className="shrink-0 flex items-center gap-2 rounded-lg border border-zinc-200/90 bg-zinc-50/70 px-3 py-1.5 text-xs text-zinc-700 shadow-2xs">
                <span className="font-heading font-semibold text-zinc-500 text-xs">
                  Caso:
                </span>
                <span className="font-mono text-xs font-bold text-zinc-900">
                  {derivedTicketNumber || "Ticket"}
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

        {/* Stepper centrado en su propia barra limpia */}
        <div className="border-b border-zinc-100 bg-white py-3 px-4 sm:px-6">
          {renderStepper()}
        </div>

        {/* Cuerpo del formulario según el paso */}
        <div className="p-4 sm:p-6">
          <form
            id="discrepancy-form"
            onSubmit={handleSubmit(onSubmit)}
            noValidate
            className="flex flex-col gap-3 text-left"
          >
            {/* Paso 1: Reformulado con máxima simetría y balance editorial */}
            {step === 1 && (
              <div className="max-w-5xl mx-auto w-full py-2">
                {renderStep1()}
              </div>
            )}

            {/* Paso 2: Todo el ancho de la página para la tabla editorial */}
            {step === 2 && (
              <div className="w-full">
                {renderStep2()}
              </div>
            )}

            {/* Paso 3: Centrado de manera cómoda para los 9 puntos */}
            {step === 3 && (
              <div className="max-w-4xl mx-auto w-full py-2">
                {renderStep3()}
              </div>
            )}
          </form>
        </div>

        {/* Barra inferior de navegación y guardado */}
        <div className="border-t border-zinc-200/80 bg-zinc-50/70 px-5 sm:px-6 py-3.5 flex flex-wrap items-center justify-between gap-3">
          {renderFooterLeft()}
          {renderFooterButtons()}
        </div>
        {renderClosePromptModal()}
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
            ? "Paso 1 de 3: Identificación del caso y fecha de despacho."
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
          {step === 2 && renderStep2()}
          {step === 3 && renderStep3()}
        </form>
      </Modal>
      {renderClosePromptModal()}
    </>
  );
}

/** Ficha estructurada de línea en discrepancia con 2 filas organizadas (CERO SCROLL HORIZONTAL) */
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
  canRemove,
  onRemove,
}: DiscrepancyLineCardProps) {
  const discrepancyType = useWatch({ control, name: `lines.${index}.discrepancyType` }) ?? "faltante";
  const quantityValue = useWatch({ control, name: `lines.${index}.quantity` }) ?? "";
  const qtyNum = Number(quantityValue) || 0;

  return (
    <div className="rounded-xl border border-zinc-200/90 bg-white shadow-2xs overflow-hidden transition-all hover:border-zinc-300">
      {/* Cabecera de la línea con número, estado de balance y acción quitar */}
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

      {/* Cuerpo en 2 sub-filas 100% responsivas sin scroll */}
      <div className="p-3.5 sm:p-4 flex flex-col gap-3">
        {/* Fila 1: Documentos & Producto (12 columnas) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 items-start">
          {/* 1. # Reclamo */}
          <div className="lg:col-span-2">
            <TextField
              size="sm"
              label="# Reclamo"
              placeholder="El del ticket"
              error={lineErrors?.claimRef?.message}
              {...register(`lines.${index}.claimRef`)}
            />
          </div>

          {/* 2. Factura * */}
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

          {/* 3. Cliente */}
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

          {/* 4. Producto * */}
          <div className="lg:col-span-5">
            <Controller
              name={`lines.${index}.productId`}
              control={control}
              render={({ field: productField }) => (
                <LookupField
                  size="sm"
                  label="Producto"
                  required
                  name={productField.name}
                  value={productField.value}
                  onChange={(value) => productField.onChange(value)}
                  onBlur={productField.onBlur}
                  placeholder="Buscar producto…"
                  searchPlaceholder="Código o descripción…"
                  search={searchProducts}
                  resolveSelectedLabel={resolveProductLabel}
                  error={lineErrors?.productId?.message}
                />
              )}
            />
          </div>
        </div>

        {/* Fila 2: Problemática, Cantidad, Nota de Crédito y Personal (12 columnas) */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-12 gap-3 items-start pt-2 border-t border-zinc-100/90">
          {/* 5. Problemática (Faltante / Sobrante) */}
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

          {/* 6. Cantidad */}
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

          {/* 7. ¿Cumple para N/C? */}
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

          {/* 8. # N/C */}
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

          {/* 9. Despachador * */}
          <div className="lg:col-span-2">
            <TextField
              size="sm"
              label="Despachador"
              required
              placeholder="Nombre despachador"
              error={lineErrors?.dispatcherName?.message}
              {...register(`lines.${index}.dispatcherName`)}
            />
          </div>

          {/* 10. Supervisor */}
          <div className="lg:col-span-2">
            <TextField
              size="sm"
              label="Supervisor"
              placeholder="Supervisor (opcional)"
              error={lineErrors?.supervisorName?.message}
              {...register(`lines.${index}.supervisorName`)}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
