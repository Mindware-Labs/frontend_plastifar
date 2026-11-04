import { zodResolver } from "@hookform/resolvers/zod";
import {
  ArrowLeft,
  Check,
  ChevronLeft,
  ChevronRight,
  PenLine,
  Plus,
  Trash2,
  Users,
} from "lucide-react";
import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  Controller,
  useFieldArray,
  useForm,
  useWatch,
  type Control,
  type FieldErrors,
  type UseFormRegister,
  type UseFormRegisterReturn,
} from "react-hook-form";
import { z } from "zod";
import { ApiError } from "../../api/client";
import { qualityApi } from "../../api/quality";
import { settingsApi } from "../../api/settings";
import { EnterpriseFormCloseTicketModal } from "../../components/app/EnterpriseFormCloseTicketModal";
import { EnterpriseFormCompleteTaskModal } from "../../components/app/EnterpriseFormCompleteTaskModal";
import { shouldPromptEnterpriseFormHostClose } from "../../lib/enterpriseFormHostClose";
import { EnterpriseFormSaveDraftButton } from "../../components/app/EnterpriseFormSaveDraftButton";
import { EnterpriseFormSaveDraftConfirmModal } from "../../components/app/EnterpriseFormSaveDraftConfirmModal";
import { ProductLookupField } from "../../components/app/ProductLookupField";
import { Logo } from "../../components/Logo";
import { Button } from "../../components/ui/Button";
import { SubmitValidationButton } from "../../components/app/SubmitValidationButton";
import {
  focusFormFieldByName,
  getHcaStepMissing,
  type HcaStepValues,
} from "../../lib/enterpriseFormValidation";
import { ControlInput } from "../../components/ui/ControlInput";
import { AppleMotionBlock } from "../../components/ui/AppleMotionBlock";
import {
  DateField,
  SelectField,
  TextAreaField,
  type FieldState,
} from "../../components/ui/Field";
import { Modal } from "../../components/ui/Modal";
import { LookupSelect } from "../../components/ui/LookupSelect";
import { RowAction } from "../../components/ui/RowAction";
import { useAuth } from "../../context/useAuth";
import { useReceipts } from "../../context/useReceipts";
import { useAppleListMotion, type AppleListPhase } from "../../hooks/useAppleListMotion";
import { COMPOSER_FIELD_ENTER_MS, COMPOSER_FIELD_EXIT_MS } from "../bandeja/useComposerFieldMotion";
import { useDialogMotion } from "../../hooks/useDialogMotion";
import { useModalAnimation } from "../../hooks/useModalAnimation";
import { prefersReducedMotion } from "../../hooks/motion";
import { autoResizeTextarea } from "../../lib/autoResizeTextarea";
import { usePlantsCatalog } from "../../lib/catalogQueries";
import { resolveStaffLabel, searchActiveStaff } from "../../lib/lookups";
import {
  clearEnterpriseFormDraft,
  enterpriseFormDraftKey,
  readEnterpriseFormDraft,
  writeEnterpriseFormDraft,
} from "../../lib/enterpriseFormDrafts";
import { HCA_FORM_CONTROL } from "../../lib/hcaForm109";
import { today } from "../../lib/quality";
import type { TicketProductResponse } from "../../types/api";
import type { CorrectiveActionSheet, HcaParticipant } from "../../types/quality";
import type { Plant, ProductLine } from "../../types/settings";
import { HcaFormBlock } from "./HcaFormBlock";

