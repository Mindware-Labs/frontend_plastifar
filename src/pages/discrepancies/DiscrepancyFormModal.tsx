import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, Building2, ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useState } from "react";
import { useFieldArray, useForm, useWatch } from "react-hook-form";
import { ApiError } from "../../api/client";
import { discrepanciesApi } from "../../api/discrepancies";
import { ticketsApi } from "../../api/tickets";
import { ticketVerdictsApi } from "../../api/ticketVerdicts";
import { Button } from "../../components/ui/Button";
import { type FieldState } from "../../components/ui/Field";
import { Modal } from "../../components/ui/Modal";
import { useReceipts } from "../../context/useReceipts";
import { useDialogMotion } from "../../hooks/useDialogMotion";
import { useModalAnimation } from "../../hooks/useModalAnimation";
import { cacheTicketInfo, getCachedTicketInfo } from "../../lib/discrepancies";
import { toNumber } from "../../lib/numbers";
import type {
  DiscrepancyDetail,
  LoadDiscrepancy,
  SecurityCheckInput,
  SecurityCheckResult,
} from "../../types/discrepancies";
import { DiscrepancyChecksStep } from "./form/DiscrepancyChecksStep";
import { DiscrepancyClosePromptModal } from "./form/DiscrepancyClosePromptModal";
import { emptyLine, schema, type CheckChoice, type FormValues } from "./form/discrepancyForm";
import { DiscrepancyLinesStep } from "./form/DiscrepancyLinesStep";
import { DiscrepancyOriginStep } from "./form/DiscrepancyOriginStep";
import { DiscrepancyStepper } from "./form/DiscrepancyStepper";
import { parseNote } from "./form/parseNote";

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
  const [savedResult, setSavedResult] = useState<DiscrepancyDetail | null>(null);

  // Modal para preguntar si desea cerrar el ticket al completar la investigación
  const [showClosePrompt, setShowClosePrompt] = useState(false);
  const [completedDiscrepancy, setCompletedDiscrepancy] = useState<DiscrepancyDetail | null>(null);
  const [closingTicket, setClosingTicket] = useState(false);
  const [verdicts, setVerdicts] = useState<Array<{ id: number; name: string }>>([]);
  const [selectedVerdictId, setSelectedVerdictId] = useState<string>("");
  const [closeReason, setCloseReason] = useState<string>("");

  useEffect(() => {
    if (showClosePrompt && completedDiscrepancy) {
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
      setSavedResult(saved);
      requestClose();
    } else {
      onSaved(saved);
      requestClose();
    }
  };

  const handleFinishedExit = () => {
    if (savedResult) {
      onSaved(savedResult);
    } else {
      onClose();
    }
  };

  const modalAnimation = useModalAnimation();
  const {
    requestClose: inlineRequestClose,
    isExiting: inlineExiting,
    panelRef: inlinePanelRef,
  } = useDialogMotion(handleFinishedExit);

  const requestClose = inline ? inlineRequestClose : modalAnimation.requestClose;
  const isExiting = inline ? inlineExiting : modalAnimation.isExiting;

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
        setCloseReason(
          `Cerrado tras completar investigación de discrepancia ${saved.discrepancy.number}`
        );
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
  const modalSize =
    step === 1 ? "xl" : "full";

  const ticketInheritedLabel = effectiveTicketClientName
    ? effectiveTicketClientName
    : "Buscar cliente…";

  // Stepper Header
  const stepper = (
    <DiscrepancyStepper step={step} setStep={setStep} ticketIdValue={ticketIdValue} linesCount={fields.length} />
  );

  // Paso 1: Origen e Identificación (Diseño Editorial Simétrico de 2 Columnas)
  const originStep = (
    <DiscrepancyOriginStep
      control={control}
      ticketLabel={ticketLabel}
      setTicketLabel={setTicketLabel}
      effectiveTicketClientName={effectiveTicketClientName}
      setEffectiveTicketClientName={setEffectiveTicketClientName}
      ticketLocked={isEdit || ticketId !== undefined}
      ticketState={stateOf("ticketId")}
      ticketError={errors.ticketId?.message}
      discrepancyDate={discrepancyDate}
      setDiscrepancyDate={setDiscrepancyDate}
    />
  );

  // Paso 2: Líneas en Discrepancia y Nota Operativa (Diseño en Fichas Estructuradas sin Scroll)
  const linesStep = (
    <DiscrepancyLinesStep
      control={control}
      register={register}
      setValue={setValue}
      errors={errors}
      fields={fields}
      discrepancy={discrepancy}
      effectiveTicketClientName={effectiveTicketClientName}
      effectiveTicketClientId={effectiveTicketClientId}
      ticketInheritedLabel={ticketInheritedLabel}
      noteValue={noteValue}
      remove={remove}
      onAddLine={() => append(emptyLine(defaultClientIdForLines, derivedTicketNumber))}
    />
  );

  // Paso 3: Puntos de Seguridad a Evaluar
  const checksStep = (
    <DiscrepancyChecksStep checks={checks} setChecks={setChecks} anyPositive={anyPositive} toggleCheck={toggleCheck} />
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

  async function closeTicket(completed: DiscrepancyDetail) {
    setClosingTicket(true);
    try {
      const currentTicketId = Number(getValues("ticketId") || ticketId);
      const finalVerdictId = selectedVerdictId
        ? Number(selectedVerdictId)
        : (verdicts.length > 0 ? verdicts[0].id : undefined);

      await ticketsApi.updateStatus(currentTicketId, {
        status: "Solucionado",
        verdictId: finalVerdictId,
        reason: closeReason.trim() || `Cerrado tras completar investigación de discrepancia ${completed.discrepancy.number}`,
      });
      receipts.done({
        action: "cerrar-ticket",
        title: "Ticket cerrado y solucionado",
        detail: `El ticket ha sido marcado como solucionado en base a ${completed.discrepancy.number}.`,
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
      finishModal(completed);
    }
  }

  const closePromptModal =
    showClosePrompt && completedDiscrepancy ? (
      <DiscrepancyClosePromptModal
        completedDiscrepancy={completedDiscrepancy}
        verdicts={verdicts}
        selectedVerdictId={selectedVerdictId}
        setSelectedVerdictId={setSelectedVerdictId}
        closeReason={closeReason}
        setCloseReason={setCloseReason}
        closingTicket={closingTicket}
        onKeepOpen={() => finishModal(completedDiscrepancy)}
        onCloseTicket={() => closeTicket(completedDiscrepancy)}
      />
    ) : null;

  // RENDER MODO PÁGINA (INLINE EN TAB)
  if (inline) {
    return (
      <div
        ref={inlinePanelRef}
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
          {stepper}
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
                {originStep}
              </div>
            )}

            {/* Paso 2: Todo el ancho de la página para la tabla editorial */}
            {step === 2 && (
              <div className="w-full">
                {linesStep}
              </div>
            )}

            {/* Paso 3: Centrado de manera cómoda para los 9 puntos */}
            {step === 3 && (
              <div className="max-w-4xl mx-auto w-full py-2">
                {checksStep}
              </div>
            )}
          </form>
        </div>

        {/* Barra inferior de navegación y guardado */}
        <div className="border-t border-zinc-200/80 bg-zinc-50/70 px-5 sm:px-6 py-3.5 flex flex-wrap items-center justify-between gap-3">
          {renderFooterLeft()}
          {renderFooterButtons()}
        </div>
        {closePromptModal}
      </div>
    );
  }

  // RENDER MODO MODAL
  return (
    <>
      <Modal
        closeOnBackdropClick={false}
        size={modalSize}
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
          {stepper}
        </div>

        <form
          id="discrepancy-form"
          onSubmit={handleSubmit(onSubmit)}
          noValidate
          className="flex flex-col gap-3 text-left"
        >
          {step === 1 && originStep}
          {step === 2 && linesStep}
          {step === 3 && checksStep}
        </form>
      </Modal>
      {closePromptModal}
    </>
  );
}
