import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { ApiError } from "../../api/client";
import { clientsApi } from "../../api/clients";
import { Alert } from "../../components/ui/Alert";
import { Button } from "../../components/ui/Button";
import { LookupField } from "../../components/ui/Field";
import { Modal } from "../../components/ui/Modal";
import { useModalAnimation } from "../../hooks/useModalAnimation";
import { resolveStaffLabel, searchActiveStaff } from "../../lib/lookups";
import type { Client } from "../../types/clients";

function FormDivider({ title }: { title: string }) {
  return (
    <div className="flex items-center gap-2 pt-2 border-t border-zinc-100 first:border-0 first:pt-0">
      <span className="font-heading text-[10px] font-bold uppercase tracking-[0.08em] text-zinc-400 select-none">
        {title}
      </span>
      <div className="h-px flex-1 bg-zinc-100" />
    </div>
  );
}

interface BulkReassignSalesRepModalProps {
  clients: Client[];
  onClose: () => void;
  onSaved: () => void;
}

/**
 * RF-C7 en lote: mover una cartera de un vendedor a otro en una sola operación.
 */
export function BulkReassignSalesRepModal({ clients, onClose, onSaved }: BulkReassignSalesRepModalProps) {
  const [formError, setFormError] = useState<string | null>(null);
  const { isExiting, requestClose } = useModalAnimation();

  const { control, handleSubmit, formState } = useForm<{ salesRepStaffId: string }>({
    defaultValues: { salesRepStaffId: "" },
  });

  const shown = clients.slice(0, 5);
  const overflow = clients.length - shown.length;

  async function onSubmit(values: { salesRepStaffId: string }) {
    setFormError(null);
    try {
      await clientsApi.bulkReassignSalesRep({
        clientIds: clients.map((client) => client.id),
        salesRepStaffId: values.salesRepStaffId === "" ? null : Number(values.salesRepStaffId),
      });
      onSaved();
      requestClose();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "No se pudo reasignar el vendedor");
    }
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLFormElement>) {
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
      event.preventDefault();
      void handleSubmit(onSubmit)();
    }
  }

  return (
    <Modal
      maxWidth="max-w-md"
      eyebrow={`${clients.length} ${clients.length === 1 ? "cliente seleccionado" : "clientes seleccionados"}`}
      title="Reasignar vendedor en lote"
      description={
        clients.length === 1
          ? "Cambia quién atiende comercialmente al cliente seleccionado."
          : `Cambia quién atiende comercialmente a los ${clients.length} clientes seleccionados.`
      }
      onClose={onClose}
      isExiting={isExiting}
      onRequestClose={requestClose}
      footer={
        <div className="flex w-full items-center justify-between gap-3">
          <span className="hidden sm:inline-flex items-center gap-1 text-[11px] text-zinc-400 select-none">
            <kbd className="rounded border border-zinc-200 bg-zinc-100 px-1 py-0.5 text-[10px] font-mono text-zinc-500">
              Ctrl
            </kbd>
            <span>+</span>
            <kbd className="rounded border border-zinc-200 bg-zinc-100 px-1 py-0.5 text-[10px] font-mono text-zinc-500">
              Enter
            </kbd>
            <span className="ml-0.5">para guardar</span>
          </span>
          <div className="flex items-center gap-2 ml-auto">
            <Button type="button" variant="secondary" size="sm" onClick={requestClose}>
              Cancelar
            </Button>
            <Button
              type="submit"
              form="bulk-reassign-form"
              size="sm"
              isLoading={formState.isSubmitting}
            >
              {clients.length === 1 ? "Reasignar cliente" : `Reasignar ${clients.length} clientes`}
            </Button>
          </div>
        </div>
      }
    >
      <form
        id="bulk-reassign-form"
        onSubmit={handleSubmit(onSubmit)}
        onKeyDown={handleKeyDown}
        noValidate
        className="flex flex-col gap-3 text-left"
      >
        {formError && <Alert variant="error">{formError}</Alert>}

        {/* 1. CLIENTES AFECTADOS */}
        <FormDivider title="Clientes seleccionados" />

        <div className="rounded-lg border border-zinc-200/80 bg-zinc-50/70 p-3">
          <ul className="flex flex-col divide-y divide-zinc-200/60 text-[12.5px]">
            {shown.map((client) => (
              <li key={client.id} className="flex items-center justify-between gap-2 py-1.5 first:pt-0 last:pb-0">
                <span className="truncate font-medium text-zinc-900">{client.name}</span>
                <span className="shrink-0 font-mono text-[11px] text-zinc-500">{client.code}</span>
              </li>
            ))}
            {overflow > 0 && (
              <li className="pt-2 text-[11.5px] font-medium text-zinc-400">
                + {overflow} {overflow === 1 ? "cliente más" : "clientes más"}
              </li>
            )}
          </ul>
        </div>

        {/* 2. NUEVA ASIGNACIÓN COMERCIAL */}
        <FormDivider title="Nueva asignación comercial" />

        <Controller
          name="salesRepStaffId"
          control={control}
          render={({ field }) => (
            <LookupField
              size="sm"
              label="Vendedor asignado"
              name={field.name}
              value={field.value}
              onChange={(value) => field.onChange(value)}
              onBlur={field.onBlur}
              placeholder="Sin vendedor asignado"
              searchPlaceholder="Buscar vendedor…"
              clearLabel="Sin vendedor asignado"
              search={searchActiveStaff}
              resolveSelectedLabel={resolveStaffLabel}
              hint="Se aplicará a todos los clientes seleccionados."
            />
          )}
        />
      </form>
    </Modal>
  );
}
