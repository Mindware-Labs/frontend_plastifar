import { Button } from "../../../components/ui/Button";
import { SelectField, TextField } from "../../../components/ui/Field";
import { Modal } from "../../../components/ui/Modal";
import { Spinner } from "../../../components/ui/Spinner";
import type { TicketAssignFlow } from "./useTicketAssign";

interface TicketAssignModalProps {
  flow: TicketAssignFlow;
  ticketNumber: string;
  settle: boolean;
}

/** Dialogo "Asignar ticket". */
export function TicketAssignModal({ flow, ticketNumber, settle }: TicketAssignModalProps) {
  const {
    setShowAssignModal,
    assignableStaff,
    loadingStaff,
    selectedStaffId,
    setSelectedStaffId,
    assignComment,
    setAssignComment,
    assigning,
    assignError,
    setAssignError,
    handleConfirmAssign,
  } = flow;

  return (
    <Modal
      settle={settle}
      eyebrow={ticketNumber}
      title="Asignar ticket"
      description="Solo aparecen colaboradores activos con acceso al departamento del ticket."
      maxWidth="max-w-md"
      onClose={() => {
        if (!assigning) setShowAssignModal(false);
      }}
      footer={
        <>
          <Button type="button" variant="secondary" size="sm" disabled={assigning} onClick={() => setShowAssignModal(false)}>
            Cancelar
          </Button>
          <Button
            type="submit"
            form="assign-ticket-form"
            size="sm"
            isLoading={assigning}
            tone={assignError ? "ink" : "primary"}
            toneLabel={assignError}
          >
            Guardar asignación
          </Button>
        </>
      }
    >
      <form id="assign-ticket-form" onSubmit={handleConfirmAssign} className="space-y-3">
        {loadingStaff ? (
          <div className="flex justify-center py-6">
            <Spinner size="sm" label="Cargando colaboradores…" />
          </div>
        ) : (
          <>
            <SelectField
              id="assign-staff-select"
              label="Colaborador"
              size="sm"
              value={selectedStaffId}
              onChange={(val) => {
                setSelectedStaffId(val);
                if (assignError) setAssignError(null);
              }}
              options={[
                { value: "", label: "Sin asignar" },
                ...assignableStaff.map((s) => ({ value: String(s.id), label: s.fullName })),
              ]}
            />
            <TextField
              id="assign-comment-input"
              label="Comentario"
              size="sm"
              hint="Opcional: por qué cambia la persona responsable."
              value={assignComment}
              onChange={(event) => {
                setAssignComment(event.target.value);
                if (assignError) setAssignError(null);
              }}
              placeholder="Ej.: reasignado para soporte de producto"
            />
          </>
        )}
      </form>
    </Modal>
  );
}
