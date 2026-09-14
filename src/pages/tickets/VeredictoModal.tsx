import { useState } from "react";
import { ApiError } from "../../api/client";
import { ticketVerdictsApi } from "../../api/ticketVerdicts";
import { Alert } from "../../components/ui/Alert";
import { Button } from "../../components/ui/Button";
import { TextField } from "../../components/ui/Field";
import { Modal } from "../../components/ui/Modal";
import { useSettle } from "../../hooks/useSettle";
import type { TicketVerdictResponse } from "../../types/api";

interface VeredictoModalProps {
  /** Sin veredicto = alta. */
  verdict?: TicketVerdictResponse;
  onClose: () => void;
  onSaved: () => void;
}

export function VeredictoModal({ verdict, onClose, onSaved }: VeredictoModalProps) {
  const [name, setName] = useState(verdict?.name ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [settle, triggerSettle] = useSettle();

  const ready = name.trim().length > 0;

  async function save() {
    if (!name.trim()) {
      setError("Nombre requerido");
      triggerSettle();
      return;
    }
    if (saving) return;

    setSaving(true);
    setError(null);

    const input = { name: name.trim() };

    try {
      if (verdict) await ticketVerdictsApi.update(verdict.id, input);
      else await ticketVerdictsApi.create(input);

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
      eyebrow="Tickets · Veredictos"
      title={verdict ? "Editar veredicto" : "Nuevo veredicto"}
      description="Estas son las opciones que se ofrecen al marcar un ticket como solucionado."
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
            {verdict ? "Guardar cambios" : "Crear veredicto"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <TextField
          label="Veredicto"
          required
          value={name}
          maxLength={120}
          placeholder="No procede, Reemplazo de producto…"
          state={error ? "error" : "idle"}
          onChange={(e) => {
            setName(e.target.value);
            if (error) setError(null);
          }}
        />

        {verdict && verdict.ticketCount > 0 && (
          <Alert variant="info">
            {verdict.ticketCount === 1
              ? "1 ticket usa este veredicto."
              : `${verdict.ticketCount} tickets usan este veredicto.`}
          </Alert>
        )}
      </div>
    </Modal>
  );
}
