import { zodResolver } from "@hookform/resolvers/zod";
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Factory,
  Plus,
  ShieldCheck,
  ShoppingBag,
  Trash2,
  Warehouse,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  Controller,
  useFieldArray,
  useForm,
  useWatch,
  type UseFormRegisterReturn,
} from "react-hook-form";
import { z } from "zod";
import { claimsApi } from "../../api/claims";
import { ApiError } from "../../api/client";
import { fetchAllPages } from "../../api/paging";
import { settingsApi } from "../../api/settings";
import { ticketsApi } from "../../api/tickets";
import { ticketTopicsApi } from "../../api/ticketTopics";
import { ticketVerdictsApi } from "../../api/ticketVerdicts";
import { useReceipts } from "../../context/useReceipts";
import { useDialogMotion } from "../../hooks/useDialogMotion";
import { useModalAnimation } from "../../hooks/useModalAnimation";
import { SubmitValidationButton } from "../../components/app/SubmitValidationButton";
import { EnterpriseFormSaveDraftButton } from "../../components/app/EnterpriseFormSaveDraftButton";
import { EnterpriseFormSaveDraftConfirmModal } from "../../components/app/EnterpriseFormSaveDraftConfirmModal";
import { ProductLookupField } from "../../components/app/ProductLookupField";
import { Logo } from "../../components/Logo";
import { Alert } from "../../components/ui/Alert";
import { Button } from "../../components/ui/Button";
import { ChoiceTileGroup } from "../../components/ui/ChoiceTileGroup";
import {
  DateField,
  SelectField,
  TextAreaField,
  TextField,
  type FieldState,
} from "../../components/ui/Field";
import { FormLineTabStrip, formLineTabIndexAttr } from "../../components/ui/FormLineTabStrip";
import { FormSection } from "../../components/ui/FormSection";
import { Modal } from "../../components/ui/Modal";
import { autoResizeTextarea } from "../../lib/autoResizeTextarea";
import { CLAIM_FORM_CONTROL } from "../../lib/claims";
import {
  focusFormFieldByName,
  getClaimStepMissing,
} from "../../lib/enterpriseFormValidation";
import {
  clearEnterpriseFormDraft,
  enterpriseFormDraftKey,
  readEnterpriseFormDraft,
  writeEnterpriseFormDraft,
} from "../../lib/enterpriseFormDrafts";
import { formatPhoneNumber } from "../../lib/format";
import { toNumberOrNull } from "../../lib/numbers";
import { today } from "../../lib/quality";
import {
  CLAIM_CURRENCIES,
  CLAIM_DEFECT_MOMENTS,
  topicRequiresOther,
  type ClaimAffectedArea,
  type ClaimDefectFoundDuring,
  type ClaimDetail,
  type CustomerClaim,
} from "../../types/claims";
import type { TicketProductResponse, TicketTopicResponse } from "../../types/api";
import { PLANT_COUNTRIES, type Plant } from "../../types/settings";

const PHONE_CHARS_REGEX = /^[0-9+\s\-().extx]+$/i;

const CLAIM_AREA_TILES: { area: ClaimAffectedArea; icon: LucideIcon; description: string }[] = [
  { area: "Calidad", icon: ShieldCheck, description: "Especificaciones y producto" },
  { area: "Almacén", icon: Warehouse, description: "Inventario y despacho" },
  { area: "Ventas", icon: ShoppingBag, description: "Pedido y atención comercial" },
];

const plantCountryLabel = (code: Plant["country"]) =>
  PLANT_COUNTRIES.find((c) => c.value === code)?.label ?? code;

const optionalPhone = z
  .string()
  .trim()
  .max(30, "Máximo 30 caracteres")
  .refine((val) => {
    if (!val) return true;
    if (!PHONE_CHARS_REGEX.test(val)) return false;
    const digits = val.replace(/\D/g, "");
    return digits.length >= 10 && digits.length <= 15;
  }, "Teléfono inválido (mín. 10 dígitos)");

/** Número opcional: vacío vale, pero lo escrito tiene que ser un número de cero en adelante. */
const quantity = (decimals: number, what: string) =>
  z
    .string()
    .trim()
    .refine((value) => value === "" || (!Number.isNaN(Number(value)) && Number(value) >= 0), `${what}: número de cero en adelante`)
    .refine(
      (value) => value === "" || Number((Number(value) * 10 ** decimals).toFixed(6)) % 1 === 0,
      `${what}: hasta ${decimals} decimales`,
    );

// Espejo de ClaimRules.Validate en el servidor (docs/plan/03, sección 13).
const schema = z
  .object({
    claimDate: z
      .string()
      .min(1, "Indica la fecha de la reclamación")
      .refine((value) => value <= today(), "La fecha no puede ser posterior a hoy"),
    country: z.string().trim().max(80, "Máximo 80 caracteres"),
    contactName: z.string().trim().max(120, "Máximo 120 caracteres"),
    contactPhone: optionalPhone,
    topicId: z.string().min(1, "Elige el motivo del reclamo"),
    reasonOther: z.string().trim().max(200, "Máximo 200 caracteres"),
    affectedAreas: z.array(z.string()).min(1, "Marca al menos un área afectada"),
    plantIds: z.array(z.string()).min(1, "Marca al menos una planta involucrada"),
    productionLot: z.string().trim().max(80, "Máximo 80 caracteres"),
    invoiceRef: z.string().trim().max(40, "Máximo 40 caracteres"),
    poNumber: z.string().trim().max(40, "Máximo 40 caracteres"),
    unitsToReturn: quantity(2, "Unidades a retornar"),
    defectFoundDuring: z.string(),
    currency: z.string(),
    description: z
      .string()
      .trim()
      .min(20, "Describe la reclamación: al menos 20 caracteres")
      .max(4000, "Máximo 4000 caracteres"),
    comments: z.string().trim().max(4000, "Máximo 4000 caracteres"),
    receivedAt: z.string(),
    firstCustomerContactAt: z.string(),
    lines: z
      .array(
        z.object({
          productId: z.string().min(1, "Elige el producto"),
          unitsPurchased: quantity(2, "Compradas"),
          defectiveQuantity: quantity(2, "Defectuosas"),
          invoicedQuantity: quantity(2, "Facturados"),
          receivedQuantity: quantity(2, "Recibidos"),
          unitPrice: quantity(4, "Precio"),
        }),
      )
      .min(1, "Agrega al menos un producto reclamado"),
  })
  .superRefine((values, ctx) => {
    if (values.firstCustomerContactAt !== "" && values.firstCustomerContactAt < values.claimDate) {
      ctx.addIssue({
        code: "custom",
        path: ["firstCustomerContactAt"],
        message: "El primer contacto no puede ser anterior a la reclamación",
      });
    }
    const seen = new Set<string>();
    values.lines.forEach((line, index) => {
      if (line.productId !== "" && !seen.add(line.productId)) {
        ctx.addIssue({ code: "custom", path: ["lines", index, "productId"], message: "Este producto ya está en otra línea" });
      }
    });
    if (values.lines.some((line) => line.unitPrice !== "") && values.currency === "") {
      ctx.addIssue({ code: "custom", path: ["currency"], message: "Indica la moneda: alguna línea lleva precio" });
    }
  });

