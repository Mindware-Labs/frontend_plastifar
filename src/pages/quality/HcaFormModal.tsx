import { zodResolver } from "@hookform/resolvers/zod";
import {
  ArrowLeft,
  Check,
  ChevronLeft,
  ChevronRight,
  FileText,
  PenLine,
  Plus,
  Trash2,
  Users,
} from "lucide-react";
import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  Controller,
  useFieldArray,
  useForm,
  useWatch,
  type FieldErrors,
  type UseFormRegisterReturn,
} from "react-hook-form";
import { z } from "zod";
import { ApiError } from "../../api/client";
import { fetchAllPages } from "../../api/paging";
import { qualityApi } from "../../api/quality";
import { settingsApi } from "../../api/settings";
import { ProductLookupField } from "../../components/app/ProductLookupField";
import { Logo } from "../../components/Logo";
import { Alert } from "../../components/ui/Alert";
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
import { Modal } from "../../components/ui/Modal";
import { LookupSelect } from "../../components/ui/LookupSelect";
import { RowAction } from "../../components/ui/RowAction";
import { useAuth } from "../../context/useAuth";
import { useReceipts } from "../../context/useReceipts";
import { useDialogMotion } from "../../hooks/useDialogMotion";
import { useModalAnimation } from "../../hooks/useModalAnimation";
import { prefersReducedMotion } from "../../hooks/motion";
import { autoResizeTextarea } from "../../lib/autoResizeTextarea";
import { resolveStaffLabel, searchActiveStaff } from "../../lib/lookups";
import { today } from "../../lib/quality";
import type { TicketProductResponse } from "../../types/api";
import type { CorrectiveActionSheet, HcaParticipant } from "../../types/quality";
import type { Plant, ProductLine } from "../../types/settings";
import { HcaFormBlock } from "./HcaFormBlock";

const planRowSchema = z
  .object({
    serverId: z.number().optional(),
    description: z.string().trim().max(500, "Máximo 500 caracteres"),
    responsibleStaffId: z.string(),
    dueDate: z.string(),
    evidenceNotes: z.string().trim().max(2000, "Máximo 2000 caracteres"),
  })
  .superRefine((row, ctx) => {
    const started =
      row.description.trim() !== "" ||
      row.responsibleStaffId !== "" ||
      row.dueDate !== "" ||
      row.evidenceNotes.trim() !== "";
    if (!started) return;
    if (row.description.trim().length < 10) {
      ctx.addIssue({
        code: "custom",
        path: ["description"],
        message: "Describe la acción: al menos 10 caracteres",
      });
    }
    if (row.responsibleStaffId === "") {
      ctx.addIssue({
        code: "custom",
        path: ["responsibleStaffId"],
        message: "Elige quién responde",
      });
    }
    if (row.dueDate === "") {
      ctx.addIssue({
        code: "custom",
        path: ["dueDate"],
        message: "Indica cuándo",
      });
    }
  });

const participantRowSchema = z
  .object({
    serverId: z.number().optional(),
    kind: z.enum(["personal", "manual"]),
    staffId: z.string(),
    name: z.string().trim().max(160, "Máximo 160 caracteres"),
  })
  .superRefine((row, ctx) => {
    const started =
      row.serverId !== undefined ||
      row.staffId !== "" ||
      row.name.trim().length >= 3;
    if (!started) return;
    if (row.kind === "personal" && row.staffId === "") {
      ctx.addIssue({ code: "custom", path: ["staffId"], message: "Elige a la persona" });
    }
    if (row.kind === "manual" && row.name.trim().length < 3) {
      ctx.addIssue({
        code: "custom",
        path: ["name"],
        message: "Escribe el nombre: al menos 3 caracteres",
      });
    }
  });

const schema = z
  .object({
    clientId: z.string(),
    productLineId: z.string(),
    productId: z.string(),
    plantId: z.string(),
    detectedAt: z.string().min(1, "Indica la fecha"),
    dueDate: z.string(),
    responsibleMode: z.enum(["sistema", "manual"]),
    responsibleStaffId: z.string(),
    responsibleManualName: z.string().trim().max(160, "Máximo 160 caracteres"),
    description: z
      .string()
      .trim()
      .min(20, "Describe el hecho: al menos 20 caracteres")
      .max(2000, "Máximo 2000 caracteres"),
    immediateAction: z.string().trim().max(2000, "Máximo 2000 caracteres"),
    causes: z
      .array(
        z.object({
          text: z
            .string()
            .trim()
            .refine((value) => value === "" || value.length >= 10, "Al menos 10 caracteres por causa")
            .refine((value) => value.length <= 1000, "Máximo 1000 caracteres"),
        }),
      )
      .max(20, "Una hoja admite hasta 20 causas"),
    planItems: z.array(planRowSchema).max(20),
    participants: z.array(participantRowSchema).max(20),
    comments: z.string().trim().max(4000, "Máximo 4000 caracteres"),
  })
  .superRefine((values, ctx) => {
    if (values.responsibleMode === "sistema") {
      if (values.responsibleStaffId === "") {
        ctx.addIssue({
          code: "custom",
          path: ["responsibleStaffId"],
          message: "Elige el responsable del sistema",
        });
      }
    } else if (values.responsibleManualName.length < 3) {
      ctx.addIssue({
        code: "custom",
        path: ["responsibleManualName"],
        message: "Escribe el nombre: al menos 3 caracteres",
      });
    }
  });

type FormValues = z.infer<typeof schema>;
type PlanRowValues = FormValues["planItems"][number];
type ParticipantRowValues = FormValues["participants"][number];

