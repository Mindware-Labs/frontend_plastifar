import { zodResolver } from "@hookform/resolvers/zod";
import {
  ArrowDownRight,
  ArrowUpRight,
  Package,
  Plus,
  Trash2,
} from "lucide-react";
import { useEffect, useState } from "react";
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
import { ProductLookupField } from "../../components/app/ProductLookupField";
import { Alert } from "../../components/ui/Alert";
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
import { useModalAnimation } from "../../hooks/useModalAnimation";
import {
  cacheTicketInfo,
  getCachedTicketInfo,
  resolveTicketLabel,
  searchTickets,
  toNumber,
} from "../../lib/discrepancies";
import { resolveClientLabel, searchClients } from "../../lib/lookups";
import { today } from "../../lib/quality";
import type { DiscrepancyDetail, LoadDiscrepancy } from "../../types/discrepancies";

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

const emptyLine = (defaultClientId = ""): LineValues => ({
  productId: "",
  invoiceRef: "",
  claimRef: "",
  clientId: defaultClientId,
  surplusQuantity: "",
  shortageQuantity: "",
  qualifies: "",
  creditNoteNumber: "",
  dispatcherName: "",
  supervisorName: "",
});

const QUALIFIES = [
  { value: "", label: "Sin decidir" },
  { value: "si", label: "Sí" },
  { value: "no", label: "No" },
];

const DISCREPANCY_TYPES = [
  { value: "faltante", label: "Faltante", icon: ArrowDownRight },
  { value: "sobrante", label: "Sobrante", icon: ArrowUpRight },
] as const;

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

interface DiscrepancyLineCardProps {
  index: number;
  control: Control<FormValues>;
  register: UseFormRegister<FormValues>;
  errors: FieldErrors<FormValues>;
  setValue: UseFormSetValue<FormValues>;
  remove: (index: number) => void;
  canRemove: boolean;
  ticketClientName?: string;
  ticketClientId?: number;
  existingClientName?: string;
}

