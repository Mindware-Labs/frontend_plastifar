import { FilePenLine } from "lucide-react";
import type { EnterpriseFormPickerKey } from "../../lib/enterpriseFormDrafts";
import { EnterpriseFormDraftBadge } from "./EnterpriseFormDraftBadge";
import { Button } from "../ui/Button";

export interface PendingEnterpriseDraft {
  pickerKey: EnterpriseFormPickerKey;
  formCode: string;
  title: string;
  dept?: string;
  savedAtLabel?: string | null;
  stepLabel?: string | null;
}

interface EnterpriseFormDraftLandingViewProps {
  hostKindLabel?: string;
  ticketNumber: string;
  drafts: PendingEnterpriseDraft[];
  onResume: (pickerKey: EnterpriseFormPickerKey) => void;
  onDiscard: (pickerKey: EnterpriseFormPickerKey) => void;
  onBrowseForms: () => void;
  browseDisabled?: boolean;
}

/** Vista inicial del ticket cuando hay borrador(es) local(es): prioriza retomar con claridad. */
export function EnterpriseFormDraftLandingView({
  hostKindLabel = "Ticket",
  ticketNumber,
  drafts,
  onResume,
  onDiscard,
  onBrowseForms,
  browseDisabled = false,
}: EnterpriseFormDraftLandingViewProps) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-2xs sm:p-5">
      <div className="flex items-start gap-3 border-b border-zinc-100 pb-3.5">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-brand-red/20 bg-brand-red/10 text-brand-red shadow-2xs">
          <FilePenLine className="size-[18px]" strokeWidth={2} />
        </div>
        <div className="min-w-0 text-left">
          <p className="font-heading text-[10px] font-bold uppercase tracking-[0.1em] text-zinc-400">
            {hostKindLabel} {ticketNumber}
          </p>
          <h3 className="mt-0.5 font-heading text-base font-bold text-zinc-900 sm:text-[17px]">
            Borrador guardado
          </h3>
          <p className="mt-1 max-w-xl text-[12px] leading-snug text-zinc-500">
            Tienes un formulario en progreso en este navegador. Retómalo donde lo dejaste o descarta el
            borrador para iniciar uno nuevo.
          </p>
        </div>
      </div>

      <div className="mt-3 flex flex-col gap-2.5">
        {drafts.map((draft) => (
          <div
            key={draft.pickerKey}
            className="rounded-xl border border-brand-red/25 bg-brand-red/[0.04] p-3 shadow-2xs ring-1 ring-brand-red/10 sm:p-3.5"
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0 text-left">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="rounded border border-brand-red/20 bg-brand-red/10 px-1.5 py-0.5 font-heading text-[10px] font-bold uppercase tracking-wider text-brand-red">
                    {draft.formCode}
                  </span>
                  <EnterpriseFormDraftBadge variant="emphasis" />
                </div>
                <h4 className="mt-1.5 text-[13px] font-semibold leading-snug text-zinc-900">{draft.title}</h4>
                {draft.dept ? (
                  <p className="mt-0.5 text-[11px] text-zinc-500">{draft.dept}</p>
                ) : null}
                {(draft.savedAtLabel || draft.stepLabel) && (
                  <dl className="mt-2 flex flex-wrap gap-1.5 text-[11px]">
                    {draft.savedAtLabel ? (
                      <div className="rounded-md border border-zinc-200/80 bg-white/90 px-2 py-1">
                        <dt className="font-heading text-[9px] font-bold uppercase tracking-[0.08em] text-zinc-400">
                          Guardado
                        </dt>
                        <dd className="mt-px font-medium tabular-nums leading-tight text-zinc-800">
                          {draft.savedAtLabel}
                        </dd>
                      </div>
                    ) : null}
                    {draft.stepLabel ? (
                      <div className="rounded-md border border-zinc-200/80 bg-white/90 px-2 py-1">
                        <dt className="font-heading text-[9px] font-bold uppercase tracking-[0.08em] text-zinc-400">
                          Progreso
                        </dt>
                        <dd className="mt-px font-medium leading-tight text-zinc-800">{draft.stepLabel}</dd>
                      </div>
                    ) : null}
                  </dl>
                )}
              </div>
              <div className="flex shrink-0 flex-col gap-1.5 sm:min-w-[10.5rem]">
                <Button type="button" size="sm" onClick={() => onResume(draft.pickerKey)}>
                  Retomar borrador
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() => onDiscard(draft.pickerKey)}
                >
                  Descartar borrador
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-3.5 flex justify-center border-t border-zinc-100 pt-3">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={browseDisabled}
          onClick={onBrowseForms}
        >
          Ver los cuatro formularios oficiales
        </Button>
      </div>
    </div>
  );
}
