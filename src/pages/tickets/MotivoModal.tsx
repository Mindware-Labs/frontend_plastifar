import { useState } from "react";
import { ApiError } from "../../api/client";
import { ticketTopicsApi } from "../../api/ticketTopics";
import { Alert } from "../../components/ui/Alert";
import { Button } from "../../components/ui/Button";
import { CheckboxField, SelectField, TextField } from "../../components/ui/Field";
import { Modal } from "../../components/ui/Modal";
import { useSettle } from "../../hooks/useSettle";
import type { DepartmentResponse, TicketTopicResponse } from "../../types/api";

const priorities = ["Emergencia", "Alta", "Normal", "Baja"];

interface MotivoModalProps {
  /** Sin motivo = alta. */
  topic?: TicketTopicResponse;
  departments: DepartmentResponse[];
  onClose: () => void;
  onSaved: () => void;
}

export function MotivoModal({ topic, departments, onClose, onSaved }: MotivoModalProps) {
  const [name, setName] = useState(topic?.name ?? "");
  const [departmentId, setDepartmentId] = useState(
    topic ? String(topic.defaultDepartmentId) : "",
  );
  const [priority, setPriority] = useState(topic?.defaultPriority ?? "Normal");
  const [requiresProductLine, setRequiresProductLine] = useState(topic?.requiresProductLine ?? false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [settle, triggerSettle] = useSettle();

  const ready = name.trim().length > 0 && departmentId !== "";

  async function save() {
    if (!name.trim()) {
      setError("Motivo requerido");
      triggerSettle();
      return;
    }
    if (!departmentId) {
      setError("Departamento requerido");
      triggerSettle();
      return;
    }
    if (saving) return;

    setSaving(true);
    setError(null);

    const input = {
      name: name.trim(),
      defaultDepartmentId: Number(departmentId),
      defaultPriority: priority,
      requiresProductLine,
    };

    try {
      if (topic) await ticketTopicsApi.update(topic.id, input);
      else await ticketTopicsApi.create(input);

      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Error al guardar");
      triggerSettle();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      settle={settle}
      eyebrow="Tickets · Motivos"
      title={topic ? "Editar motivo" : "Nuevo motivo"}
      description="El departamento que elijas aquí es el que se rellena solo al escoger este motivo en un ticket nuevo."
      onClose={() => !saving && onClose()}
      footer={
        <>
          <Button type="button" variant="secondary" disabled={saving} onClick={onClose}>
            Cancelar
          </Button>
          <Button
            type="button"
            variant="primary"
            isLoading={saving}
            disabled={!ready && !error}
            tone={error ? "ink" : "primary"}
            toneLabel={error}
            onClick={() => void save()}
          >
            {topic ? "Guardar cambios" : "Crear motivo"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <TextField
          label="Motivo"
          required
          value={name}
          maxLength={120}
          placeholder="Faltante, Defecto de impresión…"
          state={error && !name.trim() ? "error" : "idle"}
          onChange={(e) => {
            setName(e.target.value);
            if (error) setError(null);
          }}
        />

        <SelectField
          label="Departamento que lo atiende"
          required
          value={departmentId}
          onChange={(val) => {
            setDepartmentId(val);
            if (error) setError(null);
          }}
          state={error && !departmentId ? "error" : "idle"}
          placeholder="Elige un departamento"
          options={departments.map((d) => ({ value: String(d.id), label: d.name }))}
          hint="Al elegir este motivo en un ticket nuevo, el departamento se rellena solo con este."
        />

        <SelectField
          label="Prioridad por defecto"
          value={priority}
          onChange={(val) => {
            setPriority(val);
            if (error) setError(null);
          }}
          options={priorities.map((p) => ({ value: p, label: p }))}
          hint="Se copia al ticket al crearlo y decide sus tiempos de SLA."
        />

        <CheckboxField
          label="Exige línea de producto"
          description="El formulario obligará a indicar la línea antes de crear el ticket. Para reclamaciones de calidad."
          checked={requiresProductLine}
          onChange={(e) => {
            setRequiresProductLine(e.target.checked);
            if (error) setError(null);
          }}
        />

        {topic && topic.ticketCount > 0 && (
          <Alert variant="info">
            {topic.ticketCount === 1
              ? "1 ticket usa este motivo. Cambiar el departamento no mueve los que ya existen."
              : `${topic.ticketCount} tickets usan este motivo. Cambiar el departamento no mueve los que ya existen.`}
          </Alert>
        )}
      </div>
    </Modal>
  );
}
