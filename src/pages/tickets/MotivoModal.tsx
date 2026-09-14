import { useState } from "react";
import { ApiError } from "../../api/client";
import { ticketTopicsApi } from "../../api/ticketTopics";
import { Alert } from "../../components/ui/Alert";
import { Button } from "../../components/ui/Button";
import { CheckboxField, SelectField, TextField } from "../../components/ui/Field";
import { Modal } from "../../components/ui/Modal";
import { useSettle } from "../../hooks/useSettle";
import type { DepartmentResponse, TicketTopicResponse } from "../../types/api";
import type { SlaPolicy } from "../../types/settings";

const priorities = ["Emergencia", "Alta", "Normal", "Baja"];

interface MotivoModalProps {
  /** Sin motivo = alta. */
  topic?: TicketTopicResponse;
  departments: DepartmentResponse[];
  /** Catálogo completo, para elegir de quién cuelga este motivo. */
  topics: TicketTopicResponse[];
  policies: SlaPolicy[];
  onClose: () => void;
  onSaved: () => void;
}

export function MotivoModal({
  topic,
  departments,
  topics,
  policies,
  onClose,
  onSaved,
}: MotivoModalProps) {
  const [name, setName] = useState(topic?.name ?? "");
  const [parentId, setParentId] = useState(topic?.parentId ? String(topic.parentId) : "");
  const [slaPolicyId, setSlaPolicyId] = useState(
    topic?.slaPolicyId ? String(topic.slaPolicyId) : "",
  );
  const [departmentId, setDepartmentId] = useState(
    topic ? String(topic.defaultDepartmentId) : "",
  );
  const [priority, setPriority] = useState(topic?.defaultPriority ?? "Normal");
  const [requiresProductLine, setRequiresProductLine] = useState(topic?.requiresProductLine ?? false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [settle, triggerSettle] = useSettle();

  const ready = name.trim().length > 0 && departmentId !== "";

  // Dos niveles, no un árbol: quien ya tiene padre no puede ser padre, nadie
  // es padre de sí mismo, y quien ya tiene hijos no puede pasar a tener padre
  // —eso crearía el tercer nivel por el otro extremo—. Es la misma regla que
  // valida POST/PUT /api/ticket-topics, y el servidor la vuelve a comprobar.
  const hasChildren = topic !== undefined && topics.some((c) => c.parentId === topic.id);
  const possibleParents = hasChildren
    ? []
    : topics.filter((c) => c.parentId === null && c.id !== topic?.id);

  // Una política desactivada no se aplica a nada: ofrecerla aquí prometería
  // un compromiso de tiempo que el reloj del ticket nunca usaría.
  const activePolicies = policies.filter((p) => p.isActive);

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
      parentId: parentId === "" ? null : Number(parentId),
      defaultDepartmentId: Number(departmentId),
      defaultPriority: priority,
      slaPolicyId: slaPolicyId === "" ? null : Number(slaPolicyId),
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
          label="Motivo padre"
          value={parentId}
          onChange={(val) => {
            setParentId(val);
            if (error) setError(null);
          }}
          options={[
            { value: "", label: "Ninguno · es de primer nivel" },
            ...possibleParents.map((p) => ({ value: String(p.id), label: p.name })),
          ]}
          hint={
            hasChildren
              ? "Este motivo ya tiene sub-motivos, así que no puede colgar de otro."
              : "El catálogo admite dos niveles: un motivo con padre ya no puede tener hijos."
          }
          disabled={hasChildren}
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

        <SelectField
          label="Política de SLA"
          value={slaPolicyId}
          onChange={(val) => {
            setSlaPolicyId(val);
            if (error) setError(null);
          }}
          options={[
            { value: "", label: `La predeterminada de ${priority.toLowerCase()}` },
            ...activePolicies.map((p) => ({ value: String(p.id), label: p.name })),
          ]}
          hint="Sin política propia se aplica la predeterminada de la prioridad de arriba."
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