function emptyPlanRow(): PlanRowValues {
  return {
    description: "",
    responsibleStaffId: "",
    dueDate: "",
    evidenceNotes: "",
  };
}

function emptyParticipant(): ParticipantRowValues {
  return { kind: "personal", staffId: "", name: "" };
}

const CAUSE_REMOVE_MS = 360;
const HCA_TEXTAREA_AUTO = "min-h-0 resize-none overflow-hidden";

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

export interface HcaFormModalProps {
  inline?: boolean;
  sheet?: CorrectiveActionSheet;
  productLines: ProductLine[];
  defaults?: { clientId: number; ticketId: number | null; description?: string };
  fixedTicketLabel?: string;
  ticketClientName?: string;
  ticketProductLineId?: number | null;
  /** Productos del ticket: selector con pestañas como PF-FOR-291. */
  ticketProducts?: TicketProductResponse[];
  onClose: () => void;
  onSaved: (sheet: CorrectiveActionSheet) => void;
}

/**
 * PF-FOR-109 · Hecho, Causa y Acción — flujo editorial en 4 pasos,
 * alineado al formato empresarial y en la línea visual de discrepancia de cargas.
 */
export function HcaFormModal({
  inline = false,
  sheet,
  productLines,
  defaults,
  fixedTicketLabel,
  ticketClientName,
  ticketProductLineId,
  ticketProducts,
  onClose,
  onSaved,
}: HcaFormModalProps) {
  const isEdit = sheet !== undefined;
  const { user } = useAuth();
  const receipts = useReceipts();
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [formError, setFormError] = useState<string | null>(null);
  const [plants, setPlants] = useState<Plant[]>([]);
  const [loadingExtras, setLoadingExtras] = useState(isEdit);
  const originalParticipants = useRef<HcaParticipant[]>(sheet?.participants ?? []);
  const savedResultRef = useRef<CorrectiveActionSheet | null>(null);

  const elaboradoLabel =
    sheet?.createdByName ??
    ([user?.firstName, user?.lastName].filter(Boolean).join(" ") || user?.email || "Usuario actual");

  useEffect(() => {
    fetchAllPages<Plant>((page, pageSize) => settingsApi.plants.list({ page, pageSize }))
      .then(setPlants)
      .catch(() => setPlants([]));
  }, []);

  const {
    control,
    register,
    handleSubmit,
    getValues,
    setValue,
    trigger,
    formState: { errors, touchedFields, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    mode: "onTouched",
    defaultValues: {
      clientId: sheet
        ? String(sheet.clientId)
        : defaults?.clientId
        ? String(defaults.clientId)
        : "",
      productLineId: sheet
        ? String(sheet.productLineId)
        : ticketProductLineId
        ? String(ticketProductLineId)
        : "",
      productId: sheet?.productId ? String(sheet.productId) : "",
      plantId: sheet?.plantId ? String(sheet.plantId) : "",
      detectedAt: sheet ? sheet.detectedAt.slice(0, 10) : today(),
      dueDate: sheet?.dueDate ?? "",
      responsibleMode:
        sheet?.responsibleStaffId != null
          ? ("sistema" as const)
          : sheet?.responsibleManualName
          ? ("manual" as const)
          : ("sistema" as const),
      responsibleStaffId: sheet?.responsibleStaffId != null ? String(sheet.responsibleStaffId) : "",
      responsibleManualName: sheet?.responsibleManualName ?? "",
      description: sheet?.description ?? defaults?.description ?? "",
      immediateAction: sheet?.immediateAction ?? "",
      causes:
        sheet && sheet.causes.length > 0
          ? sheet.causes.map((cause) => ({ text: cause.description }))
          : [{ text: "" }, { text: "" }],
      planItems: [emptyPlanRow(), emptyPlanRow()],
      participants: [emptyParticipant(), emptyParticipant()],
      comments: sheet?.comments ?? "",
    },
  });

  const causeFields = useFieldArray({ control, name: "causes" });
  const planFields = useFieldArray({ control, name: "planItems" });
  const participantFields = useFieldArray({ control, name: "participants" });

  const descriptionField = register("description");
  const immediateActionField = register("immediateAction");
  const descriptionValue = useWatch({ control, name: "description" }) ?? "";
  const immediateActionValue = useWatch({ control, name: "immediateAction" }) ?? "";
  const causesWatch = useWatch({ control, name: "causes" });
  const descriptionTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const immediateActionTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const causeTextareaRefs = useRef<Map<string, HTMLTextAreaElement>>(new Map());
  const [removingCauseIds, setRemovingCauseIds] = useState<Set<string>>(() => new Set());
  const [causeEnterIds, setCauseEnterIds] = useState<Set<string>>(() => new Set());
  const prevCauseFieldIdsRef = useRef<string[] | null>(null);
  const causeRemoveTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const responsibleMode = useWatch({ control, name: "responsibleMode" }) ?? "sistema";

  useEffect(() => {
    return () => {
      for (const timer of causeRemoveTimers.current.values()) clearTimeout(timer);
      causeRemoveTimers.current.clear();
    };
  }, []);

  useEffect(() => {
    const ids = causeFields.fields.map((field) => field.id);
    if (prevCauseFieldIdsRef.current === null) {
      prevCauseFieldIdsRef.current = ids;
      return;
    }
    const added = ids.filter((id) => !prevCauseFieldIdsRef.current!.includes(id));
    if (added.length > 0 && !prefersReducedMotion()) {
      setCauseEnterIds((prev) => {
        const next = new Set(prev);
        for (const id of added) next.add(id);
        return next;
      });
    }
    prevCauseFieldIdsRef.current = ids;
  }, [causeFields.fields]);

  useLayoutEffect(() => {
    if (step !== 2) return;
    autoResizeTextarea(descriptionTextareaRef.current, 96);
    autoResizeTextarea(immediateActionTextareaRef.current, 64);
    for (const element of causeTextareaRefs.current.values()) {
      autoResizeTextarea(element, 64);
    }
  }, [step, descriptionValue, immediateActionValue, causesWatch, causeFields.fields.length]);

  function handleAddCause() {
    causeFields.append({ text: "" });
  }

  function handleRemoveCause(index: number) {
    if (causeFields.fields.length <= 1) return;
    const fieldId = causeFields.fields[index]?.id;
    if (!fieldId) {
      causeFields.remove(index);
      return;
    }
    if (removingCauseIds.has(fieldId)) return;

    if (prefersReducedMotion()) {
      causeFields.remove(index);
      causeTextareaRefs.current.delete(fieldId);
      return;
    }

    setRemovingCauseIds((prev) => new Set(prev).add(fieldId));
    const timer = setTimeout(() => {
      const currentIndex = causeFields.fields.findIndex((field) => field.id === fieldId);
      if (currentIndex >= 0) causeFields.remove(currentIndex);
      setRemovingCauseIds((prev) => {
        const next = new Set(prev);
        next.delete(fieldId);
        return next;
      });
      causeTextareaRefs.current.delete(fieldId);
      causeRemoveTimers.current.delete(fieldId);
    }, CAUSE_REMOVE_MS);
    causeRemoveTimers.current.set(fieldId, timer);
  }

  function handleResponsibleModeChange(newMode: "sistema" | "manual") {
    if (newMode === responsibleMode) return;
    setValue("responsibleMode", newMode, { shouldDirty: true, shouldValidate: true });
    if (newMode === "manual") {
      setValue("responsibleStaffId", "");
    } else {
      setValue("responsibleManualName", "");
    }
  }

  useEffect(() => {
    if (!sheet) return;
    let cancelled = false;
    setLoadingExtras(true);
    Promise.all([
      qualityApi.planItems.list(sheet.id, { page: 1, pageSize: 50 }),
    ])
      .then(([planRes]) => {
        if (cancelled) return;
        if (planRes.items.length > 0) {
          planFields.replace(
            planRes.items.map((item) => ({
              serverId: item.id,
              description: item.description,
              responsibleStaffId: String(item.responsibleStaffId),
              dueDate: item.dueDate,
              evidenceNotes: item.evidenceNotes ?? "",
            })),
          );
        }
        originalParticipants.current = sheet.participants;
        if (sheet.participants.length > 0) {
          participantFields.replace(
            sheet.participants.map((p) => ({
              serverId: p.id,
              kind: p.staffId ? ("personal" as const) : ("manual" as const),
              staffId: p.staffId ? String(p.staffId) : "",
              name: p.name,
            })),
          );
        }
      })
      .catch(() => {
        /* El detalle de la hoja ya trae participantes; el plan es opcional al cargar. */
      })
      .finally(() => {
        if (!cancelled) setLoadingExtras(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo al abrir edición
  }, [sheet?.id]);

  const finishModal = (saved: CorrectiveActionSheet) => {
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

  function stateOf(field: keyof FormValues): FieldState {
    if (errors[field]) return "error";
    return touchedFields[field] ? "valid" : "idle";
  }

  function resolveDueDate(detectedAt: string, explicit: string): string {
    if (explicit !== "") return explicit;
    if (sheet?.dueDate) return sheet.dueDate;
    const base = new Date(`${detectedAt}T12:00:00`);
    base.setDate(base.getDate() + 15);
    return base.toISOString().slice(0, 10);
  }

  function resolveProductLineId(values: FormValues): string {
    if (values.productLineId !== "") return values.productLineId;
    if (sheet) return String(sheet.productLineId);
    if (ticketProductLineId) return String(ticketProductLineId);
    const fallback = productLines.find((line) => line.isActive);
    return fallback ? String(fallback.id) : "";
  }

  async function proposeLineFrom(productId: string) {
    if (productId === "" || getValues("productLineId") !== "") return;
    try {
      const product = await settingsApi.products.get(Number(productId));
      if (product.productLineId !== null) {
        setValue("productLineId", String(product.productLineId), { shouldValidate: true });
      }
      if (product.plantId !== null && getValues("plantId") === "") {
        setValue("plantId", String(product.plantId));
      }
    } catch {
      /* Sin propuesta */
    }
  }

  function resolveClientId(values: FormValues): string {
    if (values.clientId !== "" && values.clientId !== "0") return values.clientId;
    if (sheet) return String(sheet.clientId);
    if (defaults?.clientId) return String(defaults.clientId);
    return "";
  }

  async function handleNextStep() {
    setFormError(null);
    if (step === 1) {
      const ok = await trigger([
        "detectedAt",
        "responsibleMode",
        "responsibleStaffId",
        "responsibleManualName",
      ]);
      if (!ok) {
        receipts.failed({
          action: "hca-paso-1",
          title: "Datos incompletos",
          detail: "Indica la fecha del hecho y el responsable de la hoja.",
        });
        return;
      }
      setStep(2);
    } else if (step === 2) {
      const ok = await trigger(["description", "causes"]);
      if (!ok) {
        receipts.failed({
          action: "hca-paso-2",
          title: "Hecho o causas incompletos",
          detail: "Revisa la descripción del hecho y las causas.",
        });
        return;
      }
      setStep(3);
    } else if (step === 3) {
      const ok = await trigger("planItems");
      if (!ok) {
        receipts.failed({
          action: "hca-paso-3",
          title: "Plan de acción incompleto",
          detail: "Cada fila iniciada debe tener acción, responsable y fecha.",
        });
        return;
      }
      setStep(4);
    }
  }

  async function syncPlanItems(sheetId: number, rows: PlanRowValues[]) {
    const filled = rows.filter(
      (row) =>
        row.description.trim().length >= 10 &&
        row.responsibleStaffId !== "" &&
        row.dueDate !== "",
    );
    for (const row of filled) {
      const payload = {
        description: row.description.trim(),
        responsibleStaffId: Number(row.responsibleStaffId),
        dueDate: row.dueDate,
        evidenceNotes: row.evidenceNotes.trim() === "" ? null : row.evidenceNotes.trim(),
      };
      if (row.serverId) {
        await qualityApi.planItems.update(row.serverId, payload);
      } else {
        await qualityApi.planItems.create(sheetId, payload);
      }
    }
  }

  async function syncParticipants(sheetId: number, rows: ParticipantRowValues[]) {
    const keptIds = new Set(
      rows.map((r) => r.serverId).filter((id): id is number => id !== undefined),
    );
    for (const orig of originalParticipants.current) {
      if (!keptIds.has(orig.id)) {
        await qualityApi.participants.remove(orig.id);
      }
    }
    for (const row of rows) {
      if (row.serverId) continue;
      const started =
        row.kind === "personal" ? row.staffId !== "" : row.name.trim().length >= 3;
      if (!started) continue;
      await qualityApi.participants.add(sheetId, {
        staffId: row.kind === "personal" ? Number(row.staffId) : null,
        name: row.kind === "manual" ? row.name.trim() : null,
      });
    }
  }

  async function onSubmit(values: FormValues) {
    setFormError(null);
    const immediateAction = values.immediateAction.trim();
    const comments = values.comments.trim();

    const clientId = resolveClientId(values);
    const productLineId = resolveProductLineId(values);
    const dueDate = resolveDueDate(values.detectedAt, values.dueDate);

    if (clientId === "") {
      setFormError("Falta el cliente: abre la HCA desde un ticket con cliente o edita una hoja existente.");
      receipts.failed({
        action: "hca-cliente",
        title: "Cliente requerido",
        detail: "El ticket debe tener cliente asociado para registrar la HCA.",
      });
      return;
    }
    if (productLineId === "") {
      setFormError("No hay línea de producto disponible para esta HCA.");
      return;
    }
    if (dueDate < values.detectedAt) {
      setFormError("La fecha de cierre no puede ser anterior a la del hecho.");
      return;
    }

    const request = {
      clientId: Number(clientId),
      productLineId: Number(productLineId),
      productId: values.productId === "" ? null : Number(values.productId),
      plantId: values.plantId === "" ? null : Number(values.plantId),
      detectedAt: values.detectedAt,
      description: values.description.trim(),
      immediateAction: immediateAction === "" ? null : immediateAction,
      responsibleStaffId:
        values.responsibleMode === "sistema" ? Number(values.responsibleStaffId) : null,
      responsibleManualName:
        values.responsibleMode === "manual" ? values.responsibleManualName.trim() : null,
      dueDate,
      ticketId: sheet?.ticketId ?? defaults?.ticketId ?? null,
      comments: comments === "" ? null : comments,
      causes: values.causes.map((cause) => cause.text.trim()).filter((text) => text !== ""),
    };

    try {
      const saved = isEdit
        ? await qualityApi.sheets.update(sheet.id, request)
        : await qualityApi.sheets.create(request);

      await syncPlanItems(saved.id, values.planItems);
      await syncParticipants(saved.id, values.participants);

      const detail = await qualityApi.sheets.get(saved.id);
      receipts.done({
        action: "guardar-hca",
        title: isEdit ? "HCA actualizada" : "HCA creada",
        detail: `PF-FOR-109 · ${detail.sheet.number}`,
      });
      finishModal(detail.sheet);
    } catch (err) {
      const fallback = isEdit ? "No se pudo guardar la HCA" : "No se pudo crear la HCA";
      const msg = err instanceof ApiError ? err.message : fallback;
      setFormError(msg);
      receipts.failed({ action: "error-hca", title: "Error al guardar", detail: msg });
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLFormElement>) {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      if (step < 4) void handleNextStep();
      else void handleSubmit(onSubmit)();
    }
  }

  const modalMaxWidth =
    step === 1 ? "max-w-3xl" : step === 2 ? "max-w-4xl" : "max-w-[96vw] 2xl:max-w-[1400px] w-full";

  const stepLabels: Record<typeof step, { title: string; hint: string }> = {
    1: { title: "Identificación", hint: "Código, fechas y responsables" },
    2: { title: "Hecho y causas", hint: "Descripción del hallazgo" },
    3: { title: "Plan de acción", hint: "Qué, quién y cuándo" },
    4: { title: "Participantes", hint: "Firmas y comentarios" },
  };

  const renderStepper = () => (
    <div className="flex w-full items-center justify-between max-w-2xl mx-auto select-none gap-1">
      {([1, 2, 3, 4] as const).map((n, idx) => (
        <React.Fragment key={n}>
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
            <div className="flex flex-col text-left min-w-0 hidden md:flex">
              <span
                className={`text-[12px] font-heading font-semibold truncate transition-colors ${
                  step === n ? "text-zinc-900" : step > n ? "text-zinc-700" : "text-zinc-400"
                }`}
              >
                {stepLabels[n].title}
              </span>
              <span className="text-[10px] text-zinc-400 truncate">{stepLabels[n].hint}</span>
            </div>
          </button>
          {idx < 3 && (
            <div
              className={`h-0.5 flex-1 mx-1 rounded-full transition-colors ${
                step > n ? "bg-emerald-600/40" : "bg-zinc-200"
              }`}
            />
          )}
        </React.Fragment>
      ))}
    </div>
  );

  const renderStep1 = () => (
    <div className="flex flex-col gap-5 animate-plf-fade max-w-4xl mx-auto w-full">
      {/* Cabecera estilo PF-FOR-109 */}
      <div className="overflow-hidden rounded-xl border border-zinc-200/90 bg-white shadow-2xs">
        <div className="grid grid-cols-1 lg:grid-cols-[auto_1fr_1fr] border-b border-zinc-100">
          <div className="flex flex-col items-center justify-center gap-1 border-b lg:border-b-0 lg:border-r border-zinc-100 px-5 py-4 bg-zinc-50/50">
            <Logo height={26} />
            <span className="font-heading text-lg font-bold tracking-wide text-zinc-900">HCA</span>
            <span className="text-[10px] uppercase text-zinc-500 text-center">Hecho, Causa y Acción</span>
          </div>
          <div className="grid grid-rows-3 divide-y divide-zinc-100 border-b lg:border-b-0 lg:border-r border-zinc-100">
            <HeaderField label="Código" value={isEdit ? sheet!.number : "Se asigna al guardar"} mono />
            <Controller
              name="detectedAt"
              control={control}
              render={({ field }) => (
                <div className="px-3 py-2">
                  <DateField
                    label="Fecha"
                    required
                    value={field.value}
                    onChange={field.onChange}
                    placeholder="Fecha del hecho…"
                    headerLabel="Fecha"
                    state={stateOf("detectedAt")}
                    error={errors.detectedAt?.message}
                  />
                </div>
              )}
            />
            <div className="px-3 py-2.5 flex flex-col justify-center">
              <span className="text-[10px] font-heading font-bold uppercase tracking-wider text-zinc-400">
                Elaborado por
              </span>
              <span className="text-sm font-medium text-zinc-800 mt-0.5 truncate" title={elaboradoLabel}>
                {elaboradoLabel}
              </span>
            </div>
          </div>
          <div className="grid grid-rows-3 divide-y divide-zinc-100">
            <div className="px-3 py-2">
              <Controller
                name="productId"
                control={control}
                render={({ field }) => (
                  <ProductLookupField
                    size="sm"
                    label="Producto"
                    name={field.name}
                    value={field.value}
                    ticketProducts={ticketProducts}
                    onChange={(value) => {
                      field.onChange(value);
                      void proposeLineFrom(value);
                    }}
                    onBlur={field.onBlur}
                    clearLabel="Sin producto específico"
                    error={errors.productId?.message}
                  />
                )}
              />
            </div>
            <div className="px-3 py-2">
              <Controller
                name="plantId"
                control={control}
                render={({ field }) => (
                  <SelectField
                    size="sm"
                    label="Planta"
                    name={field.name}
                    value={field.value}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                    placeholder="Sin planta"
                    options={[
                      { value: "", label: "Sin planta específica" },
                      ...plants
                        .filter((plant) => plant.isActive || String(plant.id) === field.value)
                        .map((plant) => ({
                          value: String(plant.id),
                          label: `${plant.name} · ${plant.country}`,
                        })),
                    ]}
                    error={errors.plantId?.message}
                  />
                )}
              />
            </div>
            <div className="px-3 py-2 flex flex-col gap-1.5">
              <label
                htmlFor={
                  responsibleMode === "sistema" ? "hca-responsible-select" : "hca-responsible-manual"
                }
                className="font-heading text-[11.5px] font-semibold text-faint flex items-center"
              >
                <span>Responsable</span>
                <span className="ml-1 text-brand-red">*</span>
              </label>
              {responsibleMode === "sistema" ? (
                <Controller
                  name="responsibleStaffId"
                  control={control}
                  render={({ field }) => (
                    <LookupSelect
                      size="sm"
                      id="hca-responsible-select"
                      value={field.value}
                      selectedLabel={
                        sheet?.responsibleStaffId != null &&
                        String(sheet.responsibleStaffId) === field.value
                          ? sheet.responsibleName
                          : undefined
                      }
                      onChange={(value) => field.onChange(value)}
                      onBlur={field.onBlur}
                      placeholder="Buscar usuario…"
                      searchPlaceholder="Buscar por nombre o correo…"
                      search={searchActiveStaff}
                      resolveSelectedLabel={resolveStaffLabel}
                      clearLabel="Quitar responsable"
                      state={errors.responsibleStaffId ? "error" : stateOf("responsibleStaffId")}
                      rightAction={
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleResponsibleModeChange("manual");
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
                    id="hca-responsible-manual"
                    placeholder="Nombre del responsable"
                    state={errors.responsibleManualName ? "error" : "idle"}
                    className="w-full pr-8"
                    {...register("responsibleManualName")}
                  />
                  <button
                    type="button"
                    onClick={() => handleResponsibleModeChange("sistema")}
                    tabIndex={-1}
                    title="Buscar usuario en el sistema"
                    aria-label="Buscar usuario en el sistema"
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 flex h-5.5 w-5.5 items-center justify-center rounded text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition-colors cursor-pointer"
                  >
                    <Users className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
              {(errors.responsibleStaffId?.message || errors.responsibleManualName?.message) && (
                <p className="text-[11px] font-medium text-brand-red leading-none">
                  {errors.responsibleStaffId?.message ?? errors.responsibleManualName?.message}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderStep2 = () => (
    <div className="flex flex-col gap-4 animate-plf-fade max-w-4xl mx-auto w-full">
      {fixedTicketLabel && (
        <p className="text-[11px] text-zinc-500 leading-snug">
          Ticket vinculado:{" "}
          <span className="font-medium text-zinc-700">{fixedTicketLabel}</span>
          {ticketClientName ? ` · ${ticketClientName}` : ""}
        </p>
      )}
      <HcaFormBlock label="Hecho">
        <TextAreaField
          label="Descripción del hecho / no conformidad"
          required
          rows={3}
          className={HCA_TEXTAREA_AUTO}
          placeholder="Describe qué ocurrió: lote, cantidad, efecto y contexto operativo…"
          error={errors.description?.message}
          {...bindAutoResizeTextarea(descriptionField, 96, (element) => {
            descriptionTextareaRef.current = element;
          })}
        />
        <div className="mt-3">
          <TextAreaField
            label="Acción inmediata (opcional)"
            rows={2}
            className={HCA_TEXTAREA_AUTO}
            placeholder="Contención aplicada al detectar el problema…"
            error={errors.immediateAction?.message}
            {...bindAutoResizeTextarea(immediateActionField, 64, (element) => {
              immediateActionTextareaRef.current = element;
            })}
          />
        </div>
      </HcaFormBlock>

      <HcaFormBlock label="Causas">
        <div className="space-y-2">
          {causeFields.fields.map((field, index) => {
            const causeField = register(`causes.${index}.text`);
            const exiting = removingCauseIds.has(field.id);
            const entering = causeEnterIds.has(field.id);
            return (
              <div
                key={field.id}
                className={`flex items-start gap-2 ${
                  exiting
                    ? "animate-plf-check-out"
                    : entering
                    ? "animate-plf-seal-pop"
                    : ""
                }`}
              >
                <span className="mt-2.5 w-5 shrink-0 text-xs font-mono text-zinc-400 tabular-nums">
                  {index + 1}.
                </span>
                <div className="min-w-0 flex-1">
                  <TextAreaField
                    label={index === 0 ? "Causa identificada" : `Causa ${index + 1}`}
                    rows={2}
                    className={HCA_TEXTAREA_AUTO}
                    placeholder="Describe una causa raíz o factor contribuyente…"
                    error={errors.causes?.[index]?.text?.message}
                    {...bindAutoResizeTextarea(causeField, 64, (element) => {
                      if (element) causeTextareaRefs.current.set(field.id, element);
                      else causeTextareaRefs.current.delete(field.id);
                    })}
                  />
                </div>
                {causeFields.fields.length > 1 && (
                  <div className="pt-6">
                    <RowAction
                      label={`Quitar causa ${index + 1}`}
                      icon={Trash2}
                      danger
                      disabled={exiting}
                      onClick={() => handleRemoveCause(index)}
                    />
                  </div>
                )}
              </div>
            );
          })}
          {typeof errors.causes?.message === "string" && (
            <p className="text-[11.5px] font-medium text-brand-red">{errors.causes.message}</p>
          )}
          {causeFields.fields.length < 20 && (
            <Button type="button" size="sm" variant="secondary" onClick={handleAddCause}>
              <Plus className="h-3.5 w-3.5" />
              Agregar causa
            </Button>
          )}
        </div>
      </HcaFormBlock>
    </div>
  );

  const renderPlanRow = (index: number, planErrors: FieldErrors<PlanRowValues> | undefined) => (
    <tr key={planFields.fields[index]?.id ?? index} className="align-top">
      <td className="py-2 pl-3 pr-2 text-center font-mono text-[11px] text-zinc-400">{index + 1}</td>
      <td className="py-2 px-2 min-w-[200px]">
        <TextAreaField
          label="Acción (qué)"
          rows={2}
          placeholder="Qué se hará para corregir o prevenir…"
          error={planErrors?.description?.message}
          {...register(`planItems.${index}.description`)}
        />
      </td>
      <td className="py-2 px-2 min-w-[180px]">
        <Controller
          name={`planItems.${index}.responsibleStaffId`}
          control={control}
          render={({ field }) => (
            <LookupField
              size="sm"
              label="Quién"
              name={field.name}
              value={field.value}
              onChange={(value) => field.onChange(value)}
              onBlur={field.onBlur}
              placeholder="Responsable…"
              search={searchActiveStaff}
              resolveSelectedLabel={resolveStaffLabel}
              error={planErrors?.responsibleStaffId?.message}
            />
          )}
        />
      </td>
      <td className="py-2 px-2 min-w-[140px]">
        <Controller
          name={`planItems.${index}.dueDate`}
          control={control}
          render={({ field }) => (
            <DateField
              label="Cuándo"
              value={field.value}
              onChange={field.onChange}
              placeholder="Fecha…"
              headerLabel="Cuándo"
              error={planErrors?.dueDate?.message}
            />
          )}
        />
      </td>
      <td className="py-2 pr-3 pl-1">
        {planFields.fields.length > 1 && (
          <RowAction
            label="Quitar fila"
            icon={Trash2}
            danger
            onClick={() => planFields.remove(index)}
          />
        )}
      </td>
    </tr>
  );

  const renderStep3 = () => (
    <div className="flex flex-col gap-4 animate-plf-fade w-full">
      {loadingExtras && isEdit && (
        <p className="text-xs text-zinc-500 text-center">Cargando plan de acción…</p>
      )}
      <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-2xs">
        <div className="border-b border-zinc-200 bg-zinc-50/90 px-4 py-2.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="size-4 text-brand-red" />
            <span className="font-heading text-xs font-bold uppercase tracking-wider text-zinc-800">
              Plan de acción
            </span>
          </div>
          <span className="text-[10px] text-zinc-400 uppercase tracking-wide">Acción · Quién · Cuándo</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[720px]">
            <thead>
              <tr className="border-b border-zinc-200 text-[10px] font-heading font-bold uppercase tracking-wider text-zinc-500">
                <th className="py-2 pl-3 w-10">#</th>
                <th className="py-2 px-2">Acción (qué)</th>
                <th className="py-2 px-2 w-[200px]">Quién</th>
                <th className="py-2 px-2 w-[150px]">Cuándo</th>
                <th className="w-10" />
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {planFields.fields.map((_, index) =>
                renderPlanRow(index, errors.planItems?.[index]),
              )}
            </tbody>
          </table>
        </div>
        {planFields.fields.length < 20 && (
          <div className="border-t border-zinc-100 px-4 py-2.5">
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => planFields.append(emptyPlanRow())}
            >
              <Plus className="h-3.5 w-3.5" />
              Agregar acción
            </Button>
          </div>
        )}
      </div>

      <HcaFormBlock label="Evidencias">
        <p className="text-xs text-zinc-500 mb-3 leading-relaxed">
          Describe cómo se implementó cada acción. Los archivos adjuntos se gestionan desde la ficha de la HCA
          una vez guardada.
        </p>
        <div className="space-y-3">
          {planFields.fields.map((field, index) => (
            <div key={field.id} className="rounded-lg border border-zinc-100 bg-zinc-50/40 p-3">
              <span className="text-[10px] font-heading font-bold uppercase text-zinc-400">
                Evidencia · Acción {index + 1}
              </span>
              <TextAreaField
                label="Notas de evidencia"
                rows={2}
                className="mt-1.5"
                placeholder="Evidencia de la implementación (opcional)…"
                error={errors.planItems?.[index]?.evidenceNotes?.message}
                {...register(`planItems.${index}.evidenceNotes`)}
              />
            </div>
          ))}
        </div>
      </HcaFormBlock>
    </div>
  );

  function ParticipantTableRow({
    index,
    rowErrors,
  }: {
    index: number;
    rowErrors: FieldErrors<ParticipantRowValues> | undefined;
  }) {
    const kind = useWatch({ control, name: `participants.${index}.kind` }) ?? "personal";
    return (
      <tr key={participantFields.fields[index]?.id ?? index} className="align-top">
        <td className="py-2 pl-3 pr-2 text-center font-mono text-[11px] text-zinc-400">{index + 1}</td>
        <td className="py-2 px-2 min-w-[160px]">
          <Controller
            name={`participants.${index}.kind`}
            control={control}
            render={({ field }) => (
              <SelectField
                size="sm"
                label="Tipo"
                name={field.name}
                value={field.value}
                onChange={field.onChange}
                options={[
                  { value: "personal", label: "Personal del sistema" },
                  { value: "manual", label: "Nombre manual" },
                ]}
              />
            )}
          />
        </td>
        <td className="py-2 px-2 min-w-[240px]">
          {kind === "personal" ? (
            <Controller
              name={`participants.${index}.staffId`}
              control={control}
              render={({ field }) => (
                <LookupField
                  size="sm"
                  label="Nombre"
                  name={field.name}
                  value={field.value}
                  onChange={(value) => field.onChange(value)}
                  onBlur={field.onBlur}
                  placeholder="Participante…"
                  search={searchActiveStaff}
                  resolveSelectedLabel={resolveStaffLabel}
                  error={rowErrors?.staffId?.message}
                />
              )}
            />
          ) : (
            <TextField
              label="Nombre"
              placeholder="Nombre completo…"
              error={rowErrors?.name?.message}
              {...register(`participants.${index}.name`)}
            />
          )}
        </td>
        <td className="py-2 px-2 min-w-[140px]">
          <div className="rounded-lg border border-dashed border-zinc-200 bg-zinc-50/80 px-3 py-2.5 text-center">
            <PenLine className="size-4 mx-auto text-zinc-300" />
            <span className="text-[10px] text-zinc-400 mt-1 block">Firma en impresión</span>
          </div>
        </td>
        <td className="py-2 pr-3">
          {participantFields.fields.length > 1 && (
            <RowAction
              label="Quitar"
              icon={Trash2}
              danger
              onClick={() => participantFields.remove(index)}
            />
          )}
        </td>
      </tr>
    );
  }

  const renderStep4 = () => (
    <div className="flex flex-col gap-4 animate-plf-fade max-w-4xl mx-auto w-full">
      <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-2xs">
        <div className="border-b border-zinc-200 bg-zinc-50/90 px-4 py-2.5 flex items-center gap-2">
          <Users className="size-4 text-brand-red" />
          <span className="font-heading text-xs font-bold uppercase tracking-wider text-zinc-800">
            Participantes
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[640px]">
            <thead>
              <tr className="border-b border-zinc-200 text-[10px] font-heading font-bold uppercase tracking-wider text-zinc-500">
                <th className="py-2 pl-3 w-10">#</th>
                <th className="py-2 px-2 w-[160px]">Origen</th>
                <th className="py-2 px-2">Nombre</th>
                <th className="py-2 px-2 w-[140px]">Firma</th>
                <th className="w-10" />
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {participantFields.fields.map((_, index) => (
                <ParticipantTableRow
                  key={participantFields.fields[index]?.id ?? index}
                  index={index}
                  rowErrors={errors.participants?.[index]}
                />
              ))}
            </tbody>
          </table>
        </div>
        {participantFields.fields.length < 20 && (
          <div className="border-t border-zinc-100 px-4 py-2.5">
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => participantFields.append(emptyParticipant())}
            >
              <Plus className="h-3.5 w-3.5" />
              Agregar participante
            </Button>
          </div>
        )}
      </div>

      <HcaFormBlock label="Comentarios">
        <TextAreaField
          label="Comentarios generales"
          rows={4}
          placeholder="Observaciones, acuerdos de seguimiento o notas para el cierre…"
          error={errors.comments?.message}
          {...register("comments")}
        />
      </HcaFormBlock>
    </div>
  );

  const renderFooterLeft = () => (
    <span className="text-[11px] text-zinc-400 select-none">
      Paso {step} de 4
      {step === 4 && (
        <span className="hidden sm:inline ml-2">
          ·{" "}
          <kbd className="rounded border border-zinc-200 bg-zinc-100 px-1 py-0.5 text-[10px] font-mono">
            Ctrl+Enter
          </kbd>{" "}
          guardar
        </span>
      )}
    </span>
  );

  const renderFooterButtons = () => (
    <div className="flex items-center gap-2">
      {step > 1 && (
        <Button type="button" variant="secondary" size="sm" onClick={() => setStep((step - 1) as typeof step)}>
          <ChevronLeft className="size-3.5" />
          Anterior
        </Button>
      )}
      {step < 4 ? (
        <Button type="button" size="sm" onClick={() => void handleNextStep()}>
          Siguiente
          <ChevronRight className="size-3.5" />
        </Button>
      ) : (
        <>
          <Button type="button" variant="secondary" size="sm" onClick={requestClose}>
            Cancelar
          </Button>
          <Button type="submit" form="hca-form" size="sm" isLoading={isSubmitting}>
            {isEdit ? "Guardar cambios" : "Crear HCA"}
          </Button>
        </>
      )}
    </div>
  );

  const formBody = (
    <form
      id="hca-form"
      onSubmit={handleSubmit(onSubmit)}
      onKeyDown={handleKeyDown}
      noValidate
      className="flex flex-col gap-3 text-left"
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
        className="rounded-xl border border-zinc-200 bg-white shadow-2xs overflow-hidden"
      >
        <div className="border-b border-zinc-200/80 bg-white px-4 sm:px-6 py-3">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3.5 min-w-0">
              <button
                type="button"
                onClick={requestClose}
                className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg border border-zinc-200 bg-zinc-50/60 text-zinc-600 shadow-2xs hover:bg-zinc-100 transition-colors cursor-pointer"
                aria-label="Volver a formularios"
              >
                <ArrowLeft className="size-4" />
              </button>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-heading text-[10px] font-bold uppercase tracking-wider text-brand-red bg-brand-red/10 border border-brand-red/20 px-1.5 py-0.5 rounded">
                    PF-FOR-109
                  </span>
                  <span className="text-xs text-zinc-500">{stepLabels[step].hint}</span>
                </div>
                <h2 className="text-base sm:text-lg font-bold text-zinc-900 font-heading truncate mt-0.5">
                  {isEdit ? `Editar ${sheet!.number}` : "Hecho, Causa y Acción"}
                </h2>
              </div>
            </div>
            {fixedTicketLabel && (
              <div className="hidden sm:flex shrink-0 items-center gap-2 rounded-lg border border-zinc-200/90 bg-zinc-50/70 px-3 py-1.5 text-xs text-zinc-700">
                <span className="font-semibold text-zinc-500">Caso</span>
                <span className="font-mono font-bold truncate max-w-[220px]">{fixedTicketLabel.split(" · ")[0]}</span>
              </div>
            )}
          </div>
        </div>
        <div className="border-b border-zinc-100 py-3 px-4 sm:px-6">{renderStepper()}</div>
        <div className="p-4 sm:p-6">{formBody}</div>
        <div className="border-t border-zinc-200/80 bg-zinc-50/70 px-5 sm:px-6 py-3.5 flex flex-wrap items-center justify-between gap-3">
          {renderFooterLeft()}
          {renderFooterButtons()}
        </div>
      </div>
    );
  }

  return (
    <Modal
      closeOnBackdropClick={false}
      maxWidth={modalMaxWidth}
      eyebrow={
        isEdit ? `HCA #${sheet!.number} · PF-FOR-109` : "PF-FOR-109 · Hecho, Causa y Acción"
      }
      title={isEdit ? `Editar ${sheet!.number}` : "Nueva HCA"}
      description={`Paso ${step} de 4: ${stepLabels[step].title}. ${stepLabels[step].hint}.`}
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
      <div className="mb-4 -mt-2 border-b border-zinc-100 pb-3">{renderStepper()}</div>
      {formBody}
    </Modal>
  );
}

function HeaderField({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="px-3 py-2.5 flex flex-col justify-center min-h-[52px]">
      <span className="text-[10px] font-heading font-bold uppercase tracking-wider text-zinc-400">
        {label}
      </span>
      <span
        className={`text-sm font-medium text-zinc-800 mt-0.5 truncate ${mono ? "font-mono" : ""}`}
        title={value}
      >
        {value}
      </span>
    </div>
  );
}
