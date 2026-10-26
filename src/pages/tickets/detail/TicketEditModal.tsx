import { Button } from "../../../components/ui/Button";
import { SelectField, TextField } from "../../../components/ui/Field";
import { Modal } from "../../../components/ui/Modal";
import { Spinner } from "../../../components/ui/Spinner";
import { departmentPathOptions } from "../../../lib/departments";
import type { TicketDetailResponse } from "../../../types/api";
import { PRIORITY_OPTIONS } from "./ticketDetailShared";
import type { TicketEditFlow } from "./useTicketEdit";

interface TicketEditModalProps {
  flow: TicketEditFlow;
  ticketNumber: string;
  settle: boolean;
}

/** Dialogo "Editar clasificación y detalles". */
export function TicketEditModal({ flow, ticketNumber, settle }: TicketEditModalProps) {
  const {
    setShowEditModal,
    editSubject,
    setEditSubject,
    editTopicId,
    setEditTopicId,
    editPriority,
    setEditPriority,
    editDepartmentId,
    setEditDepartmentId,
    editProductLineId,
    setEditProductLineId,
    editError,
    setEditError,
    savingEdit,
    editCatalogs,
    loadingEditCatalogs,
    editDepartmentTree,
    handleConfirmEdit,
  } = flow;

  return (
    <Modal
      settle={settle}
      eyebrow={ticketNumber}
      title="Editar clasificación y detalles"
      description="Ajusta el asunto y la clasificación. El SLA se recalcula automáticamente."
      maxWidth="max-w-md"
      onClose={() => {
        if (!savingEdit) setShowEditModal(false);
      }}
      footer={
        <>
          <Button type="button" variant="secondary" size="sm" disabled={savingEdit} onClick={() => setShowEditModal(false)}>
            Cancelar
          </Button>
          <Button
            type="submit"
            form="edit-ticket-form"
            size="sm"
            isLoading={savingEdit}
            tone={editError ? "ink" : "primary"}
            toneLabel={editError}
          >
            Guardar cambios
          </Button>
        </>
      }
    >
      <form id="edit-ticket-form" onSubmit={handleConfirmEdit} className="space-y-3">
        {loadingEditCatalogs ? (
          <div className="flex justify-center py-6">
            <Spinner size="sm" label="Cargando catálogos…" />
          </div>
        ) : (
          <>
            <TextField
              id="edit-subject"
              label="Asunto"
              size="sm"
              required
              maxLength={200}
              value={editSubject}
              onChange={(event) => {
                setEditSubject(event.target.value);
                if (editError) setEditError(null);
              }}
              state={editError && !editSubject.trim() ? "error" : "idle"}
              placeholder="Describe brevemente el caso…"
            />

            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              <SelectField
                id="edit-topic"
                label="Motivo"
                size="sm"
                value={editTopicId !== null ? String(editTopicId) : ""}
                onChange={(value) => {
                  const nextId = value ? Number(value) : null;
                  setEditTopicId(nextId);
                  if (editError) setEditError(null);
                  // El motivo trae su departamento y prioridad por defecto; se pueden corregir despues.
                  const topic = nextId ? editCatalogs?.topics.find((t) => t.id === nextId) : undefined;
                  if (topic?.defaultDepartmentId) setEditDepartmentId(topic.defaultDepartmentId);
                  if (topic?.defaultPriority) setEditPriority(topic.defaultPriority);
                }}
                placeholder="Sin motivo"
                options={[
                  { value: "", label: "Sin motivo" },
                  ...(editCatalogs?.topics ?? []).map((t) => ({ value: String(t.id), label: t.name })),
                ]}
              />
              <SelectField
                id="edit-priority"
                label="Prioridad"
                size="sm"
                required
                value={editPriority}
                onChange={(value) => {
                  setEditPriority(value as TicketDetailResponse["priority"]);
                  if (editError) setEditError(null);
                }}
                options={PRIORITY_OPTIONS}
              />
              <div className="sm:col-span-2">
                <SelectField
                  id="edit-dept"
                  label="Departamento"
                  size="sm"
                  value={editDepartmentId !== null ? String(editDepartmentId) : ""}
                  onChange={(value) => {
                    setEditDepartmentId(value ? Number(value) : null);
                    if (editError) setEditError(null);
                  }}
                  placeholder="Sin departamento"
                  options={[
                    { value: "", label: "Sin departamento" },
                    ...departmentPathOptions(editCatalogs?.departments ?? [], editDepartmentTree),
                  ]}
                />
              </div>
              <div className="sm:col-span-2">
                <SelectField
                  id="edit-line"
                  label="Línea de producto"
                  size="sm"
                  value={editProductLineId !== null ? String(editProductLineId) : ""}
                  onChange={(value) => {
                    setEditProductLineId(value ? Number(value) : null);
                    if (editError) setEditError(null);
                  }}
                  placeholder="No aplica"
                  options={[
                    { value: "", label: "No aplica" },
                    ...(editCatalogs?.productLines ?? []).map((line) => ({
                      value: String(line.id),
                      label: `${line.name} (${line.code})`,
                    })),
                  ]}
                />
              </div>
            </div>

            <p className="text-[11px] leading-normal text-zinc-400">
              Si cambias el departamento y la persona asignada no pertenece al nuevo, quedará sin asignar.
            </p>
          </>
        )}
      </form>
    </Modal>
  );
}
