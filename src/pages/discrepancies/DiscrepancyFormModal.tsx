import { zodResolver } from "@hookform/resolvers/zod";
import {
  ArrowLeft,
  Building2,
  Check,
  ChevronLeft,
  ChevronRight,
  Plus,
  ShieldAlert,
  Trash2,
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
import { Alert } from "../../components/ui/Alert";
import { Button } from "../../components/ui/Button";
import {
  DateField,
  LookupField,
  TextAreaField,
  type FieldState,
} from "../../components/ui/Field";
import { LookupSelect } from "../../components/ui/LookupSelect";
import { Modal } from "../../components/ui/Modal";
import { Select } from "../../components/ui/Select";
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
    (value) => value === "" || (!Number.isNaN(Number(value)) && Number(value) >= 0),
    "Número de cero en adelante",
  )
  .refine(
    (value) => value === "" || Number((Number(value) * 100).toFixed(6)) % 1 === 0,
    "Hasta dos decimales",
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
    surplusQuantity: quantity,
    shortageQuantity: quantity,
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
    const surplus = toNumber(line.surplusQuantity);
    const shortage = toNumber(line.shortageQuantity);
    if (surplus > 0 && shortage > 0) {
      ctx.addIssue({
        code: "custom",
        path: ["shortageQuantity"],
        message: "Sobrante o faltante, no ambos",
      });
    }
    if (surplus === 0 && shortage === 0) {
      ctx.addIssue({
        code: "custom",
        path: ["shortageQuantity"],
        message: "Indica la cantidad faltante o sobrante",
      });
    }
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
  surplusQuantity: "",
  shortageQuantity: "",
  qualifies: "",
  creditNoteNumber: "",
  dispatcherName: "",
  supervisorName: "",
});

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
    <div className="flex items-center gap-2 pt-1 border-t border-zinc-100 first:border-0 first:pt-0">
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
  initialData,
  onClose,
  onSaved,
  inline = false,
}: DiscrepancyFormModalProps) {
  const isEdit = discrepancy !== undefined;
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [formError, setFormError] = useState<string | null>(null);

  // Almacena el resultado para entregarlo a onSaved cuando termine la animación de salida
  const savedResultRef = useRef<DiscrepancyDetail | null>(null);

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
          ? discrepancy.lines.map((line) => ({
              productId: String(line.productId),
              invoiceRef: line.invoiceRef,
              claimRef: line.claimRef || derivedTicketNumber || "",
              clientId: line.clientId ? String(line.clientId) : defaultClientIdForLines,
              surplusQuantity:
                line.surplusQuantity === 0 ? "" : String(line.surplusQuantity),
              shortageQuantity:
                line.shortageQuantity === 0 ? "" : String(line.shortageQuantity),
              qualifies:
                line.qualifiesForCreditNote === null
                  ? ""
                  : line.qualifiesForCreditNote
                  ? "si"
                  : "no",
              creditNoteNumber: line.creditNoteNumber ?? "",
              dispatcherName: line.dispatcherName,
              supervisorName: line.supervisorName ?? "",
            }))
          : initialData?.lines && initialData.lines.length > 0
          ? initialData.lines.map((l) => ({
              ...emptyLine(defaultClientIdForLines, derivedTicketNumber),
              productId: l.productId,
              invoiceRef: l.invoiceRef ?? "",
              clientId: l.clientId ?? defaultClientIdForLines,
              surplusQuantity: l.surplusQuantity ?? "",
              shortageQuantity: l.shortageQuantity ?? "",
            }))
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

    setChecks((prev) => {
      const current = prev[itemNumber];
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
    setFormError(null);
    if (step === 1) {
      const validTicket = await trigger("ticketId");
      if (!validTicket || !ticketIdValue) {
        setFormError("Por favor selecciona un ticket para continuar.");
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
        setFormError("Revisa las líneas en discrepancia. Completa los campos obligatorios marcados.");
        return;
      }
      setStep(3);
    }
  }

  async function onSubmit(values: FormValues) {
    setFormError(null);

    // Validación del punto 9 según la regla de negocio
    if (anyPositive && !checks[9]) {
      setFormError("Hay un punto de seguridad positivo. Es obligatorio responder el punto 9.");
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
        surplusQuantity: toNumber(line.surplusQuantity),
        shortageQuantity: toNumber(line.shortageQuantity),
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
      if (inline) {
        savedResultRef.current = saved;
        requestClose();
      } else {
        onSaved(saved);
        requestClose();
      }
    } catch (err) {
      setFormError(
        err instanceof ApiError
          ? err.message
          : isEdit
          ? "No se pudo guardar la investigación"
          : "No se pudo crear la investigación",
      );
    }
  }

  // Dinamismo de ancho para modal: amplio en paso 2 para la tabla editorial sin apretar columnas
  const modalMaxWidth =
    step === 1 ? "max-w-xl" : step === 2 ? "max-w-7xl" : "max-w-3xl";

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

  // Paso 1: Origen e Identificación
  const renderStep1 = () => (
    <div className="flex flex-col gap-4 animate-plf-fade">
      <FormDivider title="Identificación del caso y despacho" />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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

        <DateField
          label="Fecha del despacho"
          required
          value={discrepancyDate}
          onChange={setDiscrepancyDate}
          placeholder="Seleccionar fecha…"
          headerLabel="Fecha del despacho"
        />
      </div>

      {/* Tarjeta resumen del ticket seleccionado */}
      {ticketLabel && (
        <div className="rounded-xl border border-zinc-200/90 bg-zinc-50/70 p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 shadow-2xs">
          <div className="flex flex-col">
            <span className="text-[10px] font-heading font-bold uppercase tracking-wider text-zinc-400">
              Ticket seleccionado
            </span>
            <span className="text-[13px] font-semibold text-zinc-900 mt-0.5">
              {ticketLabel}
            </span>
          </div>
          {effectiveTicketClientName && (
            <div className="inline-flex items-center gap-1.5 self-start sm:self-auto rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-[12px] font-medium text-zinc-700 shadow-2xs">
              <Building2 className="h-3.5 w-3.5 text-zinc-400" />
              <span>{effectiveTicketClientName}</span>
            </div>
          )}
        </div>
      )}

      {/* Tarjeta explicativa con tono oficial Plastifar */}
      <div className="rounded-xl border border-purple-100 bg-purple-50/50 p-4 text-xs text-purple-900 leading-relaxed">
        <p className="font-semibold text-purple-950 flex items-center gap-1.5">
          <span>Formato Oficial PF-FOR-291 · Flujo de 3 Pasos</span>
        </p>
        <p className="mt-1 text-purple-800/90">
          En el siguiente paso podrás registrar en la tabla editorial las líneas en discrepancia (sobrantes o faltantes), indicar si aplican para nota de crédito, asignar despachador y supervisor, y finalmente completar la evaluación de seguridad de 9 puntos.
        </p>
      </div>
    </div>
  );

  // Paso 2: Líneas en Discrepancia y Nota Operativa
  const renderStep2 = () => (
    <div className="flex flex-col gap-3.5 animate-plf-fade">
      <div className="flex items-center justify-between">
        <FormDivider title="Líneas en discrepancia (Formato PF-FOR-291)" />
      </div>

      {/* TABLA EDITORIAL DE LÍNEAS - ENCABEZADOS DE UNA SOLA LÍNEA Y ALINEACIÓN PERFECTA */}
      <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white shadow-2xs">
        <table className="w-full text-left border-collapse min-w-[1240px]">
          <thead>
            <tr className="border-b border-zinc-200 bg-zinc-50/90 text-[11px] font-heading font-bold uppercase tracking-wider text-zinc-500 select-none">
              <th className="py-2.5 px-2.5 w-10 text-center whitespace-nowrap">#</th>
              <th className="py-2.5 px-2.5 w-32 whitespace-nowrap"># Reclamo</th>
              <th className="py-2.5 px-2.5 w-32 whitespace-nowrap">Factura *</th>
              <th className="py-2.5 px-2.5 w-52 whitespace-nowrap">Cliente</th>
              <th className="py-2.5 px-2.5 w-72 whitespace-nowrap">Producto *</th>
              <th className="py-2.5 px-2.5 w-28 text-center whitespace-nowrap">Sobrante</th>
              <th className="py-2.5 px-2.5 w-28 text-center whitespace-nowrap">Faltante</th>
              <th className="py-2.5 px-2.5 w-32 text-center whitespace-nowrap">¿Cumple N/C?</th>
              <th className="py-2.5 px-2.5 w-28 whitespace-nowrap"># N/C</th>
              <th className="py-2.5 px-2.5 w-40 whitespace-nowrap">Despachador *</th>
              <th className="py-2.5 px-2.5 w-36 whitespace-nowrap">Supervisor</th>
              <th className="py-2.5 px-2 w-10 text-center whitespace-nowrap"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {fields.map((field, index) => {
              const lineErrors = errors.lines?.[index];
              const existingLine = discrepancy?.lines?.[index];

              return (
                <DiscrepancyTableRow
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
          </tbody>
        </table>
      </div>

      {/* Pie de tabla con botón agregar y contador */}
      <div className="flex items-center justify-between pt-1">
        <Button
          type="button"
          size="sm"
          variant="secondary"
          onClick={() =>
            append(emptyLine(defaultClientIdForLines, derivedTicketNumber))
          }
        >
          <Plus className="h-3.5 w-3.5" />
          <span>Agregar otra línea</span>
        </Button>

        <span className="text-[11.5px] text-zinc-400 select-none">
          {fields.length} {fields.length === 1 ? "línea registrada" : "líneas registradas"}
        </span>
      </div>

      {/* SECCIÓN DE LA NOTA (según PF-FOR-291) */}
      <div className="mt-2 flex flex-col gap-1.5">
        <FormDivider title="Nota de la investigación" />
        <TextAreaField
          id="discrepancy-notes"
          label="Nota operativa"
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
      <FormDivider title="Puntos de seguridad a evaluar (PF-FOR-291)" />

      {anyPositive && (
        <Alert variant="error">
          <span className="flex items-start gap-2">
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              <strong>Hallazgo de seguridad detectado:</strong> se ha marcado al menos un punto positivo. El punto 9 es obligatorio para indicar si se notificó a las Gerencias de Seguridad y Logística.
            </span>
          </span>
        </Alert>
      )}

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
                      className={`mx-auto flex h-7 w-7 items-center justify-center rounded-md border text-[13px] font-bold transition-all cursor-pointer select-none disabled:cursor-not-allowed ${
                        currentVal === "Positivo"
                          ? "border-brand-red bg-brand-red text-white shadow-2xs"
                          : "border-zinc-300 bg-white text-transparent hover:border-brand-red/60 hover:text-brand-red/30"
                      }`}
                      title={`Marcar punto ${item.itemNumber} como Positivo`}
                    >
                      X
                    </button>
                  </td>
                  {/* Checkbox / Botón NEGATIVO */}
                  <td className="py-2 px-2 text-center">
                    <button
                      type="button"
                      disabled={disabled}
                      onClick={() => toggleCheck(item.itemNumber, "Negativo")}
                      className={`mx-auto flex h-7 w-7 items-center justify-center rounded-md border text-[13px] font-bold transition-all cursor-pointer select-none disabled:cursor-not-allowed ${
                        currentVal === "Negativo"
                          ? "border-zinc-800 bg-zinc-800 text-white shadow-2xs"
                          : "border-zinc-300 bg-white text-transparent hover:border-zinc-500 hover:text-zinc-400"
                      }`}
                      title={`Marcar punto ${item.itemNumber} como Negativo`}
                    >
                      X
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
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => {
            setFormError(null);
            setStep((s) => (s - 1) as 1 | 2);
          }}
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          <span>Anterior</span>
        </Button>
      ) : (
        <Button
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
          type="button"
          size="sm"
          onClick={handleNextStep}
        >
          <span>Siguiente paso</span>
          <ChevronRight className="h-3.5 w-3.5" />
        </Button>
      ) : (
        <Button
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

  // RENDER MODO PÁGINA (INLINE EN TAB)
  if (inline) {
    return (
      <div
        ref={inlineMotion.panelRef}
        className="rounded-xl border border-zinc-200 bg-white shadow-2xs overflow-hidden"
      >
        {/* Encabezado en UNA SOLA LÍNEA perfectamente alineada */}
        <div className="border-b border-zinc-200/80 bg-zinc-50/60 px-4 sm:px-6 py-2.5">
          <div className="flex items-center justify-between gap-3">
            {/* Izquierda: Flechita para atrás + Insignia + Título */}
            <div className="flex items-center gap-2.5 min-w-0">
              <button
                type="button"
                onClick={requestClose}
                className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg border border-zinc-200 bg-white text-zinc-600 shadow-2xs hover:bg-zinc-100 hover:text-zinc-900 transition-colors focus:outline-hidden cursor-pointer"
                title="Volver a formularios"
                aria-label="Volver a formularios"
              >
                <ArrowLeft className="size-4 text-zinc-600" />
              </button>

              <div className="h-4 w-px bg-zinc-200 shrink-0" />

              <span className="shrink-0 font-heading text-[10.5px] font-bold uppercase tracking-wider text-purple-700 bg-purple-50 border border-purple-200/80 px-2 py-0.5 rounded-md">
                PF-FOR-291
              </span>

              <h2 className="text-sm sm:text-base font-bold text-zinc-900 font-heading truncate">
                {isEdit ? `Editar ${discrepancy.number}` : "Investigación de Discrepancia de Cargas"}
              </h2>

              <span className="hidden xl:inline text-zinc-300">·</span>
              <span className="hidden xl:inline text-xs text-zinc-500 truncate">
                {step === 1
                  ? "Identificación y fecha de despacho"
                  : step === 2
                  ? "Líneas en discrepancia y nota operativa"
                  : "Evaluación de 9 puntos de seguridad"}
              </span>
            </div>

            {/* Derecha: Chip del ticket en la misma línea */}
            {ticketLabel && (
              <div className="shrink-0 flex items-center gap-1.5 rounded-lg border border-zinc-200/90 bg-white px-2.5 py-1 text-xs text-zinc-700 shadow-2xs">
                <span className="font-heading font-bold text-zinc-400 text-[10px] uppercase tracking-wider">
                  Ticket:
                </span>
                <span className="font-medium text-zinc-900 truncate max-w-[200px] sm:max-w-[340px]">
                  {ticketLabel}
                </span>
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
            {formError && <Alert variant="error">{formError}</Alert>}

            {/* Paso 1: Centrado de manera elegante y enfocada */}
            {step === 1 && (
              <div className="max-w-2xl mx-auto w-full py-4">
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
      </div>
    );
  }

  // RENDER MODO MODAL
  return (
    <Modal
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
        {formError && <Alert variant="error">{formError}</Alert>}
        {step === 1 && renderStep1()}
        {step === 2 && renderStep2()}
        {step === 3 && renderStep3()}
      </form>
    </Modal>
  );
}

/** Fila individual en la tabla editorial de líneas con simetría y altura homogénea h-8 */
interface DiscrepancyTableRowProps {
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

function DiscrepancyTableRow({
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
}: DiscrepancyTableRowProps) {
  const surplus = useWatch({ control, name: `lines.${index}.surplusQuantity` }) ?? "";
  const shortage = useWatch({ control, name: `lines.${index}.shortageQuantity` }) ?? "";

  function handleSurplusChange(val: string) {
    setValue(`lines.${index}.surplusQuantity`, val, { shouldValidate: true, shouldDirty: true });
    if (val && Number(val) > 0) {
      setValue(`lines.${index}.shortageQuantity`, "", { shouldValidate: true, shouldDirty: true });
    }
  }

  function handleShortageChange(val: string) {
    setValue(`lines.${index}.shortageQuantity`, val, { shouldValidate: true, shouldDirty: true });
    if (val && Number(val) > 0) {
      setValue(`lines.${index}.surplusQuantity`, "", { shouldValidate: true, shouldDirty: true });
    }
  }

  return (
    <tr className="hover:bg-zinc-50/70 transition-colors">
      {/* 1. Índice */}
      <td className="py-2 px-2 text-center font-mono text-[11.5px] font-semibold text-zinc-400 align-middle">
        {index + 1}
      </td>

      {/* 2. # Reclamo */}
      <td className="py-2 px-2 align-middle">
        <input
          type="text"
          className="h-8 w-full rounded-md border border-zinc-200 bg-white px-2 text-[12.5px] text-zinc-800 placeholder:text-zinc-400 focus:border-brand-red focus:ring-2 focus:ring-brand-red/10 outline-none transition-all"
          placeholder="El del ticket"
          title={lineErrors?.claimRef?.message}
          {...register(`lines.${index}.claimRef`)}
        />
      </td>

      {/* 3. Factura * */}
      <td className="py-2 px-2 align-middle">
        <input
          type="text"
          required
          className={`h-8 w-full rounded-md border bg-white px-2 text-[12.5px] text-zinc-800 placeholder:text-zinc-400 focus:outline-none transition-all ${
            lineErrors?.invoiceRef
              ? "border-brand-red bg-red-50/20 focus:ring-2 focus:ring-brand-red/20"
              : "border-zinc-200 focus:border-brand-red focus:ring-2 focus:ring-brand-red/10"
          }`}
          placeholder="B1500000123"
          title={lineErrors?.invoiceRef?.message}
          {...register(`lines.${index}.invoiceRef`)}
        />
      </td>

      {/* 4. Cliente (LookupSelect compacto y directo, sin label encima) */}
      <td className="py-2 px-2 align-middle">
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
              <LookupSelect
                size="sm"
                value={clientField.value}
                selectedLabel={selectedLabel}
                onChange={(value) => clientField.onChange(value)}
                onBlur={clientField.onBlur}
                placeholder={ticketInheritedLabel}
                searchPlaceholder="Buscar cliente…"
                clearLabel={ticketInheritedLabel}
                search={searchClients}
                resolveSelectedLabel={resolveClientLabel}
              />
            );
          }}
        />
      </td>

      {/* 5. Producto (LookupSelect directo y sin asterisco huérfano arriba) */}
      <td className="py-2 px-2 align-middle">
        <Controller
          name={`lines.${index}.productId`}
          control={control}
          render={({ field: productField }) => (
            <LookupSelect
              size="sm"
              value={productField.value}
              onChange={(value) => productField.onChange(value)}
              onBlur={productField.onBlur}
              placeholder="Buscar producto…"
              searchPlaceholder="Código o descripción…"
              search={searchProducts}
              resolveSelectedLabel={resolveProductLabel}
              state={lineErrors?.productId ? "error" : "idle"}
            />
          )}
        />
      </td>

      {/* 6. Cantidad Sobrante */}
      <td className="py-2 px-2 align-middle">
        <input
          type="number"
          min="0"
          step="0.01"
          inputMode="decimal"
          className="h-8 w-full rounded-md border border-zinc-200 bg-white px-2 text-center text-[12.5px] text-zinc-800 placeholder:text-zinc-400 focus:border-brand-red focus:ring-2 focus:ring-brand-red/10 outline-none transition-all"
          placeholder="0.00"
          value={surplus}
          onChange={(e) => handleSurplusChange(e.target.value)}
        />
      </td>

      {/* 7. Cantidad Faltante */}
      <td className="py-2 px-2 align-middle">
        <input
          type="number"
          min="0"
          step="0.01"
          inputMode="decimal"
          className={`h-8 w-full rounded-md border bg-white px-2 text-center text-[12.5px] text-zinc-800 placeholder:text-zinc-400 focus:outline-none transition-all ${
            lineErrors?.shortageQuantity || lineErrors?.surplusQuantity
              ? "border-brand-red bg-red-50/20 focus:ring-2 focus:ring-brand-red/20"
              : "border-zinc-200 focus:border-brand-red focus:ring-2 focus:ring-brand-red/10"
          }`}
          placeholder="0.00"
          title={lineErrors?.shortageQuantity?.message || lineErrors?.surplusQuantity?.message}
          value={shortage}
          onChange={(e) => handleShortageChange(e.target.value)}
        />
      </td>

      {/* 8. ¿Cumple para N/C? (Componente Select oficial con size="sm") */}
      <td className="py-2 px-2 align-middle">
        <Controller
          name={`lines.${index}.qualifies`}
          control={control}
          render={({ field: qualifiesField }) => (
            <Select
              size="sm"
              value={qualifiesField.value}
              onChange={(val) => {
                qualifiesField.onChange(val);
                if (val !== "si") {
                  setValue(`lines.${index}.creditNoteNumber`, "");
                }
              }}
              options={QUALIFIES_OPTIONS}
            />
          )}
        />
      </td>

      {/* 9. # N C */}
      <td className="py-2 px-2 align-middle">
        <Controller
          name={`lines.${index}.qualifies`}
          control={control}
          render={({ field: qualifiesField }) => {
            const isQualifies = qualifiesField.value === "si";
            return (
              <input
                type="text"
                disabled={!isQualifies}
                className="h-8 w-full rounded-md border border-zinc-200 bg-white px-2 text-[12.5px] text-zinc-800 placeholder:text-zinc-400 focus:border-brand-red focus:ring-2 focus:ring-brand-red/10 outline-none transition-all disabled:bg-zinc-50 disabled:text-zinc-400 disabled:cursor-not-allowed"
                placeholder={isQualifies ? "NC-00124" : "Si cumple"}
                {...register(`lines.${index}.creditNoteNumber`)}
              />
            );
          }}
        />
      </td>

      {/* 10. Despachador */}
      <td className="py-2 px-2 align-middle">
        <input
          type="text"
          required
          className={`h-8 w-full rounded-md border bg-white px-2 text-[12.5px] text-zinc-800 placeholder:text-zinc-400 focus:outline-none transition-all ${
            lineErrors?.dispatcherName
              ? "border-brand-red bg-red-50/20 focus:ring-2 focus:ring-brand-red/20"
              : "border-zinc-200 focus:border-brand-red focus:ring-2 focus:ring-brand-red/10"
          }`}
          placeholder="Nombre despachador"
          title={lineErrors?.dispatcherName?.message}
          {...register(`lines.${index}.dispatcherName`)}
        />
      </td>

      {/* 11. Supervisor */}
      <td className="py-2 px-2 align-middle">
        <input
          type="text"
          className="h-8 w-full rounded-md border border-zinc-200 bg-white px-2 text-[12.5px] text-zinc-800 placeholder:text-zinc-400 focus:border-brand-red focus:ring-2 focus:ring-brand-red/10 outline-none transition-all"
          placeholder="Supervisor (opcional)"
          {...register(`lines.${index}.supervisorName`)}
        />
      </td>

      {/* 12. Acción Eliminar */}
      <td className="py-2 px-2 text-center align-middle">
        {canRemove && (
          <button
            type="button"
            onClick={onRemove}
            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-zinc-400 hover:text-brand-red hover:bg-rose-50 transition-colors cursor-pointer"
            title={`Quitar línea ${index + 1}`}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </td>
    </tr>
  );
}
