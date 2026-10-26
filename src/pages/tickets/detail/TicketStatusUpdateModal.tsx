import { Gavel } from "lucide-react";
import { AnimatedCheckIcon } from "../../../components/ui/AnimatedCheckIcon";
import { Button } from "../../../components/ui/Button";
import { CheckboxField, SelectField } from "../../../components/ui/Field";
import { FileDropzone } from "../../../components/ui/FileDropzone";
import { Modal } from "../../../components/ui/Modal";
import { labelClass, textareaClass } from "./ticketDetailShared";
import type { StatusTransitionOption } from "./ticketTransitions";
import type { TicketStatusUpdateFlow } from "./useTicketStatusUpdate";

interface TicketStatusUpdateModalProps {
  flow: TicketStatusUpdateFlow;
  ticketNumber: string;
  settle: boolean;
  availableTransitions: StatusTransitionOption[];
  recipientEmail: string | null;
}

/** Flujo de 3 pasos para veredicto y 2 pasos para otras transiciones. */
export function TicketStatusUpdateModal({
  flow,
  ticketNumber,
  settle,
  availableTransitions,
  recipientEmail,
}: TicketStatusUpdateModalProps) {
  const {
    transitioning,
    transitionError,
    setTransitionError,
    setShowUpdateStatusModal,
    updateStep,
    stepDirection,
    updateTargetStatus,
    updateVerdictId,
    setUpdateVerdictId,
    updateComment,
    setUpdateComment,
    updateNotifyClient,
    setUpdateNotifyClient,
    verdictOptions,
    loadingVerdicts,
    verdictAttachments,
    isDraggingVerdict,
    setIsDraggingVerdict,
    showVerdictAttachedFeedback,
    verdictAttachedExiting,
    verdictFileInputRef,
    updateSuccess,
    updateCategory,
    handleContinueUpdateStatus,
    handleContinueToStep3,
    handleSelectTarget,
    handleSelectTargetAndContinue,
    handleBackToStep,
    dismissUpdateStatusModal,
    handleVerdictFilesSelected,
    handleRemoveVerdictFile,
    handleConfirmUpdateStatus,
  } = flow;

  return (
    <Modal
      settle={settle}
      eyebrow={
        updateSuccess
          ? undefined
          : updateCategory === "veredicto"
            ? `${ticketNumber} · Paso ${updateStep} de 3`
            : updateStep === 2
              ? `${ticketNumber} · Paso 2 de 2`
              : ticketNumber
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
          dismissUpdateStatusModal();
        }
      }}
      footer={
        updateSuccess ? (
          <Button
            key="btn-status-success-close"
            type="button"
            size="sm"
            variant="primary"
            onClick={dismissUpdateStatusModal}
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
            <Button
              key="btn-status-continue"
              type="button"
              size="sm"
              disabled={!updateTargetStatus && !transitionError}
              tone={transitionError ? "ink" : "primary"}
              toneLabel={transitionError}
              onClick={handleContinueUpdateStatus}
            >
              Continuar
            </Button>
          </div>
        ) : updateStep === 2 && updateCategory === "veredicto" ? (
          <div key="status-step-2-verdict" className="animate-plf-header-fade flex items-center justify-end gap-2">
            <Button
              key="btn-status-back-1"
              type="button"
              variant="secondary"
              size="sm"
              disabled={transitioning}
              onClick={() => handleBackToStep(1)}
            >
              Atrás
            </Button>
            <Button
              key="btn-status-continue-step2"
              type="submit"
              form="update-status-step2-form"
              size="sm"
              disabled={!updateVerdictId && !transitionError}
              tone={transitionError ? "ink" : "primary"}
              toneLabel={transitionError}
            >
              Continuar
            </Button>
          </div>
        ) : updateStep === 3 && updateCategory === "veredicto" ? (
          <div key="status-step-3-verdict" className="animate-plf-header-fade flex items-center justify-end gap-2">
            <Button
              key="btn-status-back-2"
              type="button"
              variant="secondary"
              size="sm"
              disabled={transitioning}
              onClick={() => handleBackToStep(2)}
            >
              Atrás
            </Button>
            <Button
              key="btn-status-confirm-verdict"
              type="submit"
              form="update-status-form"
              size="sm"
              variant="primary"
              isLoading={transitioning}
              tone={transitionError ? "ink" : "primary"}
              toneLabel={transitionError}
              className={transitionError ? "" : "bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white"}
            >
              <Gavel className="h-3.5 w-3.5" />
              Confirmar veredicto
            </Button>
          </div>
        ) : (
          <div key="status-step-2-other" className="animate-plf-header-fade flex items-center justify-end gap-2">
            <Button
              key="btn-status-back-other"
              type="button"
              variant="secondary"
              size="sm"
              disabled={transitioning}
              onClick={() => handleBackToStep(1)}
            >
              Atrás
            </Button>
            <Button
              key="btn-status-confirm-other"
              type="submit"
              form="update-status-form"
              size="sm"
              variant={updateCategory === "cancelar" ? "danger" : "primary"}
              isLoading={transitioning}
              tone={transitionError ? "ink" : "primary"}
              toneLabel={transitionError}
            >
              {updateCategory === "cancelar" ? "Cancelar ticket" : "Confirmar"}
            </Button>
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
              <div role="radiogroup" aria-label="Nueva situación" className="space-y-1.5">
                {availableTransitions.map((option) => {
                  const isSelected = updateTargetStatus === option.target;
                  const OptionIcon = option.icon;
                  return (
                    <button
                      key={option.target}
                      type="button"
                      role="radio"
                      aria-checked={isSelected}
                      onClick={() => handleSelectTarget(option.target)}
                      onDoubleClick={(e) => {
                        e.preventDefault();
                        handleSelectTargetAndContinue(option.target);
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
              <FileDropzone
                label="Archivos de evidencia (opcional)"
                idleTitle="Haz clic para adjuntar evidencias"
                idleHint="Imágenes (PNG, JPG), reportes en PDF, hojas de Excel, etc."
                inputRef={verdictFileInputRef}
                inputId="verdict-attachment-input"
                onInputChange={(e) => {
                  handleVerdictFilesSelected(e.target.files);
                  if (verdictFileInputRef.current) verdictFileInputRef.current.value = "";
                }}
                onDropFiles={handleVerdictFilesSelected}
                isDragging={isDraggingVerdict}
                onDraggingChange={setIsDraggingVerdict}
                feedbackShowing={showVerdictAttachedFeedback}
                feedbackExiting={verdictAttachedExiting}
                files={verdictAttachments}
                onRemoveFile={handleRemoveVerdictFile}
              />
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
  );
}
