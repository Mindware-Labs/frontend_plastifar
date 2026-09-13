import { Calendar, Plus, UserCheck } from "lucide-react";
import { useState } from "react";
import { Button } from "../../components/ui/Button";
import { DatePicker } from "../../components/ui/DatePicker";
import { SelectField, TextField } from "../../components/ui/Field";
import { Modal } from "../../components/ui/Modal";
import { useSettle } from "../../hooks/useSettle";
import type { CreateTicketTaskRequest, TicketStaffOptionResponse } from "../../types/api";

interface CreateTaskModalProps {
  open: boolean;
  onClose: () => void;
  onCreate: (task: CreateTicketTaskRequest) => Promise<void>;
  assignableStaff: TicketStaffOptionResponse[];
  currentStaffId: number;
}

export function CreateTaskModal({
  open,
  onClose,
  onCreate,
  assignableStaff,
  currentStaffId,
}: CreateTaskModalProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [assignedStaffId, setAssignedStaffId] = useState<string>("");
  const [dueDate, setDueDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [settle, triggerSettle] = useSettle();

  if (!open) return null;

  const handleAutoassign = () => {
    setAssignedStaffId(String(currentStaffId));
    if (error) setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError("Título requerido");
      triggerSettle();
      return;
    }

    try {
      setSaving(true);
      setError(null);
      await onCreate({
        title: title.trim(),
        description: description.trim() || null,
        assignedStaffId: assignedStaffId ? Number(assignedStaffId) : null,
        dueDate: dueDate ? new Date(`${dueDate}T23:59:59`).toISOString() : null,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al crear la tarea");
      triggerSettle();
    } finally {
      setSaving(false);
    }
  };

  const isSelfAssigned = assignedStaffId === String(currentStaffId);

  return (
    <Modal
      settle={settle}
      onClose={() => {
        if (!saving) onClose();
      }}
      title="Nueva tarea para este ticket"
      description="Asigna una acción interna (investigación, verificación, reclamo con fábrica) a ti o a otro colaborador."
      eyebrow="Tareas internas"
      maxWidth="max-w-lg"
      footer={
        <>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={onClose}
            disabled={saving}
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            size="sm"
            disabled={saving}
            tone={error ? "ink" : "primary"}
            toneLabel={error}
            onClick={handleSubmit}
          >
            <Plus className="h-3.5 w-3.5" />
            {saving ? "Creando tarea..." : "Crear tarea"}
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <TextField
          id="task-title"
          label="Título de la tarea *"
          placeholder="Ej.: Investigar lote reportado con almacén"
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            if (error) setError(null);
          }}
          state={error && !title.trim() ? "error" : "idle"}
          size="sm"
          autoFocus
        />

        <div className="flex flex-col gap-1">
          <label
            htmlFor="task-description"
            className="font-heading text-[11px] font-semibold text-zinc-500"
          >
            Descripción o instrucciones
          </label>
          <textarea
            id="task-description"
            rows={3}
            placeholder="Detalla qué se necesita averiguar, qué pruebas realizar o qué información recopilar..."
            value={description}
            onChange={(e) => {
              setDescription(e.target.value);
              if (error) setError(null);
            }}
            className="w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-[12.5px] text-zinc-800 shadow-2xs outline-none transition-colors focus:border-brand-red focus:ring-1 focus:ring-brand-red/20 placeholder:text-zinc-400"
          />
        </div>

        {/* Asignación y autoasignación rápida */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="font-heading text-[11px] font-semibold text-zinc-500">
              Asignar a
            </span>
            <button
              type="button"
              onClick={handleAutoassign}
              className={`inline-flex items-center gap-1 text-[11.5px] font-medium transition-colors ${
                isSelfAssigned
                  ? "text-brand-red font-semibold cursor-default"
                  : "text-zinc-500 hover:text-zinc-900 cursor-pointer hover:underline"
              }`}
            >
              <UserCheck className="size-3.5 text-brand-red" />
              {isSelfAssigned ? "Asignada a mí ✓" : "Autoasignarme a mí"}
            </button>
          </div>

          <SelectField
            id="task-assignee"
            label=""
            value={assignedStaffId}
            onChange={(val: string) => {
              setAssignedStaffId(val);
              if (error) setError(null);
            }}
            options={[
              { value: "", label: "Sin asignar (cualquiera del equipo)" },
              ...assignableStaff.map((staff) => ({
                value: String(staff.id),
                label: staff.id === currentStaffId ? `${staff.fullName} (Tú)` : staff.fullName,
              })),
            ]}
            size="sm"
          />
        </div>

        {/* Fecha límite opcional */}
        <div className="flex flex-col gap-1">
          <label
            htmlFor="task-due-date"
            className="font-heading text-[11px] font-semibold text-zinc-500 flex items-center gap-1.5"
          >
            <Calendar className="size-3.5 text-zinc-400" />
            Fecha límite de entrega (opcional)
          </label>
          <DatePicker
            id="task-due-date"
            value={dueDate}
            onChange={(val) => {
              setDueDate(val);
              if (error) setError(null);
            }}
            placeholder="Seleccionar fecha límite..."
            headerLabel="Fecha límite"
            align="center"
          />
        </div>
      </form>
    </Modal>
  );
}