const planRowSchema = z
  .object({
    serverId: z.number().optional(),
    description: z.string().trim().max(500, "Máximo 500 caracteres"),
    responsibleMode: z.enum(["sistema", "manual"]),
    responsibleStaffId: z.string(),
    responsibleManualName: z.string().trim().max(160, "Máximo 160 caracteres"),
    dueDate: z.string(),
    evidenceNotes: z.string().trim().max(2000, "Máximo 2000 caracteres"),
  })
  .superRefine((row, ctx) => {
    const started =
      row.description.trim() !== "" ||
      row.responsibleStaffId !== "" ||
      row.responsibleManualName.trim() !== "" ||
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
    if (row.responsibleMode === "sistema") {
      if (row.responsibleStaffId === "") {
        ctx.addIssue({
          code: "custom",
          path: ["responsibleStaffId"],
          message: "Elige quién responde",
        });
      }
    } else if (row.responsibleManualName.trim().length < 3) {
      ctx.addIssue({
        code: "custom",
        path: ["responsibleManualName"],
        message: "Escribe el nombre: al menos 3 caracteres",
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
    participants: z.array(participantRowSchema).max(2),
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
    responsibleMode: "sistema",
    responsibleStaffId: "",
    responsibleManualName: "",
    dueDate: "",
    evidenceNotes: "",
  };
}

function emptyParticipant(): ParticipantRowValues {
  return { kind: "personal", staffId: "", name: "" };
}

function defaultCreatorParticipant(user: {
  staffId: number;
  firstName?: string;
  lastName?: string;
} | null): ParticipantRowValues {
  if (user?.staffId) {
    return { kind: "personal", staffId: String(user.staffId), name: "" };
  }
  const manualName = [user?.firstName, user?.lastName].filter(Boolean).join(" ").trim();
  if (manualName.length >= 3) {
    return { kind: "manual", staffId: "", name: manualName };
  }
  return emptyParticipant();
}

function HcaParticipantWhoCell({
  index,
  rowId,
  control,
  register,
  rowErrors,
  staffLabel,
  pickLabel,
  onPickLabel,
  onKindChange,
}: {
  index: number;
  rowId: string;
  control: Control<FormValues>;
  register: UseFormRegister<FormValues>;
  rowErrors: FieldErrors<ParticipantRowValues> | undefined;
  staffLabel?: string;
  pickLabel?: string;
  onPickLabel: (rowId: string, label: string | null) => void;
  onKindChange: (index: number, kind: "personal" | "manual") => void;
}) {
  const kind = useWatch({ control, name: `participants.${index}.kind` }) ?? "personal";
  const staffError = rowErrors?.staffId?.message;
  const manualError = rowErrors?.name?.message;
  const fieldError = staffError ?? manualError;
  const displayStaffLabel = pickLabel ?? staffLabel;

  return (
    <div className="min-w-0 w-full">
      {kind === "personal" ? (
        <Controller
          name={`participants.${index}.staffId`}
          control={control}
          render={({ field }) => (
            <LookupSelect
              size="sm"
              className="w-full min-w-0"
              id={`hca-participant-${rowId}`}
              value={field.value}
              selectedLabel={displayStaffLabel}
              onChange={(value, option) => {
                field.onChange(value);
                onPickLabel(rowId, option?.label ?? null);
              }}
              onBlur={field.onBlur}
              placeholder="Participante…"
              searchPlaceholder="Buscar por nombre…"
              search={searchActiveStaff}
              resolveSelectedLabel={resolveStaffLabel}
              clearLabel="Quitar participante"
              state={staffError ? "error" : "idle"}
              rightAction={
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onKindChange(index, "manual");
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
            id={`hca-participant-manual-${rowId}`}
            placeholder="Nombre completo…"
            state={manualError ? "error" : "idle"}
            className="w-full pr-8"
            {...register(`participants.${index}.name`)}
          />
          <button
            type="button"
            onClick={() => onKindChange(index, "personal")}
            tabIndex={-1}
            title="Buscar usuario en el sistema"
            aria-label="Buscar usuario en el sistema"
            className="absolute right-1.5 top-1/2 -translate-y-1/2 flex h-5.5 w-5.5 items-center justify-center rounded text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition-colors cursor-pointer"
          >
            <Users className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
      {fieldError ? (
        <p className="mt-0.5 px-0.5 text-[10px] font-medium leading-snug text-brand-red-dark">
          {fieldError}
        </p>
      ) : null}
    </div>
  );
}

const LIST_ROW_REMOVE_MS = 280;
const HCA_TEXTAREA_AUTO = "min-h-0 resize-none overflow-hidden";
/** Una línea (13px + py-2.5 + borde), mismo mínimo que autoResize en causas y plan. */
const HCA_CAUSE_LINE_MIN_PX = 42;
/** Campos dentro de celdas: etiqueta solo para lectores de pantalla. */
const HCA_TABLE_FIELD = "[&_label]:sr-only";

function HcaPlanWhoCell({
  index,
  rowId,
  control,
  register,
  planErrors,
  staffLabel,
  pickLabel,
  onPickLabel,
  onModeChange,
}: {
  index: number;
  rowId: string;
  control: Control<FormValues>;
  register: UseFormRegister<FormValues>;
  planErrors: FieldErrors<PlanRowValues> | undefined;
  staffLabel?: string;
  pickLabel?: string;
  onPickLabel: (rowId: string, label: string | null) => void;
  onModeChange: (index: number, mode: "sistema" | "manual") => void;
}) {
  const mode = useWatch({ control, name: `planItems.${index}.responsibleMode` }) ?? "sistema";
  const staffError = planErrors?.responsibleStaffId?.message;
  const manualError = planErrors?.responsibleManualName?.message;
  const fieldError = staffError ?? manualError;
  const displayStaffLabel = pickLabel ?? staffLabel;

  return (
    <div className="min-w-0 w-full">
      {mode === "sistema" ? (
        <Controller
          name={`planItems.${index}.responsibleStaffId`}
          control={control}
          render={({ field }) => (
            <LookupSelect
              size="sm"
              className="w-full min-w-0"
              id={`hca-plan-who-${rowId}`}
              aria-labelledby={`hca-plan-who-label-${index}`}
              value={field.value}
              selectedLabel={displayStaffLabel}
              onChange={(value, option) => {
                field.onChange(value);
                onPickLabel(rowId, option?.label ?? null);
              }}
              onBlur={field.onBlur}
              placeholder="Responsable…"
              searchPlaceholder="Buscar por nombre…"
              search={searchActiveStaff}
              resolveSelectedLabel={resolveStaffLabel}
              clearLabel="Quitar responsable"
              state={staffError ? "error" : "idle"}
              rightAction={
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onModeChange(index, "manual");
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
            id={`hca-plan-who-manual-${rowId}`}
            aria-labelledby={`hca-plan-who-label-${index}`}
            placeholder="Nombre del responsable"
            state={manualError ? "error" : "idle"}
            className="w-full pr-8"
            {...register(`planItems.${index}.responsibleManualName`)}
          />
          <button
            type="button"
            onClick={() => onModeChange(index, "sistema")}
            tabIndex={-1}
            title="Buscar usuario en el sistema"
            aria-label="Buscar usuario en el sistema"
            className="absolute right-1.5 top-1/2 -translate-y-1/2 flex h-5.5 w-5.5 items-center justify-center rounded text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition-colors cursor-pointer"
          >
            <Users className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
      {fieldError ? (
        <p className="mt-0.5 px-0.5 text-[10px] font-medium leading-snug text-brand-red-dark">
          {fieldError}
        </p>
      ) : null}
    </div>
  );
}

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
  ticketStatus?: string;
  formHostKind?: "ticket" | "task";
  hostTaskId?: number;
  hostTaskStatus?: string;
  onTicketStatusChanged?: () => void;
  onClose: () => void;
  onSaved: (sheet: CorrectiveActionSheet) => void;
}

/**
 * PF-FOR-109 · Hecho, Causa y Acción — flujo editorial en 4 pasos,
 * alineado al formato empresarial y en la línea visual de discrepancia de cargas.
 */
const EMPTY_PLANTS: Plant[] = [];

export function HcaFormModal({
  inline = false,
  sheet,
  productLines,
  defaults,
  fixedTicketLabel,
  ticketClientName,
  ticketProductLineId,
  ticketProducts,
  ticketStatus,
  formHostKind = "ticket",
  hostTaskId,
  hostTaskStatus,
  onTicketStatusChanged,
  onClose,
  onSaved,
}: HcaFormModalProps) {
  const isEdit = sheet !== undefined;
  const contextCodeLabel = formHostKind === "task" ? "Tarea" : "Ticket";
  const draftTicketId = defaults?.ticketId ?? null;
  const draftStorageKey =
    !isEdit && draftTicketId ? enterpriseFormDraftKey("pf109", draftTicketId) : null;
  const draftLoadedRef = useRef(false);
  const { user } = useAuth();
  const receipts = useReceipts();
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [saveDraftConfirmOpen, setSaveDraftConfirmOpen] = useState(false);
  // Catálogo compartido con la lista; si falla, queda vacío como antes.
  const plants = usePlantsCatalog().data ?? EMPTY_PLANTS;
  const [loadingExtras, setLoadingExtras] = useState(isEdit);
  const originalParticipants = useRef<HcaParticipant[]>(sheet?.participants ?? []);
  const savedResultRef = useRef<CorrectiveActionSheet | null>(null);

  const [showClosePrompt, setShowClosePrompt] = useState(false);
  const [completedSheet, setCompletedSheet] = useState<CorrectiveActionSheet | null>(null);

  const elaboradoLabel =
    sheet?.createdByName ??
    ([user?.firstName, user?.lastName].filter(Boolean).join(" ") || user?.email || "Usuario actual");

  const {
    control,
    register,
    handleSubmit,
    getValues,
    reset,
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
      participants: isEdit ? [emptyParticipant()] : [defaultCreatorParticipant(user)],
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
  const causeKeys = useMemo(
    () => causeFields.fields.map((field) => field.id),
    [causeFields.fields],
  );
  const causeMotion = useAppleListMotion(causeKeys, {
    minItems: 1,
    enterMs: COMPOSER_FIELD_ENTER_MS,
    exitMs: COMPOSER_FIELD_EXIT_MS,
  });
  const planTextareaRefs = useRef<Map<string, HTMLTextAreaElement>>(new Map());
  const planKeys = useMemo(
    () => planFields.fields.map((field) => field.id),
    [planFields.fields],
  );
  const planMotion = useAppleListMotion(planKeys, {
    minItems: 1,
    enterMs: COMPOSER_FIELD_ENTER_MS,
    exitMs: COMPOSER_FIELD_EXIT_MS,
  });
  const planItemsWatch = useWatch({ control, name: "planItems" });
  /** Etiqueta del responsable en filas cargadas del servidor (modo sistema). */
  const planStaffLabelsRef = useRef<Record<number, string>>({});
  const [planStaffPickLabels, setPlanStaffPickLabels] = useState<Record<string, string>>({});
  const [participantPickLabels, setParticipantPickLabels] = useState<Record<string, string>>({});
  const [removingParticipantIds, setRemovingParticipantIds] = useState<Set<string>>(() => new Set());
  const [participantEnterIds, setParticipantEnterIds] = useState<Set<string>>(() => new Set());
  const prevParticipantFieldIdsRef = useRef<string[] | null>(null);
  const participantRemoveTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const commentsTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const commentsValue = useWatch({ control, name: "comments" }) ?? "";

  const hcaValues = useWatch({ control });

  const hcaStepMissing = useMemo(
    () =>
      getHcaStepMissing(
        step as 1 | 2 | 3 | 4,
        hcaValues as unknown as HcaStepValues,
      ),
    [step, hcaValues],
  );

  async function invalidateHcaStep() {
    if (step === 1) {
      await trigger([
        "detectedAt",
        "responsibleMode",
        "responsibleStaffId",
        "responsibleManualName",
      ]);
    } else if (step === 2) {
      await trigger(["description", "causes"]);
    } else if (step === 3) {
      await trigger("planItems");
    } else {
      await trigger();
    }
  }

  function focusHcaField(fieldId: string) {
    if (
      fieldId === "detectedAt" ||
      fieldId === "responsibleStaffId" ||
      fieldId === "responsibleManualName"
    ) {
      if (step !== 1) setStep(1);
    } else if (
      fieldId === "description" ||
      fieldId === "causes" ||
      fieldId.startsWith("causes.")
    ) {
      if (step !== 2) setStep(2);
    } else if (fieldId === "planItems" || fieldId.startsWith("planItems.")) {
      if (step !== 3) setStep(3);
    } else {
      if (step !== 4) setStep(4);
    }
    setTimeout(() => focusFormFieldByName(fieldId), 60);
  }

  const responsibleMode = useWatch({ control, name: "responsibleMode" }) ?? "sistema";

  function handlePlanStaffPickLabel(rowId: string, label: string | null) {
    setPlanStaffPickLabels((prev) => {
      if (label === null || label === "") {
        if (prev[rowId] === undefined) return prev;
        const next = { ...prev };
        delete next[rowId];
        return next;
      }
      if (prev[rowId] === label) return prev;
      return { ...prev, [rowId]: label };
    });
  }

  useEffect(() => {
    return () => {
      for (const timer of participantRemoveTimers.current.values()) clearTimeout(timer);
      participantRemoveTimers.current.clear();
    };
  }, []);

  useEffect(() => {
    const ids = participantFields.fields.map((field) => field.id);
    if (prevParticipantFieldIdsRef.current === null) {
      prevParticipantFieldIdsRef.current = ids;
      return;
    }
    const added = ids.filter((id) => !prevParticipantFieldIdsRef.current!.includes(id));
    if (added.length > 0 && !prefersReducedMotion()) {
      setParticipantEnterIds((prev) => {
        const next = new Set(prev);
        for (const id of added) next.add(id);
        return next;
      });
    }
    prevParticipantFieldIdsRef.current = ids;
  }, [participantFields.fields]);

  useLayoutEffect(() => {
    if (step !== 2) return;
    autoResizeTextarea(descriptionTextareaRef.current, 96);
    autoResizeTextarea(immediateActionTextareaRef.current, 64);
    for (const element of causeTextareaRefs.current.values()) {
      autoResizeTextarea(element, HCA_CAUSE_LINE_MIN_PX);
    }
  }, [step, descriptionValue, immediateActionValue, causesWatch, causeFields.fields.length]);

  useLayoutEffect(() => {
    if (step !== 3) return;
    for (const element of planTextareaRefs.current.values()) {
      autoResizeTextarea(element, HCA_CAUSE_LINE_MIN_PX);
    }
  }, [step, planItemsWatch, planFields.fields.length]);

  useLayoutEffect(() => {
    if (step !== 4) return;
    autoResizeTextarea(commentsTextareaRef.current, HCA_CAUSE_LINE_MIN_PX);
  }, [step, commentsValue, participantFields.fields.length]);

  const commentsField = register("comments");

  function handleAddCause() {
    if (causeFields.fields.length >= 20) return;
    causeFields.append({ text: "" });
  }

  function handleRemoveCause(fieldId: string) {
    if (causeFields.fields.length <= 1) return;
    causeMotion.requestRemove(fieldId, () => {
      const currentIndex = causeFields.fields.findIndex((f) => f.id === fieldId);
      if (currentIndex >= 0) {
        causeFields.remove(currentIndex);
        causeTextareaRefs.current.delete(fieldId);
      }
    });
  }

  function handleAddPlanRow() {
    if (planFields.fields.length >= 20) return;
    planFields.append(emptyPlanRow());
  }

  function handleRemovePlanRow(fieldId: string) {
    if (planFields.fields.length <= 1) return;
    planMotion.requestRemove(fieldId, () => {
      const currentIndex = planFields.fields.findIndex((f) => f.id === fieldId);
      if (currentIndex >= 0) {
        planFields.remove(currentIndex);
        planTextareaRefs.current.delete(fieldId);
      }
    });
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
          const staffLabels: Record<number, string> = {};
          for (const item of planRes.items) {
            if (item.responsibleStaffId != null) {
              staffLabels[item.id] = item.responsibleName;
            }
          }
          planStaffLabelsRef.current = staffLabels;
          planFields.replace(
            planRes.items.map((item) => ({
              serverId: item.id,
              description: item.description,
              responsibleMode:
                item.responsibleStaffId != null ? ("sistema" as const) : ("manual" as const),
              responsibleStaffId:
                item.responsibleStaffId != null ? String(item.responsibleStaffId) : "",
              responsibleManualName: item.responsibleManualName ?? "",
              dueDate: item.dueDate,
              evidenceNotes: item.evidenceNotes ?? "",
            })),
          );
        }
        originalParticipants.current = sheet.participants;
        if (sheet.participants.length > 0) {
          participantFields.replace(
            sheet.participants.slice(0, 2).map((p) => ({
              serverId: p.id,
              kind: p.staffId ? ("personal" as const) : ("manual" as const),
              staffId: p.staffId ? String(p.staffId) : "",
              name: p.name,
            })),
          );
        } else {
          participantFields.replace([defaultCreatorParticipant(user)]);
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
    return detectedAt;
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

  useEffect(() => {
    if (!draftStorageKey || draftLoadedRef.current) return;
    const draft = readEnterpriseFormDraft<{ step?: number; values?: FormValues }>(draftStorageKey);
    if (!draft?.values) return;
    draftLoadedRef.current = true;
    reset(draft.values);
    if (typeof draft.step === "number" && draft.step >= 1 && draft.step <= 4) {
      setStep(draft.step as 1 | 2 | 3 | 4);
    }
  }, [draftStorageKey, reset]);

  function handleSaveDraft() {
    if (!draftStorageKey || isSubmitting) return;
    const ticketLabelShort = fixedTicketLabel?.split(" ")[0] ?? "";
    if (!writeEnterpriseFormDraft(draftStorageKey, { step, values: getValues() })) {
      receipts.failed({
        action: "guardar-borrador-hca",
        title: "No se pudo guardar el borrador",
        detail: "Revisa el espacio del navegador e inténtalo de nuevo.",
      });
      return;
    }
    receipts.done({
      action: "guardar-borrador-hca",
      title: "Borrador guardado",
      detail: `${HCA_FORM_CONTROL.code}${ticketLabelShort ? ` · ${ticketLabelShort}` : ""}`,
    });
  }

  async function handleNextStep() {
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

  function handleParticipantPickLabel(rowId: string, label: string | null) {
    setParticipantPickLabels((current) => {
      if (!label) {
        const next = { ...current };
        delete next[rowId];
        return next;
      }
      return { ...current, [rowId]: label };
    });
  }

  function handleAddParticipant() {
    if (participantFields.fields.length >= 2) return;
    participantFields.append(emptyParticipant());
  }

  function handleRemoveParticipant(index: number) {
    if (index <= 0) return;
    const fieldId = participantFields.fields[index]?.id;
    if (!fieldId) {
      participantFields.remove(index);
      return;
    }
    if (removingParticipantIds.has(fieldId)) return;

    if (prefersReducedMotion()) {
      participantFields.remove(index);
      setParticipantPickLabels((prev) => {
        if (prev[fieldId] === undefined) return prev;
        const next = { ...prev };
        delete next[fieldId];
        return next;
      });
      return;
    }

    setRemovingParticipantIds((prev) => new Set(prev).add(fieldId));
    const timer = setTimeout(() => {
      const currentIndex = participantFields.fields.findIndex((field) => field.id === fieldId);
      if (currentIndex >= 0) participantFields.remove(currentIndex);
      setRemovingParticipantIds((prev) => {
        const next = new Set(prev);
        next.delete(fieldId);
        return next;
      });
      setParticipantPickLabels((prev) => {
        if (prev[fieldId] === undefined) return prev;
        const next = { ...prev };
        delete next[fieldId];
        return next;
      });
      participantRemoveTimers.current.delete(fieldId);
    }, LIST_ROW_REMOVE_MS);
    participantRemoveTimers.current.set(fieldId, timer);
  }

  function handleParticipantKindChange(index: number, newKind: "personal" | "manual") {
    const current = getValues(`participants.${index}.kind`);
    if (current === newKind) return;
    setValue(`participants.${index}.kind`, newKind, { shouldDirty: true, shouldValidate: true });
    if (newKind === "manual") {
      setValue(`participants.${index}.staffId`, "");
    } else {
      setValue(`participants.${index}.name`, "");
    }
  }

  function handlePlanResponsibleModeChange(index: number, newMode: "sistema" | "manual") {
    const current = getValues(`planItems.${index}.responsibleMode`);
    if (current === newMode) return;
    setValue(`planItems.${index}.responsibleMode`, newMode, {
      shouldDirty: true,
      shouldValidate: true,
    });
    if (newMode === "manual") {
      setValue(`planItems.${index}.responsibleStaffId`, "");
    } else {
      setValue(`planItems.${index}.responsibleManualName`, "");
    }
  }

  async function syncPlanItems(sheetId: number, rows: PlanRowValues[]) {
    const filled = rows.filter((row) => {
      if (row.description.trim().length < 10 || row.dueDate === "") return false;
      if (row.responsibleMode === "sistema") return row.responsibleStaffId !== "";
      return row.responsibleManualName.trim().length >= 3;
    });
    for (const row of filled) {
      const payload = {
        description: row.description.trim(),
        responsibleStaffId:
          row.responsibleMode === "sistema" ? Number(row.responsibleStaffId) : null,
        responsibleManualName:
          row.responsibleMode === "manual" ? row.responsibleManualName.trim() : null,
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
    const immediateAction = values.immediateAction.trim();
    const comments = values.comments.trim();

    const clientId = resolveClientId(values);
    const productLineId = resolveProductLineId(values);
    const dueDate = resolveDueDate(values.detectedAt, values.dueDate);

    if (clientId === "") {
      receipts.failed({
        action: "hca-cliente",
        title: "Cliente requerido",
        detail: "El ticket debe tener cliente asociado para registrar la HCA.",
      });
      return;
    }
    if (productLineId === "") {
      receipts.failed({
        action: "hca-linea",
        title: "Línea de producto requerida",
        detail: "No hay línea de producto disponible para esta HCA.",
      });
      return;
    }
    if (dueDate < values.detectedAt) {
      receipts.failed({
        action: "hca-fechas",
        title: "Fechas inconsistentes",
        detail: "La fecha de cierre no puede ser anterior a la del hecho.",
      });
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
      clearEnterpriseFormDraft(draftStorageKey);
      receipts.done({
        action: "guardar-hca",
        title: isEdit ? "HCA actualizada" : "HCA creada",
        detail: `PF-FOR-109 · ${detail.sheet.number}`,
      });

      const effectiveTicketId = Number(detail.sheet.ticketId ?? defaults?.ticketId ?? 0);

      if (
        shouldPromptEnterpriseFormHostClose(
          formHostKind,
          effectiveTicketId,
          hostTaskId,
          ticketStatus,
          hostTaskStatus,
        )
      ) {
        setCompletedSheet(detail.sheet);
        setShowClosePrompt(true);
      } else {
        finishModal(detail.sheet);
      }
    } catch (err) {
      const fallback = isEdit ? "No se pudo guardar la HCA" : "No se pudo crear la HCA";
      const msg = err instanceof ApiError ? err.message : fallback;
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
    step === 1
      ? "max-w-3xl"
      : step === 2
      ? "max-w-4xl"
      : step === 4
      ? "max-w-3xl"
      : "w-full max-w-[min(96vw,96rem)]";

  const stepLabels: Record<typeof step, { title: string; hint: string }> = {
    1: { title: "Identificación", hint: "Código, fechas y responsables" },
    2: { title: "Hecho y causas", hint: "Descripción del hallazgo" },
    3: { title: "Plan de acción", hint: "Qué, quién y cuándo" },
    4: { title: "Participantes", hint: "Elaboró, otro participante y comentarios" },
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
          {contextCodeLabel} vinculada:{" "}
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
        <div className="space-y-4">
          {causeFields.fields.map((field, index) => {
            const causeField = register(`causes.${index}.text`);
            const causeFieldId = `hca-cause-${field.id}`;
            const causeLabel = index === 0 ? "Causa identificada" : `Causa ${index + 1}`;
            const causeError = errors.causes?.[index]?.text?.message;
            const phase = causeMotion.phaseFor(field.id);
            const isExiting = causeMotion.isExiting(field.id);

            return (
              <AppleMotionBlock key={field.id} phase={phase} rowPreset="composer">
                <div className="space-y-1.5 pb-0.5">
                  <div className="flex h-6 items-center justify-between">
                    <label
                      htmlFor={causeFieldId}
                      className="flex items-center gap-1.5 font-heading text-xs font-semibold tracking-wide text-zinc-700"
                    >
                      <span className="font-mono text-[11px] font-bold text-zinc-400">
                        {index + 1}.
                      </span>
                      <span>{causeLabel}</span>
                    </label>
                    {causeFields.fields.length > 1 ? (
                      <button
                        type="button"
                        title={`Quitar ${causeLabel.toLowerCase()}`}
                        aria-label={`Quitar ${causeLabel.toLowerCase()}`}
                        disabled={isExiting}
                        onClick={() => handleRemoveCause(field.id)}
                        className="inline-flex size-6 cursor-pointer items-center justify-center rounded-md text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-brand-red active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    ) : (
                      <div className="size-6" aria-hidden="true" />
                    )}
                  </div>
                  <textarea
                    id={causeFieldId}
                    rows={1}
                    aria-invalid={causeError !== undefined}
                    placeholder="Describe una causa raíz o factor contribuyente…"
                    className={`w-full rounded-edge border bg-white px-3 py-2.5 text-[13px] leading-relaxed text-ink outline-none transition-colors placeholder:text-faint ${
                      causeError
                        ? "border-brand-red bg-brand-red/[0.02] focus:ring-3 focus:ring-brand-red/10"
                        : "border-line-strong hover:border-hairline-hover focus:border-brand-red focus:ring-3 focus:ring-brand-red/10"
                    } ${HCA_TEXTAREA_AUTO}`}
                    {...bindAutoResizeTextarea(causeField, HCA_CAUSE_LINE_MIN_PX, (element) => {
                      if (element) causeTextareaRefs.current.set(field.id, element);
                      else causeTextareaRefs.current.delete(field.id);
                    })}
                  />
                  {causeError ? (
                    <p className="animate-plf-shake text-[11px] font-medium text-brand-red-dark leading-none">
                      {causeError}
                    </p>
                  ) : null}
                </div>
              </AppleMotionBlock>
            );
          })}
          {typeof errors.causes?.message === "string" && (
            <p className="text-[11.5px] font-medium text-brand-red">{errors.causes.message}</p>
          )}
          {causeFields.fields.length < 20 && (
            <div className="pt-0.5">
              <Button type="button" size="sm" variant="secondary" onClick={handleAddCause}>
                <Plus className="h-3.5 w-3.5" />
                Agregar causa
              </Button>
            </div>
          )}
        </div>
      </HcaFormBlock>
    </div>
  );

function PlanMotionCell({
  phase,
  className = "",
  innerClassName = "",
  children,
}: {
  phase: AppleListPhase;
  className?: string;
  innerClassName?: string;
  children: React.ReactNode;
}) {
  const collapsed = phase === "from" || phase === "hold" || phase === "out" || phase === "arm";
  const ready = phase === "hold" || phase === "in" || phase === "arm" || phase === "out";
  const motion = phase === "out" || phase === "arm" ? "out" : phase === "idle" ? "idle" : "in";
  return (
    <td className={`!py-0 ${className}`}>
      <div
        className="plf-composer-row-shell"
        data-collapsed={collapsed ? "true" : "false"}
        data-ready={ready ? "true" : "false"}
        data-motion={motion}
      >
        <div className="plf-apple-row-clip">
          <div
            className={`${innerClassName} ${
              phase === "in"
                ? "animate-plf-composer-row-in"
                : phase === "out"
                  ? "animate-plf-composer-row-out"
                  : phase === "from" || phase === "hold"
                    ? "opacity-0"
                    : ""
            }`}
          >
            {children}
          </div>
        </div>
      </div>
    </td>
  );
}

  const renderStep3 = () => (
    <div className="flex w-full flex-col gap-4 animate-plf-fade">
      {loadingExtras && isEdit && (
        <p className="text-xs text-zinc-500 text-center">Cargando plan de acción…</p>
      )}
      <HcaFormBlock label="Plan de acción">
        <div className="-mx-1 w-full overflow-x-auto sm:-mx-0">
          <table className="w-full min-w-0 table-fixed border-collapse text-[13px]">
            <colgroup>
              <col className="w-9" />
              <col />
              <col className="w-[17rem]" />
              <col className="w-[11rem]" />
              <col className="w-9" />
            </colgroup>
            <thead>
              <tr className="border-b border-zinc-200/90 bg-zinc-50/70">
                <th className="py-2 pl-2 text-center font-heading text-[10px] font-bold uppercase tracking-[0.08em] text-zinc-500">
                  #
                </th>
                <th className="border-l border-zinc-200/80 px-3 py-2 text-left font-heading text-[10px] font-bold uppercase tracking-[0.08em] text-zinc-500">
                  Acción (qué)
                </th>
                <th className="border-l border-zinc-200/80 px-3 py-2 text-left font-heading text-[10px] font-bold uppercase tracking-[0.08em] text-zinc-500">
                  Quién
                </th>
                <th className="border-l border-zinc-200/80 px-2 py-2 text-left font-heading text-[10px] font-bold uppercase tracking-[0.08em] text-zinc-500">
                  Cuándo
                </th>
                <th className="border-l border-zinc-200/80" aria-hidden />
              </tr>
            </thead>
            <tbody>
              {planFields.fields.map((planField, index) => {
                const planErrors = errors.planItems?.[index];
                const descriptionField = register(`planItems.${index}.description`);
                const phase = planMotion.phaseFor(planField.id);
                const isExiting = planMotion.isExiting(planField.id);
                return (
                  <tr
                    key={planField.id}
                    className="border-b border-zinc-100/90 transition-colors hover:bg-zinc-50/40"
                  >
                    <PlanMotionCell
                      phase={phase}
                      innerClassName="py-2.5 pl-2 flex items-center justify-center min-h-[38px]"
                      className="align-middle text-center"
                    >
                      <span className="font-heading text-[11.5px] font-normal tabular-nums leading-none text-zinc-400">
                        {index + 1}
                      </span>
                    </PlanMotionCell>
                    <PlanMotionCell
                      phase={phase}
                      innerClassName="px-2 py-1.5"
                      className="align-top border-l border-zinc-100"
                    >
                      <div className={HCA_TABLE_FIELD}>
                        <textarea
                          rows={1}
                          aria-label={`Acción ${index + 1}`}
                          placeholder="Qué se hará para corregir o prevenir…"
                          className={`w-full rounded-md border bg-white px-2.5 py-2 text-[13px] leading-relaxed text-ink outline-none transition-colors placeholder:text-faint ${
                            planErrors?.description?.message
                              ? "border-brand-red bg-brand-red/[0.02] focus:ring-2 focus:ring-brand-red/10"
                              : "border-transparent hover:border-zinc-200 focus:border-brand-red/40 focus:ring-2 focus:ring-brand-red/10"
                          } ${HCA_TEXTAREA_AUTO}`}
                          {...bindAutoResizeTextarea(descriptionField, HCA_CAUSE_LINE_MIN_PX, (element) => {
                            if (element) planTextareaRefs.current.set(planField.id, element);
                            else planTextareaRefs.current.delete(planField.id);
                          })}
                        />
                        {planErrors?.description?.message ? (
                          <p className="px-0.5 text-[10px] font-medium leading-snug text-brand-red-dark">
                            {planErrors.description.message}
                          </p>
                        ) : null}
                      </div>
                    </PlanMotionCell>
                    <PlanMotionCell
                      phase={phase}
                      innerClassName="px-1 py-1.5"
                      className="align-top border-l border-zinc-100"
                    >
                      <span id={`hca-plan-who-label-${index}`} className="sr-only">
                        Quién · acción {index + 1}
                      </span>
                      <HcaPlanWhoCell
                        index={index}
                        rowId={planField.id}
                        control={control}
                        register={register}
                        planErrors={planErrors}
                        pickLabel={planStaffPickLabels[planField.id]}
                        staffLabel={
                          planField.serverId != null
                            ? planStaffLabelsRef.current[planField.serverId]
                            : undefined
                        }
                        onPickLabel={handlePlanStaffPickLabel}
                        onModeChange={handlePlanResponsibleModeChange}
                      />
                    </PlanMotionCell>
                    <PlanMotionCell
                      phase={phase}
                      innerClassName="px-1 py-1.5"
                      className="align-top border-l border-zinc-100"
                    >
                      <div className={`${HCA_TABLE_FIELD} w-full min-w-0`}>
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
                              className="w-full"
                              error={planErrors?.dueDate?.message}
                            />
                          )}
                        />
                      </div>
                    </PlanMotionCell>
                    <PlanMotionCell
                      phase={phase}
                      innerClassName="px-1 py-1.5 flex items-center justify-center min-h-[38px]"
                      className="align-middle border-l border-zinc-100 text-center"
                    >
                      {planFields.fields.length > 1 ? (
                        <button
                          type="button"
                          title="Quitar acción"
                          aria-label="Quitar acción"
                          disabled={isExiting}
                          onClick={() => handleRemovePlanRow(planField.id)}
                          className="inline-flex size-7 cursor-pointer items-center justify-center rounded-md text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-brand-red active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      ) : (
                        <div className="size-7" aria-hidden="true" />
                      )}
                    </PlanMotionCell>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {planFields.fields.length < 20 && (
          <div className="mt-3 border-t border-zinc-100 pt-3">
            <Button type="button" size="sm" variant="secondary" onClick={handleAddPlanRow}>
              <Plus className="h-3.5 w-3.5" />
              Agregar acción
            </Button>
          </div>
        )}
      </HcaFormBlock>

      <HcaFormBlock label="Evidencias">
        <p className="text-xs text-zinc-500 mb-3 leading-relaxed">
          Describe cómo se implementó cada acción. Los archivos adjuntos se gestionan desde la ficha de la HCA
          una vez guardada.
        </p>
        <div className="space-y-3">
          {planFields.fields.map((field, index) => {
            const phase = planMotion.phaseFor(field.id);
            return (
              <AppleMotionBlock key={field.id} phase={phase} rowPreset="composer">
                <div className="rounded-lg border border-zinc-100 bg-zinc-50/40 p-3">
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
              </AppleMotionBlock>
            );
          })}
        </div>
      </HcaFormBlock>
    </div>
  );

  const renderStep4 = () => {
    const elaboroField = participantFields.fields[0];
    const elaboroRow = elaboroField ? getValues("participants.0") : undefined;
    let elaboroStaffLabel: string | undefined;
    if (elaboroRow?.kind === "personal" && elaboroRow.staffId !== "") {
      if (elaboroRow.staffId === String(user?.staffId ?? "")) {
        elaboroStaffLabel = elaboradoLabel;
      } else if (elaboroRow.name.trim() !== "") {
        elaboroStaffLabel = elaboroRow.name.trim();
      }
    }

    const fieldLabelClass = "mb-1 block font-heading text-[11.5px] font-semibold text-faint";
    const participantActionCol = "1.75rem";

    return (
      <div className="animate-plf-fade mx-auto w-full max-w-3xl">
        <div className="overflow-hidden rounded-xl border border-zinc-200/90 bg-white shadow-2xs">
          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] lg:items-stretch lg:divide-x lg:divide-zinc-100">
            <div className="min-w-0 p-3 sm:p-4">
              <div
                className="grid gap-x-1 gap-y-2"
                style={{ gridTemplateColumns: `minmax(0, 1fr) ${participantActionCol}` }}
              >
                {elaboroField ? (
                  <>
                    <div
                      className="flex items-center justify-between gap-2"
                      style={{ gridColumn: "1 / -1" }}
                    >
                      <label
                        htmlFor={`hca-participant-${elaboroField.id}`}
                        className="font-heading text-[11.5px] font-semibold text-faint"
                      >
                        Elaboró
                        <span className="ml-1 font-normal text-zinc-400">· tu usuario</span>
                      </label>
                      {participantFields.fields.length < 2 ? (
                        <button
                          type="button"
                          onClick={handleAddParticipant}
                          className="inline-flex shrink-0 items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-800"
                        >
                          <Plus className="h-3.5 w-3.5" aria-hidden />
                          Otro
                        </button>
                      ) : null}
                    </div>
                    <div className="min-w-0">
                      <HcaParticipantWhoCell
                        index={0}
                        rowId={elaboroField.id}
                        control={control}
                        register={register}
                        rowErrors={errors.participants?.[0]}
                        pickLabel={participantPickLabels[elaboroField.id]}
                        staffLabel={elaboroStaffLabel}
                        onPickLabel={handleParticipantPickLabel}
                        onKindChange={handleParticipantKindChange}
                      />
                    </div>
                    <span className="h-7 w-7 shrink-0 self-center" aria-hidden />
                  </>
                ) : null}

                {participantFields.fields.slice(1).map((field, sliceIndex) => {
                  const index = sliceIndex + 1;
                  const row = getValues(`participants.${index}`);
                  let staffLabel: string | undefined;
                  if (row?.kind === "personal" && row.staffId !== "") {
                    if (row.staffId === String(user?.staffId ?? "")) {
                      staffLabel = elaboradoLabel;
                    } else if (row.name.trim() !== "") {
                      staffLabel = row.name.trim();
                    }
                  }
                  const exiting = removingParticipantIds.has(field.id);
                  const entering = participantEnterIds.has(field.id);
                  return (
                    <div
                      key={field.id}
                      className={`col-span-full grid gap-x-1 gap-y-1 ${
                        exiting
                          ? "animate-plf-list-row-out"
                          : entering
                          ? "animate-plf-list-row-in"
                          : ""
                      }`}
                      style={{ gridTemplateColumns: `minmax(0, 1fr) ${participantActionCol}` }}
                    >
                      <label
                        htmlFor={`hca-participant-${field.id}`}
                        className={fieldLabelClass}
                        style={{ gridColumn: "1 / -1" }}
                      >
                        Otro
                      </label>
                      <div className="min-w-0">
                        <HcaParticipantWhoCell
                          index={index}
                          rowId={field.id}
                          control={control}
                          register={register}
                          rowErrors={errors.participants?.[index]}
                          pickLabel={participantPickLabels[field.id]}
                          staffLabel={staffLabel}
                          onPickLabel={handleParticipantPickLabel}
                          onKindChange={handleParticipantKindChange}
                        />
                      </div>
                      <div className="flex self-center justify-center">
                        <RowAction
                          label="Quitar participante"
                          icon={Trash2}
                          danger
                          disabled={exiting}
                          onClick={() => handleRemoveParticipant(index)}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex min-h-0 min-w-0 flex-col border-t border-zinc-100 p-3 sm:p-4 lg:border-t-0">
              <label htmlFor="hca-comments" className={fieldLabelClass}>
                Comentarios
              </label>
              <textarea
                id="hca-comments"
                rows={1}
                placeholder="Acuerdos de seguimiento o notas para el cierre…"
                aria-invalid={errors.comments?.message !== undefined}
                className={`min-h-[42px] w-full flex-1 rounded-edge border bg-white px-3 py-2.5 text-[13px] leading-relaxed text-ink outline-none transition-colors placeholder:text-faint lg:min-h-[42px] ${
                  errors.comments?.message
                    ? "border-brand-red bg-brand-red/[0.02] focus:ring-3 focus:ring-brand-red/10"
                    : "border-line-strong hover:border-hairline-hover focus:border-brand-red focus:ring-3 focus:ring-brand-red/10"
                } ${HCA_TEXTAREA_AUTO}`}
                {...bindAutoResizeTextarea(commentsField, HCA_CAUSE_LINE_MIN_PX, (element) => {
                  commentsTextareaRef.current = element;
                })}
              />
              {errors.comments?.message ? (
                <p className="mt-1 text-[10px] font-medium leading-snug text-brand-red-dark">
                  {errors.comments.message}
                </p>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderSaveDraftConfirmModal = () =>
    saveDraftConfirmOpen ? (
      <EnterpriseFormSaveDraftConfirmModal
        open
        formCode={HCA_FORM_CONTROL.code}
        ticketLabel={fixedTicketLabel?.split(" ")[0]}
        onClose={() => setSaveDraftConfirmOpen(false)}
        onConfirm={() => {
          handleSaveDraft();
          setSaveDraftConfirmOpen(false);
        }}
      />
    ) : null;

  const renderClosePromptModal = () => {
    if (!showClosePrompt || !completedSheet) return null;
    const effectiveTicketId = Number(completedSheet.ticketId ?? defaults?.ticketId ?? 0);
    const rawNumber = completedSheet.number || "";
    const cleanNumber = rawNumber.replace(/^HCA\s*[-–—]?\s*/i, "");
    const sheetCode = cleanNumber ? `HCA-${cleanNumber}` : rawNumber;

    const taskNumberLabel = fixedTicketLabel?.split(" · ")[0]?.trim() ?? fixedTicketLabel?.split(" ")[0] ?? "Tarea";

    if (formHostKind === "task" && hostTaskId) {
      return (
        <EnterpriseFormCompleteTaskModal
          open={showClosePrompt}
          taskId={hostTaskId}
          taskNumber={taskNumberLabel}
          formCode="PF-FOR-109"
          recordNumber={sheetCode}
          defaultComment={`Completada tras registrar ${sheetCode}`}
          onClose={() => finishModal(completedSheet)}
          onSuccess={() => onTicketStatusChanged?.()}
        />
      );
    }

    return (
      <EnterpriseFormCloseTicketModal
        open={showClosePrompt}
        ticketId={effectiveTicketId}
        formCode="PF-FOR-109"
        recordNumber={sheetCode}
        descriptionText="La HCA ha sido registrada exitosamente. Puedes dar por concluido y cerrar este ticket indicando el veredicto oficial y el comentario de resolución."
        defaultReason={`Cerrado tras completar ${sheetCode}`}
        receiptDetail={`El ticket ha sido marcado como solucionado en base a ${sheetCode}.`}
        onClose={() => finishModal(completedSheet)}
        onSuccess={() => onTicketStatusChanged?.()}
        onTicketStatusChanged={onTicketStatusChanged}
      />
    );
  };

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
    <div className="ml-auto flex shrink-0 items-center gap-2">
      {step > 1 ? (
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => setStep((step - 1) as typeof step)}
        >
          <ChevronLeft className="size-3.5 shrink-0" />
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
          key={`hca-next-${step}`}
          ready={hcaStepMissing.length === 0}
          busy={isSubmitting}
          missingItems={hcaStepMissing}
          onSubmit={() => void handleNextStep()}
          onInvalidClick={() => void invalidateHcaStep()}
          onFocusField={focusHcaField}
          blockTitle="No se puede continuar"
          hintText="Para avanzar al siguiente paso, completa lo siguiente:"
          shortcutLabel={null}
        >
          <span>Siguiente paso</span>
          <ChevronRight className="h-3.5 w-3.5" />
        </SubmitValidationButton>
      ) : (
        <SubmitValidationButton
          key="hca-submit"
          formId="hca-form"
          ready={hcaStepMissing.length === 0}
          busy={isSubmitting}
          missingItems={hcaStepMissing}
          onInvalidClick={() => void invalidateHcaStep()}
          onFocusField={focusHcaField}
          blockTitle="No se puede registrar"
          hintText="Para registrar la HCA, completa lo siguiente:"
          shortcutLabel="Ctrl + ↵"
        >
          {isEdit ? "Guardar cambios" : "Crear HCA"}
        </SubmitValidationButton>
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
        {renderClosePromptModal()}
        {renderSaveDraftConfirmModal()}
      </div>
    );
  }

  return (
    <>
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
    {renderClosePromptModal()}
    {renderSaveDraftConfirmModal()}
    </>
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
