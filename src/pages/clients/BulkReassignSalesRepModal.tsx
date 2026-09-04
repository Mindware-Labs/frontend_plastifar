import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { ApiError } from "../../api/client";
import { clientsApi } from "../../api/clients";
import { Alert } from "../../components/ui/Alert";
import { Button } from "../../components/ui/Button";
import { SelectField } from "../../components/ui/Field";
import { Modal } from "../../components/ui/Modal";
import type { Client } from "../../types/clients";

interface BulkReassignSalesRepModalProps {
  clients: Client[];
  salesReps: { id: number; name: string }[];
  onClose: () => void;
  onSaved: () => void;
}

/**
 * RF-C7 en lote: la mitad comercial de este modulo es mover una cartera de un
 * vendedor a otro cuando alguien entra o sale, y hacerlo cliente por cliente
 * son treinta dialogos.
 *
 * El dialogo nombra a quien va a tocar antes de tocarlo: una accion sobre una
 * seleccion que no se ve es una accion a ciegas.
 */
export function BulkReassignSalesRepModal({ clients, salesReps, onClose, onSaved }: BulkReassignSalesRepModalProps) {
  const [formError, setFormError] = useState<string | null>(null);
  const { control, handleSubmit, formState } = useForm<{ salesRepStaffId: string }>({
    defaultValues: { salesRepStaffId: "" },
  });

  const shown = clients.slice(0, 6);
  const overflow = clients.length - shown.length;

  async function onSubmit(values: { salesRepStaffId: string }) {
    setFormError(null);
    try {
      await clientsApi.bulkReassignSalesRep({
        clientIds: clients.map((client) => client.id),
        salesRepStaffId: values.salesRepStaffId === "" ? null : Number(values.salesRepStaffId),
      });
      onSaved();
      onClose();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "No se pudo reasignar el vendedor");
    }
  }

  return (
    <Modal
      title="Reasignar vendedor en lote"
      description={`Cambia quién atiende comercialmente a ${clients.length} clientes seleccionados.`}
      onClose={onClose}
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" form="bulk-reassign-form" isLoading={formState.isSubmitting}>
            Reasignar {clients.length}
          </Button>
        </>
      }
    >
      <form
        id="bulk-reassign-form"
        onSubmit={handleSubmit(onSubmit)}
        noValidate
        className="flex flex-col gap-4"
      >
        {formError && <Alert variant="error">{formError}</Alert>}

        <ul className="flex flex-col gap-1 rounded-edge bg-canvas px-3 py-2.5 text-[12.5px] text-brand-gray">
          {shown.map((client) => (
            <li key={client.id} className="truncate">
              {client.name}
            </li>
          ))}
          {overflow > 0 && (
            <li className="text-faint">
              y {overflow} {overflow === 1 ? "cliente más" : "clientes más"}
            </li>
          )}
        </ul>

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
              placeholder="Elige uno"
              options={[
                { value: "", label: "Sin vendedor asignado" },
                ...salesReps.map((rep) => ({ value: String(rep.id), label: rep.name })),
              ]}
              hint="Se aplica a todos los clientes de la lista, incluidos los que ya tenían vendedor."
            />
          )}
        />

        <Alert variant="info">
          El vendedor asignado debe ser personal activo. Si se desactiva, sus clientes vuelven al
          filtro «Sin vendedor» para reasignarlos.
        </Alert>
      </form>
    </Modal>
  );
}
