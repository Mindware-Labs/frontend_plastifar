import {
  ArrowLeft,
  Check,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  RotateCcw,
} from "lucide-react";
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { ApiError } from "../../api/client";
import { ticketsApi } from "../../api/tickets";
import { withdrawalsApi } from "../../api/withdrawals";
import { SubmitValidationButton } from "../../components/app/SubmitValidationButton";
import { EnterpriseFormCloseTicketModal } from "../../components/app/EnterpriseFormCloseTicketModal";
import { EnterpriseFormSaveDraftButton } from "../../components/app/EnterpriseFormSaveDraftButton";
import { EnterpriseFormSaveDraftConfirmModal } from "../../components/app/EnterpriseFormSaveDraftConfirmModal";
import { Alert } from "../../components/ui/Alert";
import { Button } from "../../components/ui/Button";
import { DateField, LookupField, SelectField } from "../../components/ui/Field";
import { Modal } from "../../components/ui/Modal";
import { useReceipts } from "../../context/useReceipts";
import { useDialogMotion } from "../../hooks/useDialogMotion";
import { useModalAnimation } from "../../hooks/useModalAnimation";
import { resolveTicketLabel, searchTickets } from "../../lib/discrepancies";
import {
  clearEnterpriseFormDraft,
  enterpriseFormDraftKey,
  readEnterpriseFormDraft,
  writeEnterpriseFormDraft,
} from "../../lib/enterpriseFormDrafts";
import { getWithdrawalStepMissing } from "../../lib/enterpriseFormValidation";
import { focusFormField } from "../../lib/validationItems";
import { today } from "../../lib/quality";
import { computeLineValue, computeTotal, WITHDRAWAL_FORM_CONTROL } from "../../lib/withdrawals";
import { WithdrawalLinesSpreadsheet } from "./WithdrawalLinesSpreadsheet";
import type { TicketProductResponse } from "../../types/api";
import {
  WITHDRAWAL_CURRENCIES,
  WITHDRAWAL_ERROR_ORIGINS,
  WITHDRAWAL_REASONS,
  type MerchandiseWithdrawal,
  type SaveWithdrawalRequest,
  type WithdrawalDetail,
  type WithdrawalErrorOrigin,
  type WithdrawalReason,
} from "../../types/withdrawals";

interface Props {
  /** Si viene de la ficha del ticket, el ticket queda fijo; desde el listado de retiros el u... */
  ticketId?: number;
  ticketNumber?: string;
  ticketClientName?: string;
  /** Productos registrados en el ticket para priorizar en la selección. */
  ticketProducts?: TicketProductResponse[];
  /** Líneas iniciales prellenadas al migrar de otro formulario del ticket. */
  initialLines?: Array<{
    productId: string;
    quantity: string;
    quantityUnit: string;
    packDetail: string;
    unitPrice: string;
  }>;
  /** Solicitud existente cuando se entra por «Editar» (sólo en estado Solicitado, RF-W2). */
  withdrawal?: MerchandiseWithdrawal;
  /** Estado actual del ticket para preguntar si desea cerrarlo al crear la solicitud. */
  ticketStatus?: string;
  onTicketStatusChanged?: () => void;
  /** Renderiza como vista embebida a página completa en lugar de ventana modal. */
  inline?: boolean;
  onClose: () => void;
  onSaved: (detail: WithdrawalDetail) => void;
  onConflict?: (message: string) => void;
}

interface LineDraft {
  key: number;
  productId: string;
  productLabel?: string;
  quantity: string;
  quantityUnit: string;
  packDetail: string;
  unitPrice: string;
}

interface LineErrors {
  productId?: string;
  quantity?: string;
  quantityUnit?: string;
  packDetail?: string;
  unitPrice?: string;
}

interface FormErrors {
  ticketId?: string;
  requestDate?: string;
  reason?: string;
  errorOrigin?: string;
  currency?: string;
  lines?: string;
  byLine: Record<number, LineErrors>;
}

const STEPS = [
  { id: 1, label: "Solicitud", hint: "Motivo, fecha y moneda" },
  { id: 2, label: "Productos", hint: "Renglones a retirar" },
] as const;

const ERROR_ORIGIN_OPTIONS = [
  { value: "", label: "Ninguno (no requiere aprobación)" },
  ...WITHDRAWAL_ERROR_ORIGINS.map((value) => ({ value, label: value })),
];

const CURRENCY_OPTIONS = WITHDRAWAL_CURRENCIES.map((value) => ({
  value,
  label: value === "DOP" ? "DOP (RD$)" : "USD (US$)",
}));

let nextKey = 1;

function emptyLine(defaultProductId = "", productLabel?: string): LineDraft {
  return {
    key: nextKey++,
    productId: defaultProductId,
    productLabel,
    quantity: "",
    quantityUnit: "",
    packDetail: "",
    unitPrice: "",
  };
}

