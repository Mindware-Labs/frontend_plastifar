import { Building2, Info, Truck } from "lucide-react";
import { Controller, type Control } from "react-hook-form";
import { DateField, LookupField, type FieldState } from "../../../components/ui/Field";
import { resolveTicketLabel, searchTickets } from "../../../lib/discrepancies";
import type { FormValues } from "./discrepancyForm";

interface DiscrepancyOriginStepProps {
  control: Control<FormValues>;
  ticketLabel: string | undefined;
  setTicketLabel: (label: string) => void;
  effectiveTicketClientName: string | undefined;
  setEffectiveTicketClientName: (name: string) => void;
  /** Ticket fijo: en edicion o cuando se abre desde un ticket concreto. */
  ticketLocked: boolean;
  ticketState: FieldState;
  ticketError: string | undefined;
  discrepancyDate: string;
  setDiscrepancyDate: (date: string) => void;
}

/** Paso 1: Origen e Identificacion (Diseno Editorial Simetrico de 2 Columnas) */
export function DiscrepancyOriginStep({
  control,
  ticketLabel,
  setTicketLabel,
  effectiveTicketClientName,
  setEffectiveTicketClientName,
  ticketLocked,
  ticketState,
  ticketError,
  discrepancyDate,
  setDiscrepancyDate,
}: DiscrepancyOriginStepProps) {
  return (
    <div className="flex flex-col gap-5 animate-plf-fade">
      {/* Grilla simétrica de 2 paneles principales */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-stretch">
        {/* Panel 1 (Izquierda): Identificación del Caso & Ticket */}
        <div className="flex flex-col justify-between rounded-xl border border-zinc-200/90 bg-white shadow-2xs overflow-hidden">
          {/* Cabecera del panel */}
          <div className="border-b border-zinc-100 bg-zinc-50/70 px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="flex size-6 items-center justify-center rounded-md bg-zinc-200/60 text-zinc-700 font-heading text-xs font-bold">
                1
              </span>
              <h3 className="font-heading text-xs font-bold uppercase tracking-wider text-zinc-800">
                Identificación del Caso
              </h3>
            </div>
            <span className="font-heading text-[10.5px] font-bold uppercase tracking-wider text-purple-700 bg-purple-50 border border-purple-200/80 px-2 py-0.5 rounded-md">
              PF-FOR-291
            </span>
          </div>

          {/* Cuerpo del panel */}
          <div className="p-4 sm:p-5 flex-1 flex flex-col gap-4">
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
                  disabled={ticketLocked}
                  state={ticketState}
                  error={ticketError}
                />
              )}
            />

            {/* Ficha sintética del ticket seleccionado */}
            {ticketLabel ? (
              <div className="rounded-lg border border-zinc-200/80 bg-zinc-50/50 p-3.5 space-y-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex flex-col min-w-0">
                    <span className="text-[10px] font-heading font-bold uppercase tracking-wider text-zinc-400">
                      Asunto del caso
                    </span>
                    <span className="text-xs font-semibold text-zinc-900 mt-0.5 line-clamp-2" title={ticketLabel}>
                      {ticketLabel}
                    </span>
                  </div>
                </div>

                {effectiveTicketClientName && (
                  <div className="pt-2 border-t border-zinc-200/60 flex items-center justify-between text-xs">
                    <span className="text-zinc-500 font-medium flex items-center gap-1.5">
                      <Building2 className="size-3.5 text-zinc-400" />
                      <span>Cliente</span>
                    </span>
                    <span className="font-semibold text-zinc-800 truncate max-w-[220px]">
                      {effectiveTicketClientName}
                    </span>
                  </div>
                )}
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-zinc-200 bg-zinc-50/30 p-4 text-center">
                <p className="text-xs text-zinc-400">
                  Selecciona un ticket para vincular automáticamente los datos del cliente y reclamo.
                </p>
              </div>
            )}
          </div>

          {/* Pie informativo del panel */}
          <div className="bg-zinc-50/50 px-4 py-2.5 border-t border-zinc-100 text-[11px] text-zinc-400 flex items-center gap-1.5">
            <Info className="size-3.5 shrink-0 text-zinc-400" />
            <span>Documenta diferencias entre la carga facturada y la despachada.</span>
          </div>
        </div>

        {/* Panel 2 (Derecha): Fecha de Despacho & Parámetros Operativos */}
        <div className="flex flex-col justify-between rounded-xl border border-zinc-200/90 bg-white shadow-2xs overflow-hidden">
          {/* Cabecera del panel */}
          <div className="border-b border-zinc-100 bg-zinc-50/70 px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="flex size-6 items-center justify-center rounded-md bg-zinc-200/60 text-zinc-700 font-heading text-xs font-bold">
                2
              </span>
              <h3 className="font-heading text-xs font-bold uppercase tracking-wider text-zinc-800">
                Fecha del Despacho y Registro
              </h3>
            </div>
            <span className="font-heading text-[10.5px] font-medium uppercase tracking-wider text-zinc-400">
              Control Operativo
            </span>
          </div>

          {/* Cuerpo del panel */}
          <div className="p-4 sm:p-5 flex-1 flex flex-col gap-4">
            <DateField
              label="Fecha del despacho"
              required
              value={discrepancyDate}
              onChange={setDiscrepancyDate}
              placeholder="Seleccionar fecha…"
              headerLabel="Fecha del despacho"
              align="end"
            />

            {/* Pauta operativa */}
            <div className="rounded-lg border border-zinc-200/80 bg-zinc-50/50 p-3.5 space-y-2">
              <span className="text-[10px] font-heading font-bold uppercase tracking-wider text-zinc-400 block">
                Criterios de verificación inicial
              </span>
              <ul className="text-xs text-zinc-600 space-y-1.5 leading-relaxed">
                <li className="flex items-start gap-2">
                  <span className="size-1.5 rounded-full bg-brand-red mt-1.5 shrink-0" />
                  <span>Verificar concordancia con la factura y conduce de salida.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="size-1.5 rounded-full bg-brand-red mt-1.5 shrink-0" />
                  <span>En el siguiente paso se registrarán los productos sobrantes o faltantes.</span>
                </li>
              </ul>
            </div>
          </div>

          {/* Pie informativo del panel */}
          <div className="bg-zinc-50/50 px-4 py-2.5 border-t border-zinc-100 text-[11px] text-zinc-400 flex items-center gap-1.5">
            <Truck className="size-3.5 shrink-0 text-zinc-400" />
            <span>Fecha oficial para trazabilidad de precinto y contenedor.</span>
          </div>
        </div>
      </div>

      {/* Banner de Flujo de Investigación (3 Fases) */}
      <div className="rounded-xl border border-zinc-200/80 bg-zinc-50/60 p-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <span className="font-heading font-bold text-zinc-900 text-xs">
              Estructura Oficial del Formato:
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-zinc-500">
            <span className="inline-flex items-center gap-1 font-semibold text-zinc-800">
              <span className="flex size-4 items-center justify-center rounded-full bg-emerald-600 text-white text-[9px] font-bold">1</span>
              Origen y Ticket
            </span>
            <span className="text-zinc-300">→</span>
            <span className="inline-flex items-center gap-1 font-medium text-zinc-600">
              <span className="flex size-4 items-center justify-center rounded-full bg-zinc-200 text-zinc-700 text-[9px] font-bold">2</span>
              Líneas en Discrepancia
            </span>
            <span className="text-zinc-300">→</span>
            <span className="inline-flex items-center gap-1 font-medium text-zinc-600">
              <span className="flex size-4 items-center justify-center rounded-full bg-zinc-200 text-zinc-700 text-[9px] font-bold">3</span>
              9 Puntos de Seguridad
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
