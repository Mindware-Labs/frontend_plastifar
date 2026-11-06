import { UserCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { ApiError } from "../../api/client";
import { clientsApi } from "../../api/clients";
import { Alert } from "../../components/ui/Alert";
import { Button } from "../../components/ui/Button";
import { LookupField } from "../../components/ui/Field";
import { Modal } from "../../components/ui/Modal";
import { useModalAnimation } from "../../hooks/useModalAnimation";
import { resolveStaffLabel, searchSalesRepStaff } from "../../lib/lookups";
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
      maxWidth="max-w-md"
      eyebrow={`Cliente #${client.id} · ${client.code}`}
      title="Reasignar vendedor"
      description={`Actualiza quién atiende comercialmente a ${client.name}.`}
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
              form="reassign-form"
              size="sm"
              isLoading={formState.isSubmitting}
            >
              Guardar cambios
            </Button>
          </div>
        </div>
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

        <div className="rounded-lg border border-zinc-200/80 bg-zinc-50/70 p-3">
          <div className="flex items-center justify-between gap-2">
            <span className="font-mono text-[11px] font-semibold text-zinc-500">
              {client.code}
            </span>
            <span className="inline-flex items-center rounded-md border border-zinc-200/80 bg-white px-2 py-0.5 text-[11px] font-medium text-zinc-600 shadow-2xs">
              {client.type}
            </span>
          </div>
          <p className="mt-1 text-[13.5px] font-semibold text-zinc-900 truncate" title={client.name}>
            {client.name}
          </p>
          <div className="mt-2.5 flex items-center gap-1.5 border-t border-zinc-200/60 pt-2 text-[12px] text-zinc-500">
            <UserCheck className="h-3.5 w-3.5 shrink-0 text-zinc-400" />
            <span>Vendedor actual:</span>
            <span className="font-medium text-zinc-800">
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
