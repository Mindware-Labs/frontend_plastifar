import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { ApiError } from "../../api/client";
import { clientsApi } from "../../api/clients";
import { Alert } from "../../components/ui/Alert";
import { LookupField } from "../../components/ui/Field";
import { Modal } from "../../components/ui/Modal";
import { FormModalFooter } from "../../components/ui/FormModalFooter";
import { useModalAnimation } from "../../hooks/useModalAnimation";
import { resolveStaffLabel, searchSalesRepStaff } from "../../lib/lookups";
import type { Client } from "../../types/clients";
import { FormDivider } from "../../components/ui/FormDivider";

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
      size="sm"
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
        <FormModalFooter
          formId="bulk-reassign-form"
          isEdit={false}
          createLabel={clients.length === 1 ? "Reasignar cliente" : `Reasignar ${clients.length} clientes`}
          isSubmitting={formState.isSubmitting}
          onCancel={requestClose}
          size="sm"
          shortcut
        />
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

        <div className="rounded-edge border border-line bg-canvas p-3">
          <ul className="flex flex-col divide-y divide-line text-[12.5px]">
            {shown.map((client) => (
              <li key={client.id} className="flex items-center justify-between gap-2 py-1.5 first:pt-0 last:pb-0">
                <span className="truncate font-medium text-ink">{client.name}</span>
                <span className="shrink-0 font-mono text-[11px] text-subtle">{client.code}</span>
              </li>
            ))}
            {overflow > 0 && (
              <li className="pt-2 text-[11.5px] font-medium text-faint">
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
              search={searchSalesRepStaff}
              resolveSelectedLabel={resolveStaffLabel}
              hint="Se aplicará a todos los clientes seleccionados."
            />
          )}
        />
      </form>
    </Modal>
  );
}
