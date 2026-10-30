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
  ticketNumber: string;
  drafts: PendingEnterpriseDraft[];
  onResume: (pickerKey: EnterpriseFormPickerKey) => void;
  onDiscard: (pickerKey: EnterpriseFormPickerKey) => void;
  onBrowseForms: () => void;
  browseDisabled?: boolean;
}

/** Vista inicial del ticket cuando hay borrador(es) local(es): prioriza retomar con claridad. */
export function EnterpriseFormDraftLandingView({
  ticketNumber,
  drafts,
  onResume,
  onDiscard,
  onBrowseForms,
  browseDisabled = false,
}: EnterpriseFormDraftLandingViewProps) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-2xs">
      <div className="mx-auto flex max-w-2xl flex-col items-center text-center">
        <div className="flex size-12 items-center justify-center rounded-xl border border-brand-red/20 bg-brand-red/10 text-brand-red shadow-2xs">
          <FilePenLine className="size-5" strokeWidth={2} />
        </div>
        <p className="mt-4 font-heading text-[10px] font-bold uppercase tracking-[0.1em] text-zinc-400">
          Ticket {ticketNumber}
        </p>
        <h3 className="mt-1 font-heading text-lg font-bold text-zinc-900">Borrador guardado</h3>
        <p className="mt-2 max-w-md text-[13px] leading-relaxed text-zinc-500">
          Tienes un formulario en progreso en este navegador. Retómalo donde lo dejaste o descarta el
          borrador para iniciar uno nuevo.
        </p>
      </div>

      <div className="mx-auto mt-6 flex max-w-2xl flex-col gap-3">
        {drafts.map((draft) => (
          <div
            key={draft.pickerKey}
            className="rounded-xl border border-brand-red/25 bg-brand-red/[0.04] p-4 shadow-2xs ring-1 ring-brand-red/10"
          >
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0 text-left">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded border border-brand-red/20 bg-brand-red/10 px-1.5 py-0.5 font-heading text-[10px] font-bold uppercase tracking-wider text-brand-red">
                    {draft.formCode}
                  </span>
                  <EnterpriseFormDraftBadge variant="emphasis" />
                </div>
                <h4 className="mt-2 text-sm font-semibold text-zinc-900">{draft.title}</h4>
                {draft.dept ? (
                  <p className="mt-0.5 text-[11px] text-zinc-500">{draft.dept}</p>
                ) : null}
                <dl className="mt-3 grid grid-cols-2 gap-2 text-[11px] sm:max-w-xs">
                  {draft.savedAtLabel ? (
                    <div className="rounded-lg border border-zinc-200/80 bg-white/90 px-2.5 py-2">
                      <dt className="font-heading text-[10px] font-bold uppercase tracking-[0.08em] text-zinc-400">
                        Guardado
                      </dt>
                      <dd className="mt-0.5 font-medium tabular-nums text-zinc-800">{draft.savedAtLabel}</dd>
                    </div>
                  ) : null}
                  {draft.stepLabel ? (
                    <div className="rounded-lg border border-zinc-200/80 bg-white/90 px-2.5 py-2">
                      <dt className="font-heading text-[10px] font-bold uppercase tracking-[0.08em] text-zinc-400">
                        Progreso
                      </dt>
                      <dd className="mt-0.5 font-medium text-zinc-800">{draft.stepLabel}</dd>
                    </div>
                  ) : null}
                </dl>
              </div>
              <div className="flex shrink-0 flex-col gap-2 sm:min-w-[11rem]">
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

      <div className="mx-auto mt-6 flex max-w-2xl justify-center border-t border-zinc-100 pt-5">
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
