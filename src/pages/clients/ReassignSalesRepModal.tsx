import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { ApiError } from "../../api/client";
import { clientsApi } from "../../api/clients";
import { Alert } from "../../components/ui/Alert";
import { Button } from "../../components/ui/Button";
import { SelectField } from "../../components/ui/Field";
import { Modal } from "../../components/ui/Modal";
import type { Client } from "../../types/clients";

interface ReassignSalesRepModalProps {
  client: Client;
  salesReps: { id: number; name: string }[];
  onClose: () => void;
  onSaved: () => void;
}

/** Accion rapida de fila (RF-C7): reasignar vendedor sin abrir la ficha completa. */
export function ReassignSalesRepModal({ client, salesReps, onClose, onSaved }: ReassignSalesRepModalProps) {
  const [formError, setFormError] = useState<string | null>(null);
  const { control, handleSubmit, formState } = useForm<{ salesRepStaffId: string }>({
    defaultValues: { salesRepStaffId: client.salesRepStaffId ? String(client.salesRepStaffId) : "" },
  });

  // No existe un endpoint de un solo campo: se manda el cliente entero con el
  // vendedor cambiado, igual que hace la edicion completa.
  async function onSubmit(values: { salesRepStaffId: string }) {
    setFormError(null);
    try {
      await clientsApi.update(client.id, {
        code: client.code,
        name: client.name,
        taxId: client.taxId,
        type: client.type,
        territoryId: client.territoryId,
        salesRepStaffId: values.salesRepStaffId === "" ? null : Number(values.salesRepStaffId),
        phone: client.phone,
        email: client.email,
        address: client.address,
        notes: client.notes,
        isActive: client.isActive,
      });
      onSaved();
      onClose();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "No se pudo reasignar el vendedor");
    }
  }

  return (
    <Modal
      title="Reasignar vendedor"
      description={`Cambia quién atiende comercialmente a ${client.name}.`}
      onClose={onClose}
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" form="reassign-form" isLoading={formState.isSubmitting}>
            Guardar
          </Button>
        </>
      }
    >
      <form id="reassign-form" onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
        {formError && <Alert variant="error">{formError}</Alert>}

        <Controller
          name="salesRepStaffId"
          control={control}
          render={({ field }) => (
            <SelectField
              label="Vendedor"
              name={field.name}
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
              placeholder="Sin vendedor asignado"
              options={[
                { value: "", label: "Sin vendedor asignado" },
                ...salesReps.map((rep) => ({ value: String(rep.id), label: rep.name })),
              ]}
            />
          )}
        />
      </form>
    </Modal>
  );
}