type FormValues = z.infer<typeof schema>;

const emptyLine = (): FormValues["lines"][number] => ({
  productId: "",
  unitsPurchased: "",
  defectiveQuantity: "",
  invoicedQuantity: "",
  receivedQuantity: "",
  unitPrice: "",
});

const STEP2_FIELDS = [
  "topicId",
  "reasonOther",
  "affectedAreas",
  "plantIds",
  "productionLot",
  "invoiceRef",
  "poNumber",
  "defectFoundDuring",
] as const satisfies readonly (keyof FormValues)[];

const STEP3_FIELDS = ["lines"] as const satisfies readonly (keyof FormValues)[];

interface ClaimFormModalProps {
  /** Ticket al que se liga la reclamación (alta). */
  ticketId: number;
  ticketNumber: string;
  clientName: string;
  /** Motivo del ticket; sugerencia al registrar la reclamación. */
  ticketTopicId?: number | null;
  /** Del ticket; en edición prevalece lo guardado en la reclamación. */
  contactName?: string | null;
  contactPhone?: string | null;
  clientPhone?: string | null;
  clientContactPersonName?: string | null;
  /** Productos ligados al ticket: pestañas «Productos del ticket» / «Todos los productos». */
  ticketProducts?: TicketProductResponse[];
  inline?: boolean;
  fixedTicketLabel?: string;
  ticketStatus?: string;
  onTicketStatusChanged?: () => void;
  /** Ausente = alta. */
  claim?: CustomerClaim;
  initialData?: {
    invoiceRef?: string;
    description?: string;
    lines?: Array<{
      productId: string;
      unitsPurchased?: string;
      defectiveQuantity?: string;
      invoicedQuantity?: string;
      receivedQuantity?: string;
      unitPrice?: string;
    }>;
  };
  onClose: () => void;
  onSaved: (detail: ClaimDetail) => void;
}

const numberOrEmpty = (value: number | null) => (value === null ? "" : String(value));

const CLAIM_TEXTAREA_AUTO = "min-h-0 resize-none overflow-hidden text-[12.5px] py-2 leading-relaxed";
/** Una línea inicial (mismo criterio que HCA / discrepancias). */
const CLAIM_TEXTAREA_LINE_MIN_PX = 42;

function bindAutoResizeTextarea(
  field: UseFormRegisterReturn,
  minHeightPx: number,
  storeRef?: (element: HTMLTextAreaElement | null) => void,
) {
  return {
    name: field.name,
    onBlur: field.onBlur,
    onChange: (event: React.ChangeEvent<HTMLTextAreaElement>) => {
      field.onChange(event);
      autoResizeTextarea(event.target, minHeightPx);
    },
    ref: (element: HTMLTextAreaElement | null) => {
      field.ref(element);
      storeRef?.(element);
      autoResizeTextarea(element, minHeightPx);
    },
  };
}

