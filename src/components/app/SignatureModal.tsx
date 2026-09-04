import { useEffect, useState } from "react";
import { ApiError } from "../../api/client";
import { staffApi } from "../../api/staff";
import { useReceipts } from "../../context/useReceipts";
import { Alert } from "../ui/Alert";
import { Button } from "../ui/Button";
import { Modal } from "../ui/Modal";
import { Spinner } from "../ui/Spinner";

const MAX_LENGTH = 500;

/** La firma va al pie de cada correo que envia esta persona, debajo de un filete. */
export function SignatureModal({ onClose }: { onClose: () => void }) {
  const [signature, setSignature] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const receipts = useReceipts();

  useEffect(() => {
    let cancelled = false;

    staffApi
      .getSignature()
      .then((data) => {
        if (!cancelled) setSignature(data.signature ?? "");
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof ApiError ? err.message : "No se pudo cargar la firma");
        setSignature("");
      });

    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSave() {
    if (signature === null || saving) return;
    setSaving(true);
    setError(null);

    try {
      await staffApi.updateSignature(signature);
      receipts.done({ action: "firma", title: "Firma guardada" });
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo guardar la firma");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      eyebrow="Correo"
      title="Tu firma"
      description="Se agrega al final de los correos que envías, debajo de tu nombre."
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancelar
          </Button>
          <Button size="sm" onClick={handleSave} isLoading={saving} disabled={signature === null}>
            Guardar
          </Button>
        </>
      }
    >
      {error && (
        <div className="mb-3">
          <Alert variant="error">{error}</Alert>
        </div>
      )}

      {signature === null ? (
        <div className="flex h-32 items-center justify-center">
          <Spinner />
        </div>
      ) : (
        <>
          <textarea
            value={signature}
            maxLength={MAX_LENGTH}
            onChange={(event) => setSignature(event.target.value)}
            rows={6}
            placeholder={"Nombre Apellido\nSoporte · Plastifar\n809 000 0000"}
            className="w-full resize-none rounded-edge border border-line bg-white p-2.5 text-[13px]
              leading-relaxed text-ink outline-none transition-colors placeholder:text-faint
              focus:border-brand-red/40 focus:ring-3 focus:ring-brand-red/12"
          />
          <p className="mt-1.5 text-right text-[11px] text-faint">
            {signature.length}/{MAX_LENGTH}
          </p>
        </>
      )}
    </Modal>
  );
}
