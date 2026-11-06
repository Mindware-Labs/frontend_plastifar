import React, { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { LookupField } from "../../components/ui/Field";
import { Modal } from "../../components/ui/Modal";
import { FormModalFooter } from "../../components/ui/FormModalFooter";
import { useModalAnimation } from "../../hooks/useModalAnimation";
import { resolveClientLabel, searchClientsWithoutSalesRep } from "../../lib/lookups";

interface StaffSalesRepClientModalProps {
  staffName: string;
  onClose: () => void;
  onConfirm: (clientId: number) => void;
}

/** Segundo paso al marcar colaborador como vendedor: cliente sin vendedor activo. */
export function StaffSalesRepClientModal({
  staffName,
  onClose,
  onConfirm,
}: StaffSalesRepClientModalProps) {
  const { isExiting, requestClose } = useModalAnimation();
  const [error, setError] = useState<string | null>(null);
  const { control, handleSubmit } = useForm<{ clientId: string }>({
    defaultValues: { clientId: "" },
  });

  function submit(values: { clientId: string }) {
    setError(null);
    if (!values.clientId.trim()) {
      setError("Elige un cliente de la lista.");
      return;
    }
    onConfirm(Number(values.clientId));
    requestClose();
  }

  return (
    <Modal
      size="md"
      title="Cliente del vendedor"
      description={`Asigna a ${staffName} un cliente que todavía no tiene vendedor activo.`}
      onClose={onClose}
      isExiting={isExiting}
      onRequestClose={requestClose}
      footer={
        <FormModalFooter
          formId="staff-sales-rep-client-form"
          isEdit={false}
          createLabel="Confirmar cliente"
          onCancel={requestClose}
        />
      }
    >
      <form
        id="staff-sales-rep-client-form"
        onSubmit={handleSubmit(submit)}
        className="flex flex-col gap-3"
      >
        {error && <p className="text-[13px] text-red-600">{error}</p>}
        <Controller
          name="clientId"
          control={control}
          render={({ field }) => (
            <LookupField
              id="staff-sales-rep-client"
              size="sm"
              label="Cliente"
              required
              name={field.name}
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
              placeholder="Buscar cliente sin vendedor…"
              searchPlaceholder="Nombre o código…"
              search={searchClientsWithoutSalesRep}
              resolveSelectedLabel={resolveClientLabel}
              hint="Solo aparecen clientes sin vendedor asignado."
            />
          )}
        />
      </form>
    </Modal>
  );
}