function DiscrepancyLineCard({
  index,
  control,
  register,
  errors,
  setValue,
  remove,
  canRemove,
  ticketClientName,
  ticketClientId,
  existingClientName,
}: DiscrepancyLineCardProps) {
  const lineErrors = errors.lines?.[index];

  const surplus = useWatch({ control, name: `lines.${index}.surplusQuantity` }) ?? "";
  const shortage = useWatch({ control, name: `lines.${index}.shortageQuantity` }) ?? "";
  const qualifies = useWatch({ control, name: `lines.${index}.qualifies` }) ?? "";

  // Determinamos el modo activo (faltante o sobrante).
  const isSurplusActive = Number(surplus) > 0 && !shortage;
  const activeType: "faltante" | "sobrante" = isSurplusActive ? "sobrante" : "faltante";
  const qtyValue = activeType === "sobrante" ? surplus : shortage;

  function handleTypeChange(nextType: "faltante" | "sobrante") {
    if (nextType === activeType) return;
    const currentVal = qtyValue;
    if (nextType === "faltante") {
      setValue(`lines.${index}.shortageQuantity`, currentVal, { shouldValidate: true, shouldDirty: true });
      setValue(`lines.${index}.surplusQuantity`, "", { shouldValidate: true, shouldDirty: true });
    } else {
      setValue(`lines.${index}.surplusQuantity`, currentVal, { shouldValidate: true, shouldDirty: true });
      setValue(`lines.${index}.shortageQuantity`, "", { shouldValidate: true, shouldDirty: true });
    }
  }

  function handleQtyChange(val: string) {
    if (activeType === "faltante") {
      setValue(`lines.${index}.shortageQuantity`, val, { shouldValidate: true, shouldDirty: true });
      setValue(`lines.${index}.surplusQuantity`, "", { shouldValidate: true, shouldDirty: true });
    } else {
      setValue(`lines.${index}.surplusQuantity`, val, { shouldValidate: true, shouldDirty: true });
      setValue(`lines.${index}.shortageQuantity`, "", { shouldValidate: true, shouldDirty: true });
    }
  }

  const qtyError = lineErrors?.shortageQuantity?.message || lineErrors?.surplusQuantity?.message;

  // Etiqueta legible del cliente heredado del ticket
  const ticketInheritedLabel = ticketClientName
    ? `${ticketClientName} (Cliente del ticket)`
    : "Cliente del ticket";

  return (
    <div className="rounded-xl border border-zinc-200/90 bg-white p-3.5 shadow-2xs hover:border-zinc-300 transition-all flex flex-col gap-3">
      {/* Cabecera de la tarjeta de línea */}
      <div className="flex items-center justify-between pb-2 border-b border-zinc-100">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-md bg-zinc-100 px-2 py-0.5 font-heading text-[11px] font-bold text-zinc-700">
            <Package className="h-3 w-3 text-zinc-500" />
            Línea #{index + 1}
          </span>
          {Number(qtyValue) > 0 && (
            <span
              className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-md border ${
                activeType === "faltante"
                  ? "text-brand-red bg-red-50 border-red-200/60"
                  : "text-emerald-700 bg-emerald-50 border-emerald-200/60"
              }`}
            >
              {activeType === "faltante" ? (
                <>
                  <ArrowDownRight className="h-3 w-3 text-brand-red" />
                  Faltante: {qtyValue}
                </>
              ) : (
                <>
                  <ArrowUpRight className="h-3 w-3 text-emerald-600" />
                  Sobrante: {qtyValue}
                </>
              )}
            </span>
          )}
        </div>

        {canRemove && (
          <button
            type="button"
            onClick={() => remove(index)}
            className="inline-flex items-center gap-1 text-[11.5px] font-medium text-zinc-400 hover:text-brand-red hover:bg-rose-50 px-2 py-1 rounded-md transition-colors cursor-pointer"
            title={`Quitar línea ${index + 1}`}
          >
            <Trash2 className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Quitar línea</span>
          </button>
        )}
      </div>

      {/* Producto */}
      <Controller
        name={`lines.${index}.productId`}
        control={control}
        render={({ field: productField }) => (
          <ProductLookupField
            size="sm"
            label="Producto"
            required
            name={productField.name}
            value={productField.value}
            onChange={(value) => productField.onChange(value)}
            onBlur={productField.onBlur}
            placeholder="Buscar por código o descripción…"
            error={lineErrors?.productId?.message}
          />
        )}
      />

      {/* Factura y # Reclamo */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        <TextField
          size="sm"
          label="Factura"
          required
          placeholder="Ej. B1500000123"
          error={lineErrors?.invoiceRef?.message}
          {...register(`lines.${index}.invoiceRef`)}
        />
        <TextField
          size="sm"
          label="# Reclamo"
          placeholder="El del ticket"
          error={lineErrors?.claimRef?.message}
          {...register(`lines.${index}.claimRef`)}
        />
      </div>

      {/* Cliente: Muestra el nombre real del cliente y aclara que es el del ticket */}
      <Controller
        name={`lines.${index}.clientId`}
        control={control}
        render={({ field: clientField }) => {
          const isTicketClient =
            clientField.value === "" ||
            (ticketClientId !== undefined && clientField.value === String(ticketClientId));

          const selectedLabel = isTicketClient
            ? (ticketClientName ? `${ticketClientName} (Cliente del ticket)` : undefined)
            : existingClientName && clientField.value === (existingClientName ? clientField.value : "")
            ? existingClientName
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
              searchPlaceholder="Buscar otro cliente para esta línea…"
              clearLabel={ticketInheritedLabel}
              search={searchClients}
              resolveSelectedLabel={resolveClientLabel}
            />
          );
        }}
      />

      {/* Tipo de discrepancia y Cantidad */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 items-start">
        <div className="flex flex-col gap-1">
          <label className="font-heading text-[11.5px] font-semibold text-faint">
            Discrepancia <span className="text-brand-red">*</span>
          </label>
          <div
            role="radiogroup"
            aria-label="Tipo de discrepancia"
            className="grid grid-cols-2 gap-1 rounded-lg border border-zinc-200 bg-zinc-50/70 p-0.5"
          >
            {DISCREPANCY_TYPES.map((item) => {
              const isSelected = activeType === item.value;
              const Icon = item.icon;
              return (
                <button
                  key={item.value}
                  type="button"
                  role="radio"
                  aria-checked={isSelected}
                  onClick={() => handleTypeChange(item.value)}
                  className={`inline-flex h-7 items-center justify-center gap-1.5 rounded-md px-2 text-[12px] transition-all cursor-pointer select-none ${
                    isSelected
                      ? "border border-zinc-200 bg-white font-semibold text-zinc-900 shadow-2xs"
                      : "border border-transparent font-medium text-zinc-600 hover:text-zinc-900 hover:bg-white/50"
                  }`}
                >
                  <Icon
                    className={`h-3 w-3 shrink-0 ${
                      isSelected
                        ? item.value === "faltante"
                          ? "text-brand-red"
                          : "text-emerald-600"
                        : "text-zinc-400"
                    }`}
                  />
                  <span className="truncate">{item.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <TextField
          size="sm"
          label={activeType === "faltante" ? "Cantidad faltante" : "Cantidad sobrante"}
          required
          type="number"
          min="0"
          step="0.01"
          inputMode="decimal"
          placeholder="0.00"
          value={qtyValue}
          onChange={(e) => handleQtyChange(e.target.value)}
          error={qtyError}
        />
      </div>

      {/* Nota de crédito: ¿Aplica? y # N/C */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        <Controller
          name={`lines.${index}.qualifies`}
          control={control}
          render={({ field: qualifiesField }) => (
            <SelectField
              size="sm"
              label="¿Cumple para N/C?"
              name={qualifiesField.name}
              value={qualifiesField.value}
              onChange={(val) => {
                qualifiesField.onChange(val);
                if (val !== "si") {
                  setValue(`lines.${index}.creditNoteNumber`, "");
                }
              }}
              onBlur={qualifiesField.onBlur}
              options={QUALIFIES}
            />
          )}
        />
        <TextField
          size="sm"
          label="# Nota de crédito"
          placeholder={qualifies === "si" ? "Ej. NC-00124" : "Si cumple = Sí"}
          disabled={qualifies !== "si"}
          error={lineErrors?.creditNoteNumber?.message}
          {...register(`lines.${index}.creditNoteNumber`)}
        />
      </div>

      {/* Despachador y Supervisor */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        <TextField
          size="sm"
          label="Despachador"
          required
          placeholder="Nombre de quien despachó"
          error={lineErrors?.dispatcherName?.message}
          {...register(`lines.${index}.dispatcherName`)}
        />
        <TextField
          size="sm"
          label="Supervisor"
          placeholder="Opcional"
          error={lineErrors?.supervisorName?.message}
          {...register(`lines.${index}.supervisorName`)}
        />
      </div>
    </div>
  );
}

/**
 * RF-D1 y RF-D2: Formulario de discrepancia con idéntica experiencia,
 * inputs, ancho y estilo que el formulario de Clientes (PF-FOR-291).
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
}: DiscrepancyFormModalProps) {
  const isEdit = discrepancy !== undefined;
  const [formError, setFormError] = useState<string | null>(null);
  const { isExiting, requestClose } = useModalAnimation();

  // Parsing de nota inicial y fecha
  const parsedNote = parseNote(discrepancy?.note ?? initialData?.note);
  const [discrepancyDate, setDiscrepancyDate] = useState<string>(parsedNote.date);

  // Ticket label y cliente resueltos de inmediato (sin delay de red ni mostrar el ID numérico)
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

  // Si tenemos ticketId y label, aseguramos la caché en memoria de inmediato
  if (initialTicketId && initialTicketLabel) {
    cacheTicketInfo(initialTicketId, initialTicketLabel, initialClientName, initialClientId);
  }

  // Si falta el nombre del cliente del ticket, lo consultamos en segundo plano
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

  const {
    control,
    register,
    handleSubmit,
    setValue,
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
              claimRef: line.claimRef ?? "",
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
              ...emptyLine(defaultClientIdForLines),
              productId: l.productId,
              invoiceRef: l.invoiceRef ?? "",
              clientId: l.clientId ?? defaultClientIdForLines,
              surplusQuantity: l.surplusQuantity ?? "",
              shortageQuantity: l.shortageQuantity ?? "",
            }))
          : [emptyLine(defaultClientIdForLines)],
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: "lines" });
  const noteValue = useWatch({ control, name: "note" }) ?? "";

  function stateOf(field: "ticketId"): FieldState {
    if (errors[field]) return "error";
    return touchedFields[field] ? "valid" : "idle";
  }

  async function onSubmit(values: FormValues) {
    setFormError(null);
    const blank = (value: string) => (value.trim() === "" ? null : value.trim());

    // Construye la nota final incluyendo la fecha seleccionada en el DateField
    const cleanUserNote = values.note.trim();
    const finalNote = discrepancyDate
      ? `[Fecha: ${discrepancyDate}]${cleanUserNote ? `\n${cleanUserNote}` : ""}`
      : cleanUserNote;

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
      checks: null,
    };

    try {
      const saved = isEdit
        ? await discrepanciesApi.update(discrepancy.id, request)
        : await discrepanciesApi.create(Number(values.ticketId), request);
      onSaved(saved);
      requestClose();
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

  function handleKeyDown(event: React.KeyboardEvent<HTMLFormElement>) {
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
      event.preventDefault();
      void handleSubmit(onSubmit)();
    }
  }

  return (
    <Modal
      maxWidth="max-w-xl"
      eyebrow={isEdit ? `Investigación #${discrepancy.id} · ${discrepancy.number}` : "Código asignado automáticamente"}
      title={isEdit ? `Editar ${discrepancy.number}` : "Nueva investigación de discrepancia"}
      description={
        isEdit
          ? "Actualiza los datos de la investigación, líneas o notas internas."
          : "El código se asignará de forma automática al guardar."
      }
      onClose={onClose}
      isExiting={isExiting}
      onRequestClose={requestClose}
      footer={
        <div className="flex w-full items-center justify-between gap-3">
          <span className="hidden sm:inline-flex items-center gap-1 text-[11px] text-zinc-400 select-none">
            <kbd className="rounded border border-zinc-200 bg-zinc-100 px-1 py-0.5 text-[10px] font-mono text-zinc-500">
              Ctrl
            </kbd>
            <span>+</span>
            <kbd className="rounded border border-zinc-200 bg-zinc-100 px-1 py-0.5 text-[10px] font-mono text-zinc-500">
              Enter
            </kbd>
            <span className="ml-0.5">para guardar</span>
          </span>
          <div className="flex items-center gap-2 ml-auto">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={requestClose}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              form="discrepancy-form"
              size="sm"
              isLoading={isSubmitting}
            >
              {isEdit ? "Guardar cambios" : "Crear investigación"}
            </Button>
          </div>
        </div>
      }
    >
      <form
        id="discrepancy-form"
        onSubmit={handleSubmit(onSubmit)}
        onKeyDown={handleKeyDown}
        noValidate
        className="flex flex-col gap-3 text-left"
      >
        {formError && <Alert variant="error">{formError}</Alert>}

        {/* 1. IDENTIFICACIÓN Y ORIGEN */}
        <FormDivider title="Identificación" />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
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

        {/* 2. LÍNEAS EN DISCREPANCIA */}
        <FormDivider title="Líneas en discrepancia" />

        <div className="flex flex-col gap-3">
          {fields.map((field, index) => {
            const lineData = discrepancy?.lines?.[index];
            return (
              <DiscrepancyLineCard
                key={field.id}
                index={index}
                control={control}
                register={register}
                errors={errors}
                setValue={setValue}
                remove={remove}
                canRemove={fields.length > 1}
                ticketClientName={effectiveTicketClientName}
                ticketClientId={effectiveTicketClientId}
                existingClientName={lineData?.clientName}
              />
            );
          })}
        </div>

        {/* Botón para añadir otra línea */}
        <div className="flex items-center justify-between pt-1">
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={() => append(emptyLine(defaultClientIdForLines))}
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Agregar otra línea</span>
          </Button>

          <span className="text-[11.5px] text-zinc-400 select-none">
            {fields.length} {fields.length === 1 ? "línea registrada" : "líneas registradas"}
          </span>
        </div>

        {/* 3. USO INTERNO */}
        <FormDivider title="Uso interno" />

        <TextAreaField
          id="discrepancy-notes"
          label="Notas internas"
          rows={2}
          className="text-[12.5px] py-1.5"
          placeholder="Observaciones de entrega, horarios de recepción, particularidades de la carga…"
          hint={
            <span className="flex items-center justify-between text-[11px] text-zinc-400">
              <span>Instrucciones operativas internas</span>
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
      </form>
    </Modal>
  );
}
