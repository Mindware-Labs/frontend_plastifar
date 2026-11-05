import { CheckCircle2 } from "lucide-react";
import { Button } from "../../../components/ui/Button";
import { Modal } from "../../../components/ui/Modal";
import type { EnterpriseFormType, MigrationSource } from "./ticketForms";

interface MigrateFormModalProps {
  migratingFromSource: MigrationSource;
  migrationTargetType: EnterpriseFormType;
  onTargetChange: (type: EnterpriseFormType) => void;
  migrateCommonFields: boolean;
  onMigrateCommonFieldsChange: (checked: boolean) => void;
  onClose: () => void;
  onContinue: () => void;
}

/** Cambiar de formulario: elige el destino y si se llevan los datos comunes. */
export function MigrateFormModal({
  migratingFromSource,
  migrationTargetType,
  onTargetChange,
  migrateCommonFields,
  onMigrateCommonFieldsChange,
  onClose,
  onContinue,
}: MigrateFormModalProps) {
  return (
    <Modal
      title="Cambiar de Formulario"
      description="Selecciona el nuevo formulario empresarial al que deseas cambiar en este ticket."
      onClose={onClose}
    >
      <div className="space-y-4">
        <div className="rounded-lg bg-zinc-50 p-3 border border-zinc-200 text-xs">
          <span className="font-heading text-[10px] font-bold uppercase text-zinc-400">Formulario actual:</span>
          <p className="font-semibold text-zinc-800 mt-0.5">{migratingFromSource.label}</p>
        </div>

        <div>
          <label className="block text-xs font-semibold text-zinc-800 mb-1.5">
            ¿A qué formulario deseas cambiar?
          </label>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {[
              { id: "reclamacion", code: "PF-FOR-034", label: "Reclamación de Clientes", desc: "Quejas, averías y diferencias" },
              { id: "retiro", code: "PF-FOR-068", label: "Solicitud de Retiro", desc: "Recogida de mercancía física" },
              { id: "discrepancia", code: "PF-FOR-291", label: "Discrepancia de Cargas", desc: "Sobrantes/faltantes en despacho" },
              { id: "hca", code: "PF-FOR-109", label: "Hecho, Causa y Acción", desc: "Calidad y causa raíz interna" },
            ]
              .filter((opt) => opt.id !== migratingFromSource.type)
              .map((opt) => {
                const isSelected = migrationTargetType === opt.id;
                return (
                  <div
                    key={opt.id}
                    onClick={() => onTargetChange(opt.id as EnterpriseFormType)}
                    className={`cursor-pointer rounded-lg border p-3 text-xs transition-all ${
                      isSelected
                        ? "border-brand-red bg-brand-red/5 ring-1 ring-brand-red/30"
                        : "border-zinc-200 bg-white hover:border-zinc-300"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[10px] font-bold uppercase text-brand-red">{opt.code}</span>
                      {isSelected && <CheckCircle2 className="size-3.5 text-brand-red" />}
                    </div>
                    <p className="mt-1 font-semibold text-zinc-900">{opt.label}</p>
                    <p className="mt-0.5 text-[11px] text-zinc-500">{opt.desc}</p>
                  </div>
                );
              })}
          </div>
        </div>

        {/* Checkbox for data migration */}
        <div className="rounded-lg border border-amber-200 bg-amber-50/60 p-3.5 text-xs">
          <label className="flex items-start gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={migrateCommonFields}
              onChange={(e) => onMigrateCommonFieldsChange(e.target.checked)}
              className="mt-0.5 size-4 rounded border-amber-300 text-brand-red focus:ring-brand-red"
            />
            <div>
              <span className="font-semibold text-amber-900">
                Migrar datos comunes al nuevo formulario (Recomendado)
              </span>
              <p className="mt-0.5 text-[11.5px] text-amber-800 leading-relaxed">
                Transfiere automáticamente el cliente, la referencia de factura, las líneas de producto cargadas y la descripción o nota. El formulario actual permanecerá guardado en el ticket.
              </p>
            </div>
          </label>

          {migrateCommonFields && migratingFromSource.data.lines.length > 0 && (
            <div className="mt-2.5 pt-2.5 border-t border-amber-200/60 text-[11px] text-amber-900">
              <span className="font-medium">Se transferirán:</span> {migratingFromSource.data.lines.length} producto(s)
              {migratingFromSource.data.invoiceRef ? ` · Factura: ${migratingFromSource.data.invoiceRef}` : ""}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-100">
          <Button variant="secondary" size="sm" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="primary" size="sm" onClick={onContinue}>
            Continuar al nuevo formulario
          </Button>
        </div>
      </div>
    </Modal>
  );
}
