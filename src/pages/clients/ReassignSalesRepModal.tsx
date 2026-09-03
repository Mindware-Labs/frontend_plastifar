import { Controller, useForm } from "react-hook-form";
import { Button } from "../../components/ui/Button";
import { SelectField } from "../../components/ui/Field";
import { Modal } from "../../components/ui/Modal";
import type { Client } from "../../types/clients";

interface ReassignSalesRepModalProps {
  client: Client;
  salesReps: { id: number; name: string }[];
  onClose: () => void;
  onSave: (salesRepStaffId: number | null) => void;
}

/** Accion rapida de fila (RF-C7): reasignar vendedor sin abrir la ficha completa. */
export function ReassignSalesRepModal({
  client,
  salesReps,
  onClose,
  onSave,
}: ReassignSalesRepModalProps) {
  const { control, handleSubmit, formState } = useForm<{ salesRepStaffId: string }>({
    defaultValues: { salesRepStaffId: client.salesRepStaffId ? String(client.salesRepStaffId) : "" },
  });

  function onSubmit(values: { salesRepStaffId: string }) {
    onSave(values.salesRepStaffId === "" ? null : Number(values.salesRepStaffId));
    onClose();
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
      <form id="reassign-form" onSubmit={handleSubmit(onSubmit)} noValidate>
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
