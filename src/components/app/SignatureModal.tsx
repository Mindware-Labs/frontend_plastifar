import { useEffect, useMemo, useState } from "react";
import { ApiError } from "../../api/client";
import { staffApi } from "../../api/staff";
import { useReceipts } from "../../context/useReceipts";
import { useModalAnimation } from "../../hooks/useModalAnimation";
import { Alert } from "../ui/Alert";
import { Button } from "../ui/Button";
import { TextField } from "../ui/Field";
import { Modal } from "../ui/Modal";
import { Spinner } from "../ui/Spinner";

const MAX_LENGTH = 500;
const NAME_MAX = 80;
const ROLE_MAX = 100;
const PHONE_MAX = 40;

interface SignatureFields {
  name: string;
  role: string;
  phone: string;
}

const EMPTY_FIELDS: SignatureFields = { name: "", role: "", phone: "" };

/** La firma guardada es un texto plano de 3 líneas: nombre, cargo y teléfono. */
function splitSignature(raw: string): SignatureFields {
  const [name = "", role = "", ...rest] = raw.split("\n");
  return { name, role, phone: rest.join(" ") };
}

function joinSignature(fields: SignatureFields): string {
  return [fields.name, fields.role, fields.phone]
    .map((line) => line.trim())
    .filter(Boolean)
    .join("\n");
}

/** La firma va al pie de cada correo que envia esta persona, debajo de un filete. */
export function SignatureModal({ onClose }: { onClose: () => void }) {
  const [fields, setFields] = useState<SignatureFields | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const receipts = useReceipts();
  const { isExiting, requestClose } = useModalAnimation();

  useEffect(() => {
    let cancelled = false;

    staffApi
      .getSignature()
      .then((data) => {
        if (!cancelled) setFields(splitSignature(data.signature ?? ""));
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof ApiError ? err.message : "No se pudo cargar la firma");
        setFields(EMPTY_FIELDS);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const signature = useMemo(() => (fields ? joinSignature(fields) : ""), [fields]);

  function update(key: keyof SignatureFields, value: string) {
    setFields((current) => (current ? { ...current, [key]: value } : current));
  }

  async function handleSave() {
    if (fields === null || saving) return;
    setSaving(true);
    setError(null);

    try {
      await staffApi.updateSignature(signature);
      receipts.done({ action: "firma", title: "Firma guardada" });
      requestClose();
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
      isExiting={isExiting}
      onRequestClose={requestClose}
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={requestClose}>
            Cancelar
          </Button>
          <Button size="sm" onClick={handleSave} isLoading={saving} disabled={fields === null}>
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

      {fields === null ? (
        <div className="flex h-32 items-center justify-center">
          <Spinner />
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-3">
            <TextField
              label="Nombre y apellido"
              placeholder="Nombre Apellido"
              maxLength={NAME_MAX}
              value={fields.name}
              onChange={(event) => update("name", event.target.value)}
            />
            <TextField
              label="Posición en la empresa"
              placeholder="Soporte · Plastifar"
              maxLength={ROLE_MAX}
              value={fields.role}
              onChange={(event) => update("role", event.target.value)}
            />
            <TextField
              label="Teléfono"
              placeholder="809 000 0000"
              maxLength={PHONE_MAX}
              value={fields.phone}
              onChange={(event) => update("phone", event.target.value)}
            />
          </div>
          <p className="mt-2 text-right text-[11px] text-faint">
            {signature.length}/{MAX_LENGTH}
          </p>
        </>
      )}
    </Modal>
  );
}
