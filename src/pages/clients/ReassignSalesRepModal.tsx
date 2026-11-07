import { UserCheck } from "lucide-react";
import { useEffect, useState } from "react";
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

interface ReassignSalesRepModalProps {
  client: Client;
  onClose: () => void;
  onSaved: () => void;
}

/** Acción rápida de fila (RF-C7): reasignar vendedor sin abrir la ficha completa. */
export function ReassignSalesRepModal({ client, onClose, onSaved }: ReassignSalesRepModalProps) {
  const [formError, setFormError] = useState<string | null>(null);
  const [currentRepName, setCurrentRepName] = useState<string | null>(null);
  const { isExiting, requestClose } = useModalAnimation();

  const { control, handleSubmit, formState } = useForm<{ salesRepStaffId: string }>({
    defaultValues: { salesRepStaffId: client.salesRepStaffId ? String(client.salesRepStaffId) : "" },
  });

  useEffect(() => {
    if (client.salesRepStaffId) {
      void resolveStaffLabel(String(client.salesRepStaffId)).then((name) => {
        if (name) setCurrentRepName(name);
      });
    }
  }, [client.salesRepStaffId]);

  // No existe un endpoint de un solo campo: hay que mandar el cliente entero.
  // Por eso se relee antes de escribir — la fila del listado puede llevar
  // minutos en pantalla, y mandarla tal cual revertiría en silencio cualquier
  // campo que otra persona haya cambiado mientras tanto.
  async function onSubmit(values: { salesRepStaffId: string }) {
    setFormError(null);
    try {
      const { client: fresh } = await clientsApi.get(client.id);
      await clientsApi.update(client.id, {
        code: fresh.code,
        name: fresh.name,
        taxId: fresh.taxId,
        type: fresh.type,
        salesRepStaffId: values.salesRepStaffId === "" ? null : Number(values.salesRepStaffId),
        phone: fresh.phone,
        email: fresh.email,
        contactPersonName: fresh.contactPersonName,
        address: fresh.address,
        notes: fresh.notes,
        isActive: fresh.isActive,
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
      eyebrow={`Cliente #${client.id} · ${client.code}`}
      title="Reasignar vendedor"
      description={`Actualiza quién atiende comercialmente a ${client.name}.`}
      onClose={onClose}
      isExiting={isExiting}
      onRequestClose={requestClose}
      footer={
        <FormModalFooter
          formId="reassign-form"
          isEdit={false}
          createLabel="Guardar cambios"
          isSubmitting={formState.isSubmitting}
          onCancel={requestClose}
          size="sm"
          shortcut
        />
      }
    >
      <form
        id="reassign-form"
        onSubmit={handleSubmit(onSubmit)}
        onKeyDown={handleKeyDown}
        noValidate
        className="flex flex-col gap-3 text-left"
      >
        {formError && <Alert variant="error">{formError}</Alert>}

        {/* 1. INFORMACIÓN DEL CLIENTE */}
        <FormDivider title="Cliente" />

        <div className="rounded-edge border border-line bg-canvas p-3">
          <div className="flex items-center justify-between gap-2">
            <span className="font-mono text-[11px] font-semibold text-subtle">
              {client.code}
            </span>
            <span className="inline-flex items-center rounded-edge border border-line bg-white px-2 py-0.5 text-[11px] font-medium text-subtle shadow-2xs">
              {client.type}
            </span>
          </div>
          <p className="mt-1 text-[13.5px] font-semibold text-ink truncate" title={client.name}>
            {client.name}
          </p>
          <div className="mt-2.5 flex items-center gap-1.5 border-t border-line pt-2 text-[12px] text-subtle">
            <UserCheck className="h-3.5 w-3.5 shrink-0 text-faint" />
            <span>Vendedor actual:</span>
            <span className="font-medium text-ink">
              {currentRepName ?? (client.salesRepStaffId ? "Cargando…" : "Sin vendedor asignado")}
            </span>
          </div>
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
              hint="El vendedor seleccionado debe ser personal activo de Plastifar."
            />
          )}
        />
      </form>
    </Modal>
  );
}
