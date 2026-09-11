import { useState } from "react";
import { ApiError } from "../../api/client";
import { ticketVerdictsApi } from "../../api/ticketVerdicts";
import { Alert } from "../../components/ui/Alert";
import { Button } from "../../components/ui/Button";
import { TextField } from "../../components/ui/Field";
import { Modal } from "../../components/ui/Modal";
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

  const ready = name.trim().length > 0;

  async function save() {
    if (!ready || saving) return;

    setSaving(true);
    setError(null);

    const input = { name: name.trim() };

    try {
      if (verdict) await ticketVerdictsApi.update(verdict.id, input);
      else await ticketVerdictsApi.create(input);

      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo guardar el veredicto");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      eyebrow="Tickets · Veredictos"
      title={verdict ? "Editar veredicto" : "Nuevo veredicto"}
      description="Estas son las opciones que se ofrecen al marcar un ticket como solucionado."
      onClose={() => !saving && onClose()}
      footer={
        <>
          <Button type="button" variant="secondary" disabled={saving} onClick={onClose}>
            Cancelar
          </Button>
          <Button type="button" variant="primary" isLoading={saving} disabled={!ready} onClick={() => void save()}>
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
          onChange={(e) => setName(e.target.value)}
        />

        {verdict && verdict.ticketCount > 0 && (
          <Alert variant="info">
            {verdict.ticketCount === 1
              ? "1 ticket usa este veredicto."
              : `${verdict.ticketCount} tickets usan este veredicto.`}
          </Alert>
        )}

        {error && <Alert variant="error">{error}</Alert>}
      </div>
    </Modal>
  );
}