/** RF-R1, RF-R2 y RF-R3: las secciones I a III del PF-FOR-034, con las líneas de producto ... */
export function ClaimFormModal({
  ticketId,
  ticketNumber,
  clientName,
  ticketTopicId,
  contactName: contactNameProp,
  contactPhone: contactPhoneProp,
  clientPhone: clientPhoneProp,
  clientContactPersonName,
  ticketProducts: ticketProductsProp,
  inline = false,
  fixedTicketLabel,
  ticketStatus,
  onTicketStatusChanged,
  claim,
  initialData,
  onClose,
  onSaved,
}: ClaimFormModalProps) {
  const isEdit = claim !== undefined;
  const draftStorageKey =
    !isEdit && ticketId > 0 ? enterpriseFormDraftKey("pf034", ticketId) : null;
  const draftLoadedRef = useRef(false);
  const receipts = useReceipts();
  const savedResultRef = useRef<ClaimDetail | null>(null);
  const [showClosePrompt, setShowClosePrompt] = useState(false);
  const [completedClaim, setCompletedClaim] = useState<ClaimDetail | null>(null);
  const [closingTicket, setClosingTicket] = useState(false);
  const [verdicts, setVerdicts] = useState<Array<{ id: number; name: string }>>([]);
  const [selectedVerdictId, setSelectedVerdictId] = useState("");
  const [closeReason, setCloseReason] = useState("");

  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [saveDraftConfirmOpen, setSaveDraftConfirmOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [plants, setPlants] = useState<Plant[] | null>(null);
  const [topics, setTopics] = useState<TicketTopicResponse[]>([]);
  const [ticketProductsFetched, setTicketProductsFetched] = useState<TicketProductResponse[] | undefined>(
    undefined,
  );

  const ticketProducts = ticketProductsProp ?? ticketProductsFetched;

  useEffect(() => {
    if (showClosePrompt && completedClaim) {
      setCloseReason(
        `Cerrado tras registrar reclamación PF-FOR-034 · ${completedClaim.claim.ticketNumber}`,
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
  }, [showClosePrompt, completedClaim]);

  const finishModal = (saved: ClaimDetail) => {
    setShowClosePrompt(false);
    if (inline) {
      savedResultRef.current = saved;
      requestClose();
    } else {
      onSaved(saved);
      onClose();
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

  const suggestedContactName =
    claim?.contactName ?? contactNameProp ?? clientContactPersonName ?? "";
  const suggestedPhone = pickPhone(
    claim?.contactPhone,
    claim?.clientPhone,
    contactPhoneProp,
    clientPhoneProp,
  );

  // Las plantas son catálogo acotado (16 en la fuente): se recorren enteras. Una planta des...
  useEffect(() => {
    fetchAllPages<Plant>((page, pageSize) => settingsApi.plants.list({ page, pageSize }))
      .then(setPlants)
      .catch(() => setPlants([]));
  }, []);

  useEffect(() => {
    fetchAllPages<TicketTopicResponse>((page, pageSize) =>
      ticketTopicsApi.list({ page, pageSize, status: "activos" }),
    )
      .then(setTopics)
      .catch(() => setTopics([]));
  }, []);

  useEffect(() => {
    if (ticketProductsProp !== undefined) return;
    let cancelled = false;
    ticketsApi
      .getById(ticketId)
      .then((ticket) => {
        if (!cancelled) setTicketProductsFetched(ticket.products ?? []);
      })
      .catch(() => {
        if (!cancelled) setTicketProductsFetched([]);
      });
    return () => {
      cancelled = true;
    };
  }, [ticketId, ticketProductsProp]);

  const {
    control,
    register,
    handleSubmit,
    trigger,
    getValues,
    reset,
    setError,
    formState: { errors, touchedFields, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    mode: "onTouched",
    defaultValues: {
      claimDate: claim?.claimDate ?? today(),
      country: claim?.country ?? "",
      contactName: suggestedContactName,
      contactPhone: suggestedPhone ? formatPhoneNumber(suggestedPhone) : "",
      topicId: claim?.topicId ? String(claim.topicId) : ticketTopicId ? String(ticketTopicId) : "",
      reasonOther: claim?.reasonOther ?? "",
      affectedAreas: claim?.affectedAreas ?? [],
      plantIds: claim?.plants.map((plant) => String(plant.id)) ?? [],
      productionLot: claim?.productionLot ?? "",
      invoiceRef: claim?.invoiceRef ?? initialData?.invoiceRef ?? "",
      poNumber: claim?.poNumber ?? "",
      unitsToReturn: numberOrEmpty(claim?.unitsToReturn ?? null),
      defectFoundDuring: claim?.defectFoundDuring ?? "",
      currency: claim?.currency ?? "DOP",
      description: claim?.description ?? initialData?.description ?? "",
      comments: claim?.comments ?? "",
      receivedAt: claim?.receivedAt ?? today(),
      firstCustomerContactAt: claim?.firstCustomerContactAt ?? "",
      lines: claim
        ? claim.lines.map((line) => ({
            productId: String(line.productId),
            unitsPurchased: numberOrEmpty(line.unitsPurchased),
            defectiveQuantity: numberOrEmpty(line.defectiveQuantity),
            invoicedQuantity: numberOrEmpty(line.invoicedQuantity),
            receivedQuantity: numberOrEmpty(line.receivedQuantity),
            unitPrice: numberOrEmpty(line.unitPrice),
          }))
        : initialData?.lines && initialData.lines.length > 0
        ? initialData.lines.map((line: any) => ({
            productId: String(line.productId),
            unitsPurchased: line.unitsPurchased ?? "",
            defectiveQuantity: line.defectiveQuantity ?? "",
            invoicedQuantity: line.invoicedQuantity ?? "",
            receivedQuantity: line.receivedQuantity ?? "",
            unitPrice: line.unitPrice ?? "",
          }))
        : [emptyLine()],
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: "lines" });
  const [activeLineIndex, setActiveLineIndex] = useState(0);

  useEffect(() => {
    if (!draftStorageKey || draftLoadedRef.current) return;
    const draft = readEnterpriseFormDraft<{
      step?: number;
      values?: FormValues;
      activeLineIndex?: number;
    }>(draftStorageKey);
    if (!draft?.values) return;
    draftLoadedRef.current = true;
    reset(draft.values);
    if (typeof draft.step === "number" && draft.step >= 1 && draft.step <= 4) {
      setStep(draft.step as 1 | 2 | 3 | 4);
    }
    if (typeof draft.activeLineIndex === "number") {
      setActiveLineIndex(Math.max(0, draft.activeLineIndex));
    }
  }, [draftStorageKey, reset]);

  const safeActiveLineIndex = Math.min(
    activeLineIndex,
    Math.max(0, fields.length - 1),
  );

  const handleAddProductLine = () => {
    append(emptyLine());
    setActiveLineIndex(fields.length);
  };

  const handleRemoveProductLine = (idxToRemove: number) => {
    if (fields.length <= 1) return;
    remove(idxToRemove);
    setActiveLineIndex((current) => {
      if (current === idxToRemove) return Math.max(0, idxToRemove - 1);
      if (current > idxToRemove) return current - 1;
      return current;
    });
  };

  const topicId = useWatch({ control, name: "topicId" });
  const claimDateValue = useWatch({ control, name: "claimDate" }) ?? "";
  const descriptionValue = useWatch({ control, name: "description" }) ?? "";
  const commentsValue = useWatch({ control, name: "comments" }) ?? "";
  const descriptionField = register("description");
  const commentsField = register("comments");
  const descriptionTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const commentsTextareaRef = useRef<HTMLTextAreaElement | null>(null);

  useLayoutEffect(() => {
    if (step !== 4) return;
    autoResizeTextarea(descriptionTextareaRef.current, CLAIM_TEXTAREA_LINE_MIN_PX);
    autoResizeTextarea(commentsTextareaRef.current, CLAIM_TEXTAREA_LINE_MIN_PX);
  }, [step, descriptionValue, commentsValue]);

  const topicOptions = useMemo(() => {
    const active = topics.filter((t) => t.isActive).map((t) => ({ value: String(t.id), label: t.name }));
    if (claim?.topicId && !active.some((o) => o.value === String(claim.topicId))) {
      return [{ value: String(claim.topicId), label: claim.reason }, ...active];
    }
    return active;
  }, [topics, claim?.topicId, claim?.reason]);

  const claimValues = useWatch({ control });

  const selectedTopicName =
    topicOptions.find((o) => o.value === topicId)?.label ??
    topics.find((t) => String(t.id) === topicId)?.name ??
    "";
  const showReasonOther = topicRequiresOther(selectedTopicName);

  const claimStepMissing = useMemo(
    () => getClaimStepMissing(step, claimValues as FormValues, selectedTopicName),
    [step, claimValues, selectedTopicName],
  );

  async function invalidateClaimStep() {
    if (step === 1) await trigger(["claimDate", "country", "contactName", "contactPhone"]);
    else if (step === 2) await trigger([...STEP2_FIELDS]);
    else if (step === 3) await trigger([...STEP3_FIELDS]);
    else await trigger();
  }

  function focusClaimField(fieldId: string) {
    const lineMatch = /^lines\.(\d+)\./.exec(fieldId);
    if (lineMatch) {
      setActiveLineIndex(Number(lineMatch[1]));
      focusFormFieldByName(fieldId);
      return;
    }
    focusFormFieldByName(fieldId);
  }

  const plantTileOptions = useMemo(
    () =>
      (plants ?? [])
        .filter((plant) => plant.isActive || (claim?.plants.some((p) => p.id === plant.id) ?? false))
        .map((plant) => ({
          value: String(plant.id),
          label: plant.name,
          icon: Factory,
          meta: plantCountryLabel(plant.country),
        })),
    [plants, claim?.plants],
  );

  const lines = useWatch({ control, name: "lines" });

  const anyPrice = (lines ?? []).some((line) => line.unitPrice.trim() !== "");

  function stateOf(field: keyof FormValues): FieldState {
    if (errors[field]) return "error";
    return touchedFields[field] ? "valid" : "idle";
  }

  type LineFieldName = keyof FormValues["lines"][number];

  function lineFieldState(index: number, field: LineFieldName): FieldState {
    const lineErr = errors.lines?.[index];
    if (lineErr && typeof lineErr === "object" && lineErr[field]?.message) return "error";
    const lineTouched = touchedFields.lines?.[index];
    if (lineTouched && typeof lineTouched === "object" && lineTouched[field]) return "valid";
    return "idle";
  }

  function validateReasonOther(values: FormValues): boolean {
    if (!topicRequiresOther(selectedTopicName)) return true;
    if (values.reasonOther.trim().length >= 3) return true;
    setError("reasonOther", { message: "Especifica el motivo: entre 3 y 200 caracteres" });
    return false;
  }

  async function handleNextStep() {
    if (step === 1) {
      const ok = await trigger(["claimDate", "country", "contactName", "contactPhone"]);
      if (ok) setStep(2);
      return;
    }
    if (step === 2) {
      const ok = await trigger([...STEP2_FIELDS]);
      if (ok && validateReasonOther(getValues())) setStep(3);
      return;
    }
    if (step === 3) {
      const ok = await trigger([...STEP3_FIELDS]);
      if (!ok) {
        const currentLineErrors = control._formState.errors.lines;
        if (Array.isArray(currentLineErrors)) {
          const firstErrIdx = currentLineErrors.findIndex((err) => Boolean(err));
          if (firstErrIdx !== -1) setActiveLineIndex(firstErrIdx);
        }
        return;
      }
      setStep(4);
    }
  }

  const stepLabels: Record<typeof step, { title: string; hint: string }> = {
    1: { title: "Información general", hint: "Fecha, código y cliente" },
    2: { title: "Sobre la reclamación", hint: "Motivo, plantas y referencias" },
    3: { title: "Productos", hint: "Productos reclamados" },
    4: { title: "Descripción", hint: "Relato y fechas de recepción" },
  };

  const renderStepper = () => (
    <div className="flex w-full items-center justify-between max-w-4xl mx-auto select-none gap-0.5">
      {([1, 2, 3, 4] as const).map((n, idx) => (
        <Fragment key={n}>
          <button
            type="button"
            onClick={() => {
              if (n <= step) setStep(n);
            }}
            disabled={n > step}
            className="flex items-center gap-2 cursor-pointer disabled:cursor-not-allowed focus:outline-hidden group min-w-0"
          >
            <span
              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold transition-all ${
                step === n
                  ? "bg-brand-red text-white shadow-2xs ring-2 ring-brand-red/20"
                  : step > n
                  ? "bg-emerald-600 text-white"
                  : "bg-zinc-200 text-zinc-600 group-hover:bg-zinc-300"
              }`}
            >
              {step > n ? <Check className="h-3.5 w-3.5" /> : n}
            </span>
            <div className="hidden min-w-0 flex-col text-left md:flex">
              <span
                className={`truncate font-heading text-[12px] font-semibold transition-colors ${
                  step === n ? "text-zinc-900" : step > n ? "text-zinc-700" : "text-zinc-400"
                }`}
              >
                {stepLabels[n].title}
              </span>
              <span className="truncate text-[10px] text-zinc-400">{stepLabels[n].hint}</span>
            </div>
          </button>
          {idx < 3 && (
            <div
              className={`mx-0.5 h-0.5 flex-1 rounded-full transition-colors ${
                step > n ? "bg-emerald-600/40" : "bg-zinc-200"
              }`}
            />
          )}
        </Fragment>
      ))}
    </div>
  );

  const renderStep1 = () => (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-3 animate-plf-fade text-left">
      <div className="overflow-hidden rounded-xl border border-zinc-200/90 bg-white shadow-2xs">
        <div className="flex flex-col items-center gap-2 border-b border-zinc-100 bg-zinc-50/70 px-4 py-4 sm:flex-row sm:justify-between sm:px-5">
          <div className="flex items-center gap-3">
            <Logo height={24} />
            <div className="min-w-0 text-left">
              <p className="font-heading text-[10px] font-bold uppercase tracking-[0.08em] text-zinc-500">
                {CLAIM_FORM_CONTROL.code}
              </p>
              <p className="font-heading text-xs font-bold uppercase leading-snug tracking-wide text-zinc-900 sm:text-sm">
                {CLAIM_FORM_CONTROL.title}
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-3 px-4 py-4 sm:px-5 sm:py-5">
          <ClaimFormDivider title="Identificación del caso" />

          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            <Controller
              name="claimDate"
              control={control}
              render={({ field }) => (
                <DateField
                  label="Fecha de la reclamación"
                  required
                  maxDate={today()}
                  value={field.value}
                  onChange={field.onChange}
                  name={field.name}
                  state={stateOf("claimDate")}
                  error={errors.claimDate?.message}
                />
              )}
            />
            <StaticField label="Código" value={ticketNumber} mono />
          </div>

          <ClaimFormDivider title="I. Información general" />

          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            <StaticField label="Empresa" value={clientName} />
            <TextField
              size="sm"
              label="País"
              placeholder="Opcional"
              state={stateOf("country")}
              error={errors.country?.message}
              {...register("country")}
            />
            <TextField
              size="sm"
              label="Contacto"
              placeholder="Nombre de la persona de contacto"
              state={stateOf("contactName")}
              error={errors.contactName?.message}
              {...register("contactName")}
            />
            <Controller
              name="contactPhone"
              control={control}
              render={({ field }) => (
                <TextField
                  size="sm"
                  type="tel"
                  label="Teléfonos"
                  placeholder="Opcional"
                  name={field.name}
                  value={field.value}
                  onChange={(e) => field.onChange(formatPhoneNumber(e.target.value))}
                  onBlur={field.onBlur}
                  state={stateOf("contactPhone")}
                  error={errors.contactPhone?.message}
                />
              )}
            />
          </div>
        </div>
      </div>

      <p className="text-center text-[11.5px] leading-relaxed text-faint">
        Contacto y teléfono se sugieren desde el ticket y la ficha del cliente; puedes corregirlos antes de guardar.
      </p>
    </div>
  );

  function handleSaveDraft() {
    if (!draftStorageKey || isSubmitting) return;
    if (
      !writeEnterpriseFormDraft(draftStorageKey, {
        step,
        values: getValues(),
        activeLineIndex: safeActiveLineIndex,
      })
    ) {
      receipts.failed({
        action: "guardar-borrador-reclamacion",
        title: "No se pudo guardar el borrador",
        detail: "Revisa el espacio del navegador e inténtalo de nuevo.",
      });
      return;
    }
    receipts.done({
      action: "guardar-borrador-reclamacion",
      title: "Borrador guardado",
      detail: `${CLAIM_FORM_CONTROL.code} · ${ticketNumber}`,
    });
  }

  async function onSubmit(values: FormValues) {
    setFormError(null);
    if (!validateReasonOther(values)) return;

    const blank = (value: string) => (value.trim() === "" ? null : value.trim());

    const request = {
      claimDate: values.claimDate,
      country: blank(values.country),
      contactName: blank(values.contactName),
      contactPhone: blank(values.contactPhone),
      clientPhone: null,
      topicId: Number(values.topicId),
      reasonOther: showReasonOther ? blank(values.reasonOther) : null,
      affectedAreas: values.affectedAreas as ClaimAffectedArea[],
      plantIds: values.plantIds.map(Number),
      productionLot: blank(values.productionLot),
      invoiceRef: blank(values.invoiceRef),
      poNumber: blank(values.poNumber),
      unitsToReturn: toNumberOrNull(values.unitsToReturn),
      defectFoundDuring: values.defectFoundDuring === "" ? null : (values.defectFoundDuring as ClaimDefectFoundDuring),
      currency: anyPrice || values.currency !== "" ? values.currency : null,
      description: values.description.trim(),
      comments: blank(values.comments),
      receivedAt: values.receivedAt === "" ? null : values.receivedAt,
      firstCustomerContactAt: values.firstCustomerContactAt === "" ? null : values.firstCustomerContactAt,
      lines: values.lines.map((line) => ({
        productId: Number(line.productId),
        unitsPurchased: toNumberOrNull(line.unitsPurchased),
        defectiveQuantity: toNumberOrNull(line.defectiveQuantity),
        invoicedQuantity: toNumberOrNull(line.invoicedQuantity),
        receivedQuantity: toNumberOrNull(line.receivedQuantity),
        unitPrice: toNumberOrNull(line.unitPrice),
      })),
    };

    try {
      const saved = isEdit
        ? await claimsApi.update(claim.id, request)
        : await claimsApi.create(ticketId, request);
      clearEnterpriseFormDraft(draftStorageKey);
      receipts.done({
        action: "guardar-reclamacion",
        title: isEdit ? "Reclamación actualizada" : "Reclamación registrada",
        detail: `${CLAIM_FORM_CONTROL.code} · ${saved.claim.ticketNumber}`,
      });

      const isAlreadyClosed =
        ticketStatus === "Solucionado" || ticketStatus === "Cancelado";

      if (!isAlreadyClosed && ticketId > 0) {
        setCompletedClaim(saved);
        setShowClosePrompt(true);
      } else {
        finishModal(saved);
      }
    } catch (err) {
      const fallback = isEdit ? "No se pudo guardar la reclamación" : "No se pudo registrar la reclamación";
      setFormError(err instanceof ApiError ? err.message : fallback);
      receipts.failed({
        action: "error-reclamacion",
        title: isEdit ? "Error al guardar" : "Error al registrar",
        detail: err instanceof ApiError ? err.message : fallback,
      });
    }
  }

  const lineErrors = errors.lines;

  const renderStep2 = () => (
    <div className="flex flex-col gap-3 animate-plf-fade text-left">
        <FormSection title="II. Sobre la reclamación">
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            <Controller
              name="topicId"
              control={control}
              render={({ field }) => (
                <SelectField
                  size="sm"
                  label="Motivo del reclamo"
                  required
                  name={field.name}
                  value={field.value}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  placeholder={topicOptions.length === 0 ? "Cargando motivos…" : "Elige uno"}
                  options={topicOptions}
                  state={stateOf("topicId")}
                  error={errors.topicId?.message}
                />
              )}
            />
            {showReasonOther ? (
              <TextField
                size="sm"
                label="Otros (especifique)"
                required
                placeholder="Qué se reclama"
                state={stateOf("reasonOther")}
                error={errors.reasonOther?.message}
                {...register("reasonOther")}
              />
            ) : (
              <Controller
                name="defectFoundDuring"
                control={control}
                render={({ field }) => (
                  <SelectField
                    size="sm"
                    label="Defecto identificado durante"
                    name={field.name}
                    value={field.value}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                    placeholder="Sin indicar"
                    options={CLAIM_DEFECT_MOMENTS.map((value) => ({ value, label: value }))}
                    error={errors.defectFoundDuring?.message}
                  />
                )}
              />
            )}
          </div>

          {showReasonOther && (
            <Controller
              name="defectFoundDuring"
              control={control}
              render={({ field }) => (
                <SelectField
                  size="sm"
                  label="Defecto identificado durante"
                  name={field.name}
                  value={field.value}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  placeholder="Sin indicar"
                  options={CLAIM_DEFECT_MOMENTS.map((value) => ({ value, label: value }))}
                  error={errors.defectFoundDuring?.message}
                />
              )}
            />
          )}

          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 lg:items-stretch">
            <Controller
              name="plantIds"
              control={control}
              render={({ field }) => (
                <div className="flex min-h-0 w-full min-w-0 flex-1">
                <ChoiceTileGroup
                  legend="Planta involucrada"
                  required
                  columns={1}
                  listViewportItems={3}
                  searchPlaceholder="Buscar planta o país…"
                  emptySearchLabel="Ninguna planta coincide con la búsqueda."
                  selectionNoun={{ one: "planta", other: "plantas" }}
                  loading={plants === null}
                  loadingLabel="Cargando plantas…"
                  emptyLabel={
                    plants !== null && plants.length === 0
                      ? "No hay plantas en el catálogo. Cárgalas en Configuración › Plantas antes de registrar la reclamación."
                      : undefined
                  }
                  options={plantTileOptions}
                  value={field.value}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  error={errors.plantIds?.message}
                />
                </div>
              )}
            />

            <Controller
              name="affectedAreas"
              control={control}
              render={({ field }) => (
                <div className="flex min-h-0 w-full min-w-0 flex-1">
                <ChoiceTileGroup
                  legend="Área afectada"
                  required
                  columns={1}
                  listViewportItems={3}
                  reserveSearchSlot
                  selectionNoun={{ one: "área", other: "áreas" }}
                  options={CLAIM_AREA_TILES.map(({ area, icon, description }) => ({
                    value: area,
                    label: area,
                    icon,
                    description,
                  }))}
                  value={field.value}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  error={errors.affectedAreas?.message}
                />
                </div>
              )}
            />
          </div>

          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
            <TextField
              size="sm"
              label="Fecha de producción (# lote)"
              placeholder="Como viene en el empaque"
              state={stateOf("productionLot")}
              error={errors.productionLot?.message}
              {...register("productionLot")}
            />
            <TextField
              size="sm"
              label="Factura"
              placeholder="Ej. B0100004471"
              state={stateOf("invoiceRef")}
              error={errors.invoiceRef?.message}
              {...register("invoiceRef")}
            />
            <TextField
              size="sm"
              label="Número de PO"
              placeholder="Orden de compra"
              state={stateOf("poNumber")}
              error={errors.poNumber?.message}
              {...register("poNumber")}
            />
          </div>
        </FormSection>
    </div>
  );

  const renderStep3 = () => {
    const activeField = fields[safeActiveLineIndex] ?? fields[0];
    const activeIndex = activeField ? fields.indexOf(activeField) : 0;
    const activeLineError = lineErrors?.[activeIndex];

    return (
      <div className="mx-auto flex w-full min-w-0 max-w-4xl flex-col gap-4 animate-plf-fade text-left">
        <div className="flex min-w-0 flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <ClaimFormDivider title="Productos reclamados" />
            <span className="shrink-0 text-xs font-medium text-zinc-400 select-none">
              {fields.length} {fields.length === 1 ? "producto" : "productos"}
            </span>
          </div>

          {typeof lineErrors?.message === "string" && (
            <p className="text-[12px] text-brand-red">{lineErrors.message}</p>
          )}

          <div className="animate-plf-tabs-in border-b border-zinc-200/80 pb-2">
            <FormLineTabStrip
              activeIndex={safeActiveLineIndex}
              tabCount={fields.length}
              trailing={
                <button
                  type="button"
                  onClick={handleAddProductLine}
                  className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-dashed border-zinc-300 bg-white/60 px-2.5 py-1.5 text-xs font-medium text-zinc-600 shadow-2xs transition-all hover:border-zinc-400 hover:bg-white hover:text-zinc-900"
                  title="Agregar otro producto"
                >
                  <Plus className="size-3.5 text-zinc-500" />
                  <span>Otro producto</span>
                </button>
              }
            >
              {fields.map((field, idx) => {
                const hasError = Boolean(errors.lines?.[idx]);
                const isActive = idx === safeActiveLineIndex;

                return (
                  <button
                    key={field.id}
                    type="button"
                    {...formLineTabIndexAttr(idx)}
                    onClick={() => setActiveLineIndex(idx)}
                    className={`group relative inline-flex shrink-0 cursor-pointer select-none items-center gap-2 rounded-lg border px-3 py-1.5 text-xs transition-all duration-150 ${
                      isActive
                        ? "border-zinc-200/90 bg-white font-semibold text-zinc-900 shadow-2xs ring-1 ring-zinc-950/5"
                        : "border-transparent bg-zinc-100/80 font-medium text-zinc-500 hover:bg-zinc-200/70 hover:text-zinc-800"
                    }`}
                  >
                    <span
                      className={`flex size-4.5 items-center justify-center rounded-md font-heading text-[10px] font-bold ${
                        isActive ? "bg-zinc-900 text-white" : "bg-zinc-200 text-zinc-600"
                      }`}
                    >
                      {idx + 1}
                    </span>
                    <span>Producto #{idx + 1}</span>
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
                          handleRemoveProductLine(idx);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            e.stopPropagation();
                            handleRemoveProductLine(idx);
                          }
                        }}
                        title={`Quitar producto #${idx + 1}`}
                        className="-mr-1 ml-0.5 cursor-pointer rounded p-0.5 text-zinc-400 opacity-60 transition-all hover:bg-zinc-100 hover:text-brand-red group-hover:opacity-100"
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

        {activeField && (
          <div key={activeField.id} className="animate-plf-apple-tab">
            <div className="overflow-hidden rounded-xl border border-zinc-200/90 bg-white shadow-2xs transition-all hover:border-zinc-300">
              <div className="flex items-center justify-between border-b border-zinc-100 bg-zinc-50/70 px-4 py-2.5">
                <div className="flex items-center gap-2.5">
                  <span className="flex size-5.5 items-center justify-center rounded-md bg-zinc-200/80 font-heading text-xs font-bold text-zinc-700">
                    {activeIndex + 1}
                  </span>
                  <span className="font-heading text-xs font-bold text-zinc-800">
                    Producto #{activeIndex + 1}
                  </span>
                </div>
                {fields.length > 1 && (
                  <button
                    type="button"
                    onClick={() => handleRemoveProductLine(activeIndex)}
                    className="inline-flex cursor-pointer items-center gap-1 rounded px-2 py-1 text-[11.5px] font-medium text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-brand-red"
                    title={`Quitar producto ${activeIndex + 1}`}
                  >
                    <Trash2 className="size-3.5" />
                    <span>Quitar</span>
                  </button>
                )}
              </div>

              <div className="flex flex-col gap-4 p-4 sm:p-5">
                {/** Fila 1: Selector de producto (aprovecha el ancho) y Precio unitario */}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                  <div className="sm:col-span-2 lg:col-span-3">
                    <Controller
                      name={`lines.${activeIndex}.productId`}
                      control={control}
                      render={({ field: productField }) => (
                        <ProductLookupField
                          size="sm"
                          label="Producto"
                          required
                          name={productField.name}
                          value={productField.value}
                          ticketProducts={ticketProducts}
                          onChange={(value) => productField.onChange(value)}
                          onBlur={productField.onBlur}
                          state={lineFieldState(activeIndex, "productId")}
                          error={activeLineError?.productId?.message}
                        />
                      )}
                    />
                  </div>

                  <div className="sm:col-span-1 lg:col-span-1">
                    <TextField
                      size="sm"
                      label="Precio unitario"
                      type="number"
                      min="0"
                      step="0.0001"
                      inputMode="decimal"
                      placeholder="0.00"
                      state={lineFieldState(activeIndex, "unitPrice")}
                      error={activeLineError?.unitPrice?.message}
                      {...register(`lines.${activeIndex}.unitPrice`)}
                    />
                  </div>
                </div>

                {/** Fila 2: Cuadrícula equilibrada de 4 columnas para las cantidades */}
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <TextField
                    size="sm"
                    label="Compradas"
                    type="number"
                    min="0"
                    step="0.01"
                    inputMode="decimal"
                    placeholder="0"
                    state={lineFieldState(activeIndex, "unitsPurchased")}
                    error={activeLineError?.unitsPurchased?.message}
                    {...register(`lines.${activeIndex}.unitsPurchased`)}
                  />
                  <TextField
                    size="sm"
                    label="Defectuosas"
                    type="number"
                    min="0"
                    step="0.01"
                    inputMode="decimal"
                    placeholder="0"
                    state={lineFieldState(activeIndex, "defectiveQuantity")}
                    error={activeLineError?.defectiveQuantity?.message}
                    {...register(`lines.${activeIndex}.defectiveQuantity`)}
                  />
                  <TextField
                    size="sm"
                    label="Facturados"
                    type="number"
                    min="0"
                    step="0.01"
                    inputMode="decimal"
                    placeholder="0"
                    state={lineFieldState(activeIndex, "invoicedQuantity")}
                    error={activeLineError?.invoicedQuantity?.message}
                    {...register(`lines.${activeIndex}.invoicedQuantity`)}
                  />
                  <TextField
                    size="sm"
                    label="Recibidos"
                    type="number"
                    min="0"
                    step="0.01"
                    inputMode="decimal"
                    placeholder="0"
                    state={lineFieldState(activeIndex, "receivedQuantity")}
                    error={activeLineError?.receivedQuantity?.message}
                    {...register(`lines.${activeIndex}.receivedQuantity`)}
                  />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderStep4 = () => (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-3 animate-plf-fade text-left">
        <FormSection title="III. Descripción de la reclamación">
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            <TextField
              size="sm"
              label="Cantidad de unidades a retornar"
              type="number"
              min="0"
              step="0.01"
              inputMode="decimal"
              placeholder="Opcional"
              state={stateOf("unitsToReturn")}
              error={errors.unitsToReturn?.message}
              {...register("unitsToReturn")}
            />
            <Controller
              name="currency"
              control={control}
              render={({ field }) => (
                <SelectField
                  size="sm"
                  label="Moneda"
                  required={anyPrice}
                  name={field.name}
                  value={field.value}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  options={CLAIM_CURRENCIES.map((value) => ({ value, label: value }))}
                  error={errors.currency?.message}
                  hint={anyPrice ? undefined : "Solo cuenta si alguna línea lleva precio."}
                />
              )}
            />
          </div>
          <TextAreaField
            label="Descripción"
            required
            rows={1}
            className={CLAIM_TEXTAREA_AUTO}
            placeholder="Qué recibió el cliente, qué esperaba y qué pide"
            error={errors.description?.message}
            {...bindAutoResizeTextarea(descriptionField, CLAIM_TEXTAREA_LINE_MIN_PX, (element) => {
              descriptionTextareaRef.current = element;
            })}
          />
          <TextAreaField
            label="Comentarios"
            rows={1}
            className={CLAIM_TEXTAREA_AUTO}
            placeholder="Opcional"
            error={errors.comments?.message}
            {...bindAutoResizeTextarea(commentsField, CLAIM_TEXTAREA_LINE_MIN_PX, (element) => {
              commentsTextareaRef.current = element;
            })}
          />
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            <Controller
              name="receivedAt"
              control={control}
              render={({ field }) => (
                <DateField
                  label="Fecha de quien recibe"
                  value={field.value}
                  onChange={field.onChange}
                  name={field.name}
                  maxDate={today()}
                  placeholder="Seleccionar fecha…"
                  headerLabel="Recepción"
                  hint="Si queda vacía, se usa la fecha de hoy al guardar."
                  state={stateOf("receivedAt")}
                  error={errors.receivedAt?.message}
                />
              )}
            />
            <Controller
              name="firstCustomerContactAt"
              control={control}
              render={({ field }) => (
                <DateField
                  label="Primer contacto con el cliente"
                  value={field.value}
                  onChange={field.onChange}
                  name={field.name}
                  maxDate={today()}
                  minDate={claimDateValue || undefined}
                  placeholder="Opcional…"
                  headerLabel="Primer contacto"
                  hint="No anterior a la fecha de la reclamación."
                  state={stateOf("firstCustomerContactAt")}
                  error={errors.firstCustomerContactAt?.message}
                />
              )}
            />
          </div>
        </FormSection>
    </div>
  );

  const renderSaveDraftConfirmModal = () =>
    saveDraftConfirmOpen ? (
      <EnterpriseFormSaveDraftConfirmModal
        open
        formCode={CLAIM_FORM_CONTROL.code}
        ticketLabel={ticketNumber}
        onClose={() => setSaveDraftConfirmOpen(false)}
        onConfirm={() => {
          handleSaveDraft();
          setSaveDraftConfirmOpen(false);
        }}
      />
    ) : null;

  const renderClosePromptModal = () => {
    if (!showClosePrompt || !completedClaim) return null;
    const savedClaim = completedClaim.claim;

    return (
      <Modal
        title="¿Deseas cerrar este ticket ahora?"
        eyebrow={`${CLAIM_FORM_CONTROL.code} · Resolución de caso`}
        onClose={() => finishModal(completedClaim)}
        maxWidth="max-w-md"
        closeOnBackdropClick={false}
        footer={
          <div className="flex w-full items-center justify-end gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => finishModal(completedClaim)}
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
                  const finalVerdictId = selectedVerdictId
                    ? Number(selectedVerdictId)
                    : verdicts.length > 0
                    ? verdicts[0].id
                    : undefined;

                  await ticketsApi.updateStatus(ticketId, {
                    status: "Solucionado",
                    verdictId: finalVerdictId,
                    reason:
                      closeReason.trim() ||
                      `Cerrado tras registrar reclamación ${CLAIM_FORM_CONTROL.code} · ${savedClaim.ticketNumber}`,
                  });
                  receipts.done({
                    action: "cerrar-ticket",
                    title: "Ticket cerrado y solucionado",
                    detail: `El ticket quedó solucionado tras la reclamación ${savedClaim.ticketNumber}.`,
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
                  finishModal(completedClaim);
                }
              }}
            >
              <CheckCircle2 className="mr-1 size-3.5" />
              {closingTicket ? "Cerrando..." : "Sí, cerrar ticket"}
            </Button>
          </div>
        }
      >
        <div className="space-y-3.5 py-1 text-left">
          <div className="rounded-xl border border-zinc-200 bg-zinc-50/80 p-3.5">
            <p className="text-xs leading-relaxed text-zinc-700">
              La reclamación{" "}
              <strong className="font-mono font-semibold text-zinc-900">{savedClaim.ticketNumber}</strong>{" "}
              ({CLAIM_FORM_CONTROL.code}) quedó registrada correctamente.
            </p>
            <p className="mt-1.5 text-xs leading-relaxed text-zinc-500">
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
        </div>
      </Modal>
    );
  };

  const renderFooterLeft = () =>
    step === 4 ? (
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
    ) : (
      <span className="text-[11.5px] text-zinc-400 select-none">Paso {step} de 4</span>
    );

  const renderFooterButtons = () => (
    <div className="ml-auto flex items-center gap-2">
      {step > 1 ? (
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => setStep((s) => (s - 1) as 1 | 2 | 3)}
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          <span>Anterior</span>
        </Button>
      ) : (
        <Button type="button" variant="secondary" size="sm" onClick={requestClose}>
          Cancelar
        </Button>
      )}
      <EnterpriseFormSaveDraftButton
        visible={Boolean(draftStorageKey)}
        disabled={isSubmitting}
        onClick={() => setSaveDraftConfirmOpen(true)}
      />
      {step < 4 ? (
        <SubmitValidationButton
          key={`claim-next-${step}`}
          ready={claimStepMissing.length === 0}
          busy={isSubmitting}
          missingItems={claimStepMissing}
          onSubmit={() => void handleNextStep()}
          onInvalidClick={() => void invalidateClaimStep()}
          onFocusField={focusClaimField}
          blockTitle="No se puede continuar"
          hintText="Para avanzar al siguiente paso, completa lo siguiente:"
          shortcutLabel={null}
        >
          <span>Siguiente paso</span>
          <ChevronRight className="h-3.5 w-3.5" />
        </SubmitValidationButton>
      ) : (
        <SubmitValidationButton
          formId="claim-form"
          ready={claimStepMissing.length === 0}
          busy={isSubmitting}
          missingItems={claimStepMissing}
          onInvalidClick={() => void invalidateClaimStep()}
          onFocusField={focusClaimField}
          blockTitle="No se puede registrar"
          hintText="Para registrar la reclamación, completa lo siguiente:"
          shortcutLabel="Ctrl + ↵"
        >
          {isEdit ? "Guardar cambios" : "Registrar reclamación"}
        </SubmitValidationButton>
      )}
    </div>
  );

  const formBody = (
    <form
      id="claim-form"
      onSubmit={handleSubmit(onSubmit)}
      onKeyDown={(e) => {
        if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
          e.preventDefault();
          if (step < 4) void handleNextStep();
          else void handleSubmit(onSubmit)();
        }
      }}
      noValidate
      className="flex min-w-0 flex-col gap-3 text-left"
    >
      {formError && <Alert variant="error">{formError}</Alert>}
      {step === 1 && renderStep1()}
      {step === 2 && renderStep2()}
      {step === 3 && renderStep3()}
      {step === 4 && renderStep4()}
    </form>
  );

  if (inline) {
    return (
      <div
        ref={inlineMotion.panelRef}
        className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-2xs"
      >
        <div className="border-b border-zinc-200/80 bg-white px-4 py-3 sm:px-6">
          <div className="flex items-center justify-between gap-4">
            <div className="flex min-w-0 items-center gap-3.5">
              <button
                type="button"
                onClick={requestClose}
                className="inline-flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-zinc-200 bg-zinc-50/60 text-zinc-600 shadow-2xs transition-colors hover:bg-zinc-100 hover:text-zinc-900 focus:outline-hidden"
                title="Volver a formularios"
                aria-label="Volver a formularios"
              >
                <ArrowLeft className="size-4 text-zinc-600" />
              </button>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded border border-brand-red/20 bg-brand-red/10 px-1.5 py-0.5 font-heading text-[10px] font-bold uppercase tracking-wider text-brand-red">
                    {CLAIM_FORM_CONTROL.code}
                  </span>
                  <span className="text-xs text-zinc-500">{stepLabels[step].hint}</span>
                </div>
                <h2 className="mt-0.5 truncate font-heading text-base font-bold leading-tight text-zinc-900 sm:text-lg">
                  {isEdit ? `Editar reclamación · ${ticketNumber}` : "Reclamación de clientes"}
                </h2>
              </div>
            </div>
            {fixedTicketLabel && (
              <div className="hidden shrink-0 items-center gap-2 rounded-lg border border-zinc-200/90 bg-zinc-50/70 px-3 py-1.5 text-xs text-zinc-700 shadow-2xs sm:flex">
                <span className="font-semibold text-zinc-500">Caso</span>
                <span className="max-w-[220px] truncate font-mono font-bold">
                  {fixedTicketLabel.split(" · ")[0]}
                </span>
              </div>
            )}
          </div>
        </div>
        <div className="border-b border-zinc-100 px-4 py-3 sm:px-6">{renderStepper()}</div>
        <div className="p-4 sm:p-6">{formBody}</div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-zinc-200/80 bg-zinc-50/70 px-5 py-3.5 sm:px-6">
          {renderFooterLeft()}
          {renderFooterButtons()}
        </div>
        {renderClosePromptModal()}
        {renderSaveDraftConfirmModal()}
      </div>
    );
  }

  return (
    <>
      <Modal
        title={isEdit ? `Editar · ${ticketNumber}` : `Registrar · ${ticketNumber}`}
        eyebrow={`${CLAIM_FORM_CONTROL.code} · ${stepLabels[step].title}`}
        onClose={onClose}
        isExiting={isExiting}
        onRequestClose={requestClose}
        maxWidth="max-w-4xl"
        footer={
          <div className="flex w-full items-center gap-3">
            {renderFooterLeft()}
            {renderFooterButtons()}
          </div>
        }
      >
        <div className="mb-4 -mt-2 border-b border-zinc-100 pb-3">{renderStepper()}</div>
        {formBody}
      </Modal>
      {renderClosePromptModal()}
      {renderSaveDraftConfirmModal()}
    </>
  );
}

function ClaimFormDivider({ title }: { title: string }) {
  return (
    <div className="flex items-center gap-2 border-t border-zinc-100 pt-2 first:border-0 first:pt-0">
      <span className="select-none font-heading text-[10px] font-bold uppercase tracking-[0.08em] text-zinc-400">
        {title}
      </span>
      <div className="h-px flex-1 bg-zinc-100" />
    </div>
  );
}

/** Misma altura y etiqueta que `TextField size="sm"`, solo lectura. */
function pickPhone(...candidates: (string | null | undefined)[]): string {
  for (const raw of candidates) {
    const value = raw?.trim();
    if (value) return value;
  }
  return "";
}

function StaticField({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  const display = value.trim() === "" || value === "—" ? "—" : value;
  return (
    <div className="flex flex-col gap-1.5">
      <span className="font-heading text-[11.5px] font-semibold text-faint">{label}</span>
      <div
        className={`flex h-8 w-full items-center truncate rounded-edge border border-line-strong bg-canvas px-2.5 text-[12.5px] text-ink ${
          mono ? "font-mono tabular-nums" : ""
        }`}
        title={display}
      >
        {display}
      </div>
    </div>
  );
}
