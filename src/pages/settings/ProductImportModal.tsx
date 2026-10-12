import { FileUp } from "lucide-react";
import { useRef, useState } from "react";
import { ApiError } from "../../api/client";
import { settingsApi } from "../../api/settings";
import { Alert } from "../../components/ui/Alert";
import { Button } from "../../components/ui/Button";
import { Modal } from "../../components/ui/Modal";
import { useModalAnimation } from "../../hooks/useModalAnimation";
import type { ProductImportResult } from "../../types/settings";

/** Espejo de `ProductCsv.MaxBytes` en el servidor (5 MB). */
const MAX_BYTES = 5 * 1024 * 1024;
/** Espejo de `ProductCsv.MaxRows` en el servidor; aquí solo se enuncia. */
const MAX_ROWS = 50_000;

interface ProductImportModalProps {
  onClose: () => void;
  /** Se avisa tras cada carga que guardó algo, para que el listado se relea. */
  onImported: () => void;
}

/**
 * Carga de productos por archivo (docs/plan/00, regla 6). El servidor nunca
 * borra: crea los códigos que no existen y corrige la descripción de los que
 * sí. Lo que aquí se pinta es exactamente lo que respondió; nada se adelanta.
 */
export function ProductImportModal({ onClose, onImported }: ProductImportModalProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ProductImportResult | null>(null);
  const { isExiting, requestClose } = useModalAnimation();

  /* Mientras el archivo sube no se puede cerrar por ninguna vía. La salida la
     gobierna este componente (como en ConfirmDialog): si la gobernara el Modal,
     Escape, el aspa o el fondo arrancarían la animación de salida aunque
     `onClose` se negara, y el diálogo quedaría invisible e inerte sin llegar a
     desmontarse ni a mostrar el resultado. */
  function handleClose() {
    if (!busy) requestClose();
  }

  function choose(chosen: File | null) {
    setResult(null);
    setError(null);

    if (chosen === null) {
      setFile(null);
      return;
    }

    // Mismas dos comprobaciones que hace el servidor, para no subir en balde.
    if (!chosen.name.toLowerCase().endsWith(".csv")) {
      setFile(null);
      setError("El archivo debe ser un CSV (.csv).");
      return;
    }
    if (chosen.size > MAX_BYTES) {
      setFile(null);
      setError("El archivo supera el máximo de 5 MB.");
      return;
    }

    setFile(chosen);
  }

  async function upload() {
    if (file === null) return;

    setBusy(true);
    setError(null);
    try {
      const response = await settingsApi.products.import(file);
      setResult(response);
      setFile(null);
      if (response.created > 0 || response.updated > 0) onImported();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo cargar el archivo");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      title="Cargar productos por archivo"
      description="Crea los códigos que no existen y corrige la descripción de los que sí. Nunca elimina productos."
      onClose={onClose}
      isExiting={isExiting}
      onRequestClose={handleClose}
      footer={
        <>
          <Button type="button" variant="secondary" onClick={handleClose} disabled={busy}>
            {result ? "Cerrar" : "Cancelar"}
          </Button>
          <Button type="button" onClick={upload} disabled={file === null} isLoading={busy}>
            Cargar archivo
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {error && <Alert variant="error">{error}</Alert>}

        <div className="flex flex-col gap-2">
          <p className="text-[12.5px] leading-relaxed text-subtle">
            Archivo CSV en UTF-8, de hasta 5 MB y {MAX_ROWS.toLocaleString("es")} filas, con una
            primera fila de cabecera que incluya las
            columnas <strong className="font-semibold text-ink">Code</strong> y{" "}
            <strong className="font-semibold text-ink">Name</strong> (también se aceptan «Código» y
            «Descripción»). El separador puede ser coma o punto y coma. Las demás columnas se ignoran.
          </p>

          <input
            ref={inputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            aria-label="Archivo CSV de productos"
            onChange={(event) => {
              choose(event.target.files?.[0] ?? null);
              // Permite volver a elegir el mismo archivo tras corregirlo.
              if (inputRef.current) inputRef.current.value = "";
            }}
          />

          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => inputRef.current?.click()}
              disabled={busy}
            >
              <FileUp className="h-[15px] w-[15px]" />
              Elegir archivo
            </Button>
            <span className="min-w-0 flex-1 truncate text-[12.5px] text-subtle">
              {file ? file.name : <span className="text-faint">Ningún archivo elegido</span>}
            </span>
          </div>
        </div>

        {result && <ImportSummary result={result} />}
      </div>
    </Modal>
  );
}

function ImportSummary({ result }: { result: ProductImportResult }) {
  const nothingSaved = result.created === 0 && result.updated === 0;

  return (
    <section aria-label="Resultado de la carga" className="flex flex-col gap-3 border-t border-line pt-4">
      <Alert variant={result.rejected > 0 ? "info" : "success"}>
        {nothingSaved && result.rejected === 0 && result.unchanged === 0
          ? "El archivo no traía ninguna fila de producto."
          : nothingSaved
            ? "La carga terminó sin crear ni actualizar ningún producto."
            : "La carga terminó."}
      </Alert>

      <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-[12.5px] sm:grid-cols-4">
        <Count label="Creados" value={result.created} />
        <Count label="Actualizados" value={result.updated} />
        <Count label="Sin cambio" value={result.unchanged} />
        <Count label="Rechazados" value={result.rejected} />
      </dl>

      {result.rejections.length > 0 && (
        <div className="flex flex-col gap-2">
          <h3 className="text-[13px] font-semibold text-ink">Filas rechazadas</h3>
          <ul className="flex max-h-56 flex-col divide-y divide-line overflow-y-auto border-y border-line">
            {result.rejections.map((rejection) => (
              <li key={rejection.line} className="flex items-baseline gap-3 py-2 text-[12.5px]">
                <span className="w-16 shrink-0 text-faint">Línea {rejection.line}</span>
                <span className="w-24 shrink-0 truncate font-mono text-[12px] text-brand-gray">
                  {rejection.code ?? "—"}
                </span>
                <span className="min-w-0 flex-1 text-subtle">{rejection.reason}</span>
              </li>
            ))}
          </ul>
          {result.rejectionsTruncated && (
            <p className="text-[12.5px] text-faint">
              Se muestran las primeras {result.rejections.length} de {result.rejected} filas rechazadas.
              Corrige el archivo y vuelve a cargarlo para ver las siguientes.
            </p>
          )}
        </div>
      )}
    </section>
  );
}

function Count({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex flex-col">
      <dt className="text-faint">{label}</dt>
      <dd className="text-[15px] font-semibold text-ink">{value}</dd>
    </div>
  );
}