function lineFromWithdrawal(withdrawal: MerchandiseWithdrawal): LineDraft[] {
  if (withdrawal.lines.length === 0) return [emptyLine()];
  return [...withdrawal.lines]
    .sort((a, b) => a.position - b.position)
    .map((line) => ({
      key: nextKey++,
      productId: String(line.productId),
      productLabel: `${line.productCode} · ${line.productName}`,
      quantity: String(line.quantity),
      quantityUnit: line.quantityUnit,
      packDetail: line.packDetail ?? "",
      unitPrice: line.unitPrice !== null ? String(line.unitPrice) : "",
    }));
}

function parsePositiveDecimal(raw: string): number | null {
  const clean = raw.trim().replace(",", ".");
  if (!clean) return null;
  const num = Number(clean);
  if (!Number.isFinite(num) || num <= 0) return null;
  return num;
}

function parseOptionalPrice(raw: string): { valid: boolean; value: number | null } {
  const clean = raw.trim().replace(",", ".");
  if (!clean) return { valid: true, value: null };
  const num = Number(clean);
  if (!Number.isFinite(num) || num < 0) return { valid: false, value: null };
  return { valid: true, value: num };
}

/** RF-W1 / RF-W2 / PF-FOR-068: asistente por pasos para registrar o editar la Solicitud de... */
export function WithdrawalFormModal({
  ticketId: fixedTicketId,
  ticketNumber: fixedTicketNumber,
  ticketClientName: fixedClientName,
  ticketProducts = [],
  initialLines,
  withdrawal,
  ticketStatus,
  onTicketStatusChanged,
  inline = false,
  onClose,
  onSaved,
  onConflict,
}: Props) {
  const receipts = useReceipts();
  const isEditing = Boolean(withdrawal);
  const lockedTicketId = fixedTicketId ?? withdrawal?.ticketId;
  const activeTicketId = lockedTicketId ?? 0;
  const draftStorageKey =
    !isEditing && activeTicketId > 0 ? enterpriseFormDraftKey("pf068", activeTicketId) : null;

  const [step, setStep] = useState<number>(1);
  const [stepDirection, setStepDirection] = useState<"forward" | "backward">("forward");
  const [selectedTicketId, setSelectedTicketId] = useState<string>(lockedTicketId ? String(lockedTicketId) : "");
  const [requestDate, setRequestDate] = useState(withdrawal?.requestDate ?? today());
  const [reason, setReason] = useState<WithdrawalReason>(withdrawal?.reason ?? WITHDRAWAL_REASONS[0]);
  const [errorOrigin, setErrorOrigin] = useState<string>(withdrawal?.errorOrigin ?? "");
  const [currency, setCurrency] = useState<string>(withdrawal?.currency ?? WITHDRAWAL_CURRENCIES[0]);
  const [lines, setLines] = useState<LineDraft[]>(() =>
    withdrawal
      ? lineFromWithdrawal(withdrawal)
      : initialLines && initialLines.length > 0
        ? initialLines.map((l) => ({
            key: nextKey++,
            productId: l.productId ?? "",
            quantity: l.quantity ?? "",
            quantityUnit: l.quantityUnit || "",
            packDetail: l.packDetail ?? "",
            unitPrice: l.unitPrice ?? "",
          }))
        : ticketProducts.length > 0
          ? ticketProducts.map((tp) => emptyLine(String(tp.productId), `${tp.productCode} · ${tp.productName}`))
          : [emptyLine()],
  );
  const [highlightLineKey, setHighlightLineKey] = useState<number | null>(null);
  const lineRowRefs = useRef(new Map<number, HTMLTableRowElement>());

  const [resolvedClientName, setResolvedClientName] = useState<string>(
    fixedClientName ?? withdrawal?.clientName ?? "",
  );
  const [resolvedTicketNumber, setResolvedTicketNumber] = useState<string>(
    fixedTicketNumber ?? withdrawal?.ticketNumber ?? "",
  );
  const [errors, setErrors] = useState<FormErrors>({ byLine: {} });
  const [banner, setBanner] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Confirmación al cerrar con cambios y prompt de cierre del ticket al terminar
  const [confirmCloseOpen, setConfirmCloseOpen] = useState(false);
  const [saveDraftConfirmOpen, setSaveDraftConfirmOpen] = useState(false);
  const [completedWithdrawal, setCompletedWithdrawal] = useState<WithdrawalDetail | null>(null);
  const [showClosePrompt, setShowClosePrompt] = useState(false);
  const initialSnapshotRef = useRef<string>("");
  const savedResultRef = useRef<WithdrawalDetail | null>(null);

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

  // Resolver cliente y número de ticket cuando cambia el ticket elegido
  useEffect(() => {
    const idToLookup = lockedTicketId ?? (selectedTicketId ? Number(selectedTicketId) : 0);
    if (!idToLookup) return;
    if (lockedTicketId && fixedClientName && fixedTicketNumber) return;

    let active = true;
    ticketsApi
      .getById(idToLookup)
      .then((t) => {
        if (!active) return;
        if (t.clientName) setResolvedClientName(t.clientName);
        if (t.number) setResolvedTicketNumber(t.number);
      })
      .catch(() => {});

    return () => {
      active = false;
    };
  }, [lockedTicketId, selectedTicketId, fixedClientName, fixedTicketNumber]);

  // Restaurar borrador si existe
  useEffect(() => {
    if (!draftStorageKey) return;
    try {
      const parsed = readEnterpriseFormDraft<{
        step?: number;
        requestDate?: string;
        reason?: WithdrawalReason;
        errorOrigin?: string;
        currency?: string;
        lines?: Partial<LineDraft>[];
      }>(draftStorageKey);
      if (parsed) {
        if (typeof parsed.step === "number" && parsed.step >= 1 && parsed.step <= 2) setStep(parsed.step);
        if (typeof parsed.requestDate === "string") setRequestDate(parsed.requestDate);
        if (parsed.reason === "Por devolución" || parsed.reason === "Por cambio") setReason(parsed.reason);
        if (typeof parsed.errorOrigin === "string") setErrorOrigin(parsed.errorOrigin);
        if (typeof parsed.currency === "string") setCurrency(parsed.currency);
        if (Array.isArray(parsed.lines) && parsed.lines.length > 0) {
          setLines(
            parsed.lines.map((l: Partial<LineDraft>) => ({
              key: nextKey++,
              productId: l.productId ?? "",
              productLabel: l.productLabel,
              quantity: l.quantity ?? "",
              quantityUnit: l.quantityUnit ?? "",
              packDetail: l.packDetail ?? "",
              unitPrice: l.unitPrice ?? "",
            })),
          );
        }
      }
    } catch {
      /** ignorar borrador corrupto */
    }
  }, [draftStorageKey]);

  const currentSnapshot = useMemo(
    () =>
      JSON.stringify({
        selectedTicketId,
        requestDate,
        reason,
        errorOrigin,
        currency,
        lines: lines.map((l) => ({
          productId: l.productId,
          quantity: l.quantity,
          quantityUnit: l.quantityUnit,
          packDetail: l.packDetail,
          unitPrice: l.unitPrice,
        })),
      }),
    [selectedTicketId, requestDate, reason, errorOrigin, currency, lines],
  );

  useEffect(() => {
    if (!initialSnapshotRef.current) {
      initialSnapshotRef.current = currentSnapshot;
    }
  }, [currentSnapshot]);

  const isDirty = initialSnapshotRef.current !== "" && initialSnapshotRef.current !== currentSnapshot;

  function saveDraftToStorage() {
    writeEnterpriseFormDraft(draftStorageKey, {
      step,
      requestDate,
      reason,
      errorOrigin,
      currency,
      lines,
    });
  }

  function clearDraftFromStorage() {
    clearEnterpriseFormDraft(draftStorageKey);
  }

  function handleSaveDraft() {
    if (!draftStorageKey || saving) return;
    saveDraftToStorage();
    initialSnapshotRef.current = currentSnapshot;
    receipts.done({
      action: "guardar-borrador-retiro",
      title: "Borrador guardado",
      detail: `${WITHDRAWAL_FORM_CONTROL.code}${displayTicketNumber ? ` · ${displayTicketNumber}` : ""}`,
    });
  }

  function handleRequestClose() {
    if (saving) return;
    if (!isEditing && isDirty && draftStorageKey) {
      setConfirmCloseOpen(true);
      return;
    }
    requestClose();
  }

  function finishModal(saved: WithdrawalDetail) {
    savedResultRef.current = saved;
    requestClose();
  }

  const inheritedClientName =
    resolvedClientName || fixedClientName || withdrawal?.clientName || "Se toma del ticket al guardar";
  const displayTicketNumber = resolvedTicketNumber || fixedTicketNumber || withdrawal?.ticketNumber;
  const hasTicketContext = Boolean(lockedTicketId || selectedTicketId);

  function patchLine(key: number, patch: Partial<LineDraft>) {
    setLines((current) => current.map((line) => (line.key === key ? { ...line, ...patch } : line)));
  }

  function addLine() {
    setLines((current) => [...current, emptyLine()]);
  }

  function removeLine(key: number) {
    setLines((current) => (current.length <= 1 ? current : current.filter((line) => line.key !== key)));
    setHighlightLineKey((curr) => (curr === key ? null : curr));
  }

  function validateStep(stepNumber: number): boolean {
    const next: FormErrors = { ...errors, byLine: { ...errors.byLine } };
    const todayIsoStr = today();

    if (stepNumber === 1) {
      delete next.ticketId;
      delete next.requestDate;
      delete next.reason;
      delete next.errorOrigin;
      delete next.currency;

      if (!lockedTicketId && !selectedTicketId) {
        next.ticketId = "Selecciona el ticket al que pertenece la solicitud.";
      }
      if (!requestDate) {
        next.requestDate = "Indica la fecha de la solicitud.";
      } else if (requestDate > todayIsoStr) {
        next.requestDate = "La fecha de la solicitud no puede ser futura.";
      }
      if (!reason) {
        next.reason = "Elige el motivo del retiro.";
      }
      if (!currency) {
        next.currency = "Selecciona la moneda.";
      }

      setErrors(next);
      return !next.ticketId && !next.requestDate && !next.reason && !next.currency;
    }

    if (stepNumber === 2) {
      delete next.lines;
      next.byLine = {};

      if (lines.length === 0) {
        next.lines = "Debes incluir al menos un renglón de producto.";
      }

      lines.forEach((line) => {
        const bucket: LineErrors = {};
        if (!line.productId) {
          bucket.productId = "Elige el producto del catálogo.";
        }
        if (parsePositiveDecimal(line.quantity) === null) {
          bucket.quantity = "Cantidad mayor que cero.";
        }
        if (!line.quantityUnit.trim()) {
          bucket.quantityUnit = "Indica la unidad (p. ej. CAJ).";
        } else if (line.quantityUnit.trim().length > 5) {
          bucket.quantityUnit = "Máximo 5 caracteres (p. ej. CAJ).";
        }
        if (line.packDetail.trim().length > 60) {
          bucket.packDetail = "Máximo 60 caracteres.";
        }
        if (line.unitPrice.trim().length > 6) {
          bucket.unitPrice = "Máximo 6 caracteres.";
        } else if (!parseOptionalPrice(line.unitPrice).valid) {
          bucket.unitPrice = "Precio cero o mayor.";
        }
        if (Object.keys(bucket).length > 0) {
          next.byLine[line.key] = bucket;
        }
      });

      setErrors(next);
      if (Object.keys(next.byLine).length > 0) {
        const firstBadIdx = lines.findIndex((l) => next.byLine[l.key]);
        if (firstBadIdx >= 0) setHighlightLineKey(lines[firstBadIdx]?.key ?? null);
        return false;
      }
      return !next.lines;
    }

    return true;
  }

  function validateAll(): { errors: FormErrors; firstErrorStep: number | null } {
    const next: FormErrors = { byLine: {} };
    const todayIsoStr = today();

    if (!lockedTicketId && !selectedTicketId) {
      next.ticketId = "Selecciona el ticket al que pertenece la solicitud.";
    }
    if (!requestDate) {
      next.requestDate = "Indica la fecha de la solicitud.";
    } else if (requestDate > todayIsoStr) {
      next.requestDate = "La fecha de la solicitud no puede ser futura.";
    }
    if (!reason) {
      next.reason = "Elige el motivo del retiro.";
    }
    if (!currency) {
      next.currency = "Selecciona la moneda.";
    }

    if (lines.length === 0) {
      next.lines = "Debes incluir al menos un renglón de producto.";
    }

    lines.forEach((line) => {
      const bucket: LineErrors = {};
      if (!line.productId) bucket.productId = "Elige el producto del catálogo.";
      if (parsePositiveDecimal(line.quantity) === null) bucket.quantity = "Cantidad mayor que cero.";
      if (!line.quantityUnit.trim()) bucket.quantityUnit = "Indica la unidad (p. ej. CAJ).";
      else if (line.quantityUnit.trim().length > 5) bucket.quantityUnit = "Máximo 5 caracteres (p. ej. CAJ).";
      if (line.packDetail.trim().length > 60) bucket.packDetail = "Máximo 60 caracteres.";
      if (line.unitPrice.trim().length > 6) bucket.unitPrice = "Máximo 6 caracteres.";
      else if (!parseOptionalPrice(line.unitPrice).valid) bucket.unitPrice = "Precio cero o mayor.";
      if (Object.keys(bucket).length > 0) {
        next.byLine[line.key] = bucket;
      }
    });

    const step1HasError = Boolean(next.ticketId || next.requestDate || next.reason || next.currency);
    const step2HasError = Boolean(next.lines || Object.keys(next.byLine).length > 0);
    const firstErrorStep = step1HasError ? 1 : step2HasError ? 2 : null;
    return { errors: next, firstErrorStep };
  }

  function handleNextStep() {
    setBanner(null);
    if (!validateStep(step)) return;
    setStepDirection("forward");
    setStep((s) => Math.min(STEPS.length, s + 1));
  }

  function handlePrevStep() {
    setBanner(null);
    setStepDirection("backward");
    setStep((s) => Math.max(1, s - 1));
  }

  async function handleSubmit() {
    setBanner(null);
    const { errors: validation, firstErrorStep } = validateAll();
    setErrors(validation);
    if (firstErrorStep !== null) {
      setStepDirection(firstErrorStep >= step ? "forward" : "backward");
      setStep(firstErrorStep);
      if (firstErrorStep === 2) {
        const firstBadIdx = lines.findIndex((l) => validation.byLine[l.key]);
        if (firstBadIdx >= 0) setHighlightLineKey(lines[firstBadIdx]?.key ?? null);
      }
      return;
    }

    const hasAnyPrice = lines.some((l) => parseOptionalPrice(l.unitPrice).value !== null);
    const resolvedOrigin: WithdrawalErrorOrigin | null =
      errorOrigin === "Vendedor" || errorOrigin === "Almacén" ? errorOrigin : null;

    const payload: SaveWithdrawalRequest = {
      requestDate,
      reason,
      errorOrigin: resolvedOrigin,
      currency: hasAnyPrice ? currency : null,
      lines: lines.map((line) => ({
        productId: Number(line.productId),
        quantity: parsePositiveDecimal(line.quantity)!,
        quantityUnit: line.quantityUnit.trim().toUpperCase(),
        packDetail: line.packDetail.trim() ? line.packDetail.trim().toUpperCase() : null,
        unitPrice: parseOptionalPrice(line.unitPrice).value,
      })),
    };

    const targetTicketId = lockedTicketId ?? Number(selectedTicketId);

    setSaving(true);
    try {
      const saved =
        isEditing && withdrawal
          ? await withdrawalsApi.update(withdrawal.id, payload)
          : await withdrawalsApi.create(targetTicketId, payload);
      clearDraftFromStorage();
      receipts.done({
        action: "guardar-retiro",
        title: isEditing ? "Solicitud de retiro actualizada" : "Solicitud de retiro emitida",
        detail: `${WITHDRAWAL_FORM_CONTROL.code} · ${saved.withdrawal.number}`,
      });

      const isAlreadyClosed = ticketStatus === "Solucionado" || ticketStatus === "Cancelado";
      if (!isEditing && !isAlreadyClosed && targetTicketId > 0 && onTicketStatusChanged) {
        setCompletedWithdrawal(saved);
        setShowClosePrompt(true);
      } else {
        finishModal(saved);
      }
    } catch (e) {
      if (e instanceof ApiError) {
        if (e.status === 409 && onConflict) {
          onConflict(e.message);
          requestClose();
          return;
        }
        setBanner(e.message);
      } else {
        setBanner("No se pudo guardar la solicitud de retiro. Inténtalo de nuevo.");
      }
    } finally {
      setSaving(false);
    }
  }

  const linesTotal = useMemo(() => {
    const values = lines.map((line) =>
      computeLineValue(
        parsePositiveDecimal(line.quantity),
        parseOptionalPrice(line.unitPrice).value,
      ),
    );
    return computeTotal(values);
  }, [lines]);

  useEffect(() => {
    if (step !== 2 || highlightLineKey === null) return;
    lineRowRefs.current.get(highlightLineKey)?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [highlightLineKey, step, lines.length]);

  const isWideStep = step === 2;

  const withdrawalStepMissing = useMemo(
    () =>
      getWithdrawalStepMissing({
        step: step as 1 | 2,
        lockedTicketId,
        selectedTicketId,
        requestDate,
        reason,
        currency,
        lines,
      }),
    [step, lockedTicketId, selectedTicketId, requestDate, reason, currency, lines],
  );

  function focusWithdrawalField(fieldId: string) {
    const lineMatch = /^withdrawal-line-(\d+)-/.exec(fieldId);
    if (lineMatch) {
      const key = Number(lineMatch[1]);
      setHighlightLineKey(key);
      if (step !== 2) {
        setStepDirection("forward");
        setStep(2);
      }
      setTimeout(() => focusFormField(fieldId), 60);
      return;
    }
    if (step !== 1) {
      setStepDirection("backward");
      setStep(1);
    }
    setTimeout(() => focusFormField(fieldId), 60);
  }

  const renderStepper = () => (
    <ol
      className="mx-auto flex w-full max-w-2xl items-center select-none gap-1"
      aria-label="Pasos del formulario"
    >
      {STEPS.map((item, idx) => {
        const isCurrent = step === item.id;
        const isCompleted = step > item.id;
        return (
          <Fragment key={item.id}>
            <li
              className="flex min-w-0 items-center gap-2"
              aria-current={isCurrent ? "step" : undefined}
            >
              <span
                className={`flex size-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold transition-colors ${
                  isCurrent
                    ? "bg-brand-red text-white shadow-2xs ring-2 ring-brand-red/20"
                    : isCompleted
                      ? "bg-emerald-600 text-white"
                      : "bg-zinc-200 text-zinc-500"
                }`}
              >
                {isCompleted ? <Check className="size-3.5 stroke-[2.5]" /> : item.id}
              </span>
              <div className="hidden min-w-0 flex-col text-left md:flex">
                <span
                  className={`truncate font-heading text-[12px] font-semibold ${
                    isCurrent ? "text-zinc-900" : isCompleted ? "text-zinc-700" : "text-zinc-400"
                  }`}
                >
                  {item.label}
                </span>
                <span className="truncate text-[10px] text-zinc-400">{item.hint}</span>
              </div>
            </li>
            {idx < STEPS.length - 1 ? (
              <li
                aria-hidden
                className={`mx-0.5 h-0.5 min-w-[1.5rem] flex-1 rounded-full transition-colors ${
                  step > item.id ? "bg-emerald-600/40" : "bg-zinc-200"
                }`}
              />
            ) : null}
          </Fragment>
        );
      })}
    </ol>
  );

  const renderFooterLeft = () => (
    <span className="text-[11.5px] text-zinc-400 select-none">
      Paso {step} de {STEPS.length}
    </span>
  );

  const wizardFooter = (
    <div className="flex w-full flex-wrap items-center justify-between gap-3">
      {renderFooterLeft()}
      <div className="ml-auto flex items-center gap-2">
        {step > 1 ? (
          <Button type="button" variant="secondary" size="sm" onClick={handlePrevStep} disabled={saving}>
            <ChevronLeft className="size-3.5" />
            <span>Anterior</span>
          </Button>
        ) : (
          <Button type="button" variant="secondary" size="sm" onClick={handleRequestClose} disabled={saving}>
            Cancelar
          </Button>
        )}
        <EnterpriseFormSaveDraftButton
          visible={Boolean(draftStorageKey)}
          disabled={saving}
          onClick={() => setSaveDraftConfirmOpen(true)}
        />
        {step < STEPS.length ? (
          <SubmitValidationButton
            ready={withdrawalStepMissing.length === 0}
            busy={saving}
            missingItems={withdrawalStepMissing}
            onSubmit={handleNextStep}
            onInvalidClick={() => {
              validateStep(step);
            }}
            onFocusField={focusWithdrawalField}
            blockTitle="No se puede continuar"
            hintText="Para avanzar, completa lo siguiente:"
            shortcutLabel={null}
          >
            <span>Siguiente paso</span>
            <ChevronRight className="size-3.5" />
          </SubmitValidationButton>
        ) : (
          <SubmitValidationButton
            ready={withdrawalStepMissing.length === 0}
            busy={saving}
            missingItems={withdrawalStepMissing}
            onSubmit={handleSubmit}
            onInvalidClick={() => {
              const { errors: validation, firstErrorStep } = validateAll();
              setErrors(validation);
              if (firstErrorStep !== null) setStep(firstErrorStep);
            }}
            onFocusField={focusWithdrawalField}
            blockTitle="No se puede emitir"
            hintText="Para emitir la solicitud, completa lo siguiente:"
            shortcutLabel={null}
          >
            {isEditing ? "Guardar cambios" : "Emitir solicitud"}
          </SubmitValidationButton>
        )}
      </div>
    </div>
  );

  const stepPanelClass =
    stepDirection === "forward" ? "animate-plf-step-forward" : "animate-plf-step-backward";

  const wizardBody = (
    <form
      onSubmit={(e) => e.preventDefault()}
      noValidate
      className={`flex w-full flex-col gap-4 text-left ${
        isWideStep ? "max-w-none" : "mx-auto max-w-4xl"
      }`}
    >
      {banner && <Alert variant="error">{banner}</Alert>}

      {/** PASO 1: Datos de la solicitud (Motivo, origen, fecha, moneda y empresa) */}
      {step === 1 && (
        <div key="withdrawal-step-1" className={`space-y-4 ${stepPanelClass}`}>
          {/** Contexto del ticket y empresa (barra simétrica de dos mitades) */}
          {hasTicketContext ? (
            <div className="flex flex-col gap-2">
              {!lockedTicketId && (
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedTicketId("");
                      setResolvedClientName("");
                      setResolvedTicketNumber("");
                    }}
                    className="cursor-pointer text-[11px] font-medium text-zinc-500 underline-offset-2 transition-colors hover:text-brand-red hover:underline"
                  >
                    Elegir otro ticket
                  </button>
                </div>
              )}
              <WithdrawalTicketContextBar
                ticketNumber={displayTicketNumber ?? "—"}
                companyName={inheritedClientName}
              />
            </div>
          ) : (
            <LookupField
              size="sm"
              label="Ticket origen"
              required
              value={selectedTicketId}
              onChange={setSelectedTicketId}
              placeholder="Buscar ticket por número o cliente…"
              searchPlaceholder="Código TIC- o nombre del cliente…"
              search={searchTickets}
              resolveSelectedLabel={resolveTicketLabel}
              error={errors.ticketId}
            />
          )}

          {/** Selector de Motivo del retiro (Por Devolución / Por Cambio, igual a las casillas del PF... */}
          <fieldset className="rounded-xl border border-zinc-200/90 bg-white p-3.5">
            <legend className="px-1 font-heading text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
              Motivo del retiro (casilla PF-FOR-068) *
            </legend>
            <div className="mt-1 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              {WITHDRAWAL_REASONS.map((option) => {
                const active = reason === option;
                const Icon = option === "Por devolución" ? RotateCcw : RefreshCw;
                const subtitle =
                  option === "Por devolución"
                    ? "Retorno definitivo de mercancía al almacén"
                    : "Retiro para reposición o cambio de producto";
                return (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setReason(option)}
                    className={`flex items-start gap-3 rounded-lg border p-3 text-left transition-all cursor-pointer ${
                      active
                        ? "border-brand-red bg-red-50/40 ring-2 ring-brand-red/10"
                        : "border-zinc-200 bg-zinc-50/40 hover:border-zinc-300 hover:bg-zinc-50"
                    }`}
                  >
                    <div
                      className={`mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md border text-[12px] font-bold ${
                        active
                          ? "border-brand-red bg-brand-red text-white"
                          : "border-zinc-300 bg-white text-zinc-500"
                      }`}
                    >
                      {active ? "X" : <Icon className="size-3.5" />}
                    </div>
                    <div className="min-w-0">
                      <p className={`text-[13px] font-semibold ${active ? "text-zinc-900" : "text-zinc-800"}`}>
                        {option}
                      </p>
                      <p className="mt-0.5 text-[11.5px] text-zinc-500">{subtitle}</p>
                    </div>
                  </button>
                );
              })}
            </div>
            {errors.reason && <p className="mt-1.5 text-[12px] text-red-600">{errors.reason}</p>}
          </fieldset>

          {/** Fecha, Origen del error y Moneda */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <DateField
              label="Fecha de solicitud (DIA / MES / AÑO)"
              required
              value={requestDate}
              maxDate={today()}
              onChange={setRequestDate}
              error={errors.requestDate}
            />

            <SelectField
              size="sm"
              label="Origen del error"
              value={errorOrigin}
              onChange={setErrorOrigin}
              options={ERROR_ORIGIN_OPTIONS}
              error={errors.errorOrigin}
            />

            <SelectField
              size="sm"
              label="Moneda"
              required
              value={currency}
              onChange={setCurrency}
              options={CURRENCY_OPTIONS}
              error={errors.currency}
            />
          </div>
        </div>
      )}

      {/** PASO 2: Renglones PF-FOR-068 (tabla tipo hoja de cálculo) */}
      {step === 2 && (
        <div key="withdrawal-step-2" className={stepPanelClass}>
          <WithdrawalLinesSpreadsheet
            lines={lines}
            currency={currency}
            ticketProducts={ticketProducts}
            linesError={errors.lines}
            byLine={errors.byLine}
            totalValue={linesTotal}
            highlightLineKey={highlightLineKey}
            rowRef={(key, el) => {
              if (el) lineRowRefs.current.set(key, el);
              else lineRowRefs.current.delete(key);
            }}
            onPatch={patchLine}
            onAddLine={addLine}
            onRemoveLine={removeLine}
          />
        </div>
      )}
    </form>
  );

  return (
    <>
      {inline ? (
        <div
          ref={inlineMotion.panelRef}
          className={`mx-auto overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-2xs ${
            isWideStep ? "w-full max-w-[min(96vw,88rem)]" : "max-w-4xl"
          }`}
        >
          <header className="flex items-center gap-3 border-b border-zinc-200/80 bg-white px-4 py-3 sm:gap-4 sm:px-6">
            <button
              type="button"
              onClick={handleRequestClose}
              className="inline-flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-zinc-200 bg-zinc-50/60 text-zinc-600 shadow-2xs transition-colors hover:bg-zinc-100 hover:text-zinc-900 focus:outline-hidden"
              title="Volver a formularios"
              aria-label="Volver a formularios"
            >
              <ArrowLeft className="size-4 text-zinc-600" />
            </button>
            <h2 className="min-w-0 flex-1 truncate font-heading text-base font-bold leading-none text-zinc-900 sm:text-lg">
              {isEditing
                ? `Editar solicitud · ${displayTicketNumber ?? ""}`
                : "Solicitud de retiro de mercancía"}
            </h2>
            <span className="shrink-0 rounded border border-brand-red/20 bg-brand-red/10 px-1.5 py-0.5 font-heading text-[10px] font-bold uppercase tracking-wider text-brand-red">
              {WITHDRAWAL_FORM_CONTROL.code}
            </span>
          </header>
          <div className="border-b border-zinc-100 px-4 py-3 sm:px-6">{renderStepper()}</div>
          <div className="p-4 sm:p-6">{wizardBody}</div>
          <footer className="border-t border-zinc-200/80 bg-zinc-50/70 px-5 py-3.5 sm:px-6">{wizardFooter}</footer>
        </div>
      ) : (
        <Modal
          title={
            isEditing
              ? `Editar solicitud ${withdrawal?.number ?? ""}`
              : "Solicitud de retiro de mercancía"
          }
          eyebrow={WITHDRAWAL_FORM_CONTROL.code}
          onClose={handleRequestClose}
          maxWidth={
            isWideStep ? "max-w-[96vw] 2xl:max-w-[1720px] w-full" : "max-w-4xl"
          }
          footer={wizardFooter}
        >
          <div className="mb-4 -mt-2 border-b border-zinc-100 pb-3">{renderStepper()}</div>
          {wizardBody}
        </Modal>
      )}

      {saveDraftConfirmOpen && (
        <EnterpriseFormSaveDraftConfirmModal
          open
          formCode={WITHDRAWAL_FORM_CONTROL.code}
          ticketLabel={displayTicketNumber ?? undefined}
          onClose={() => setSaveDraftConfirmOpen(false)}
          onConfirm={() => {
            handleSaveDraft();
            setSaveDraftConfirmOpen(false);
          }}
        />
      )}

      {/** Confirmación al salir con cambios sin guardar */}
      {confirmCloseOpen && (
        <Modal
          title="¿Salir del formulario?"
          onClose={() => setConfirmCloseOpen(false)}
          maxWidth="max-w-md"
          footer={
            <div className="flex w-full items-center justify-between gap-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  clearDraftFromStorage();
                  setConfirmCloseOpen(false);
                  requestClose();
                }}
              >
                Descartar
              </Button>
              <div className="flex items-center gap-2">
                <Button type="button" variant="secondary" onClick={() => setConfirmCloseOpen(false)}>
                  Seguir editando
                </Button>
                <Button
                  type="button"
                  onClick={() => {
                    saveDraftToStorage();
                    setConfirmCloseOpen(false);
                    requestClose();
                  }}
                >
                  Guardar borrador
                </Button>
              </div>
            </div>
          }
        >
          <p className="text-[13px] text-zinc-600">
            Tienes datos en progreso en esta solicitud PF-FOR-068. Puedes guardar un borrador para continuar más tarde o
            descartar los cambios.
          </p>
        </Modal>
      )}

      {/** Modal unificado al completar para cerrar el ticket si corresponde */}
      {showClosePrompt && completedWithdrawal && (
        <EnterpriseFormCloseTicketModal
          open={showClosePrompt}
          ticketId={lockedTicketId ?? Number(selectedTicketId)}
          formCode={WITHDRAWAL_FORM_CONTROL.code}
          recordNumber={completedWithdrawal.withdrawal.number}
          descriptionText="La solicitud de retiro ha sido registrada exitosamente. Puedes dar por concluido y cerrar este ticket indicando el veredicto oficial y el comentario de resolución."
          defaultReason={`Cerrado tras registrar solicitud de retiro ${WITHDRAWAL_FORM_CONTROL.code} · ${completedWithdrawal.withdrawal.number}`}
          receiptDetail={`El ticket quedó solucionado tras el retiro ${completedWithdrawal.withdrawal.number}.`}
          onClose={() => {
            const done = completedWithdrawal;
            setShowClosePrompt(false);
            setCompletedWithdrawal(null);
            finishModal(done);
          }}
          onSuccess={() => {
            onTicketStatusChanged?.();
          }}
          onTicketStatusChanged={onTicketStatusChanged}
        />
      )}
    </>
  );
}

function WithdrawalTicketContextBar({
  ticketNumber,
  companyName,
}: {
  ticketNumber: string;
  companyName: string;
}) {
  return (
    <div className="grid grid-cols-1 overflow-hidden rounded-xl border border-zinc-200/90 bg-zinc-50/70 sm:grid-cols-2 sm:divide-x sm:divide-zinc-200/90">
      <div className="flex min-h-[3.25rem] min-w-0 flex-col justify-center gap-0.5 border-b border-zinc-200/90 px-4 py-3 sm:border-b-0">
        <span className="font-heading text-[10px] font-bold uppercase tracking-[0.08em] text-zinc-400">
          Ticket
        </span>
        <span className="truncate font-mono text-[13px] font-semibold leading-snug text-zinc-900" title={ticketNumber}>
          {ticketNumber}
        </span>
      </div>
      <div className="flex min-h-[3.25rem] min-w-0 flex-col justify-center gap-0.5 px-4 py-3">
        <span className="font-heading text-[10px] font-bold uppercase tracking-[0.08em] text-zinc-400">
          Nombre empresa
        </span>
        <span className="truncate text-[13px] font-semibold leading-snug text-zinc-900" title={companyName}>
          {companyName}
        </span>
      </div>
    </div>
  );
}
