import { useRef, useState } from "react";
import { useUploadFeedback } from "./useUploadFeedback";

export const MAX_EMAIL_FILES = 5;
const MAX_EMAIL_TOTAL_BYTES = 10 * 1024 * 1024;

/**
 * Adjuntos de un correo que se esta escribiendo: lista, limites y el aviso de "adjuntado".
 * Los errores de limite se informan por `setError`, el mismo aviso del editor.
 */
export function useEmailAttachments(setError: (message: string | null) => void) {
  const [files, setFiles] = useState<File[]>([]);
  const {
    isShowing: showAttachedFeedback,
    isExiting: attachedExiting,
    trigger: triggerAttachedFeedback,
  } = useUploadFeedback({ duration: 2200, exitDuration: 360 });
  const fileRef = useRef<HTMLInputElement>(null);

  function addFiles(incoming: File[]) {
    if (incoming.length === 0) return;

    const merged = [...files, ...incoming];
    const total = merged.reduce((sum, file) => sum + file.size, 0);

    if (merged.length > MAX_EMAIL_FILES) {
      setError(`No se pueden adjuntar más de ${MAX_EMAIL_FILES} archivos.`);
      return;
    }

    if (total > MAX_EMAIL_TOTAL_BYTES) {
      setError("Los adjuntos superan los 10 MB en total.");
      return;
    }

    setError(null);
    setFiles(merged);
    triggerAttachedFeedback();
  }

  return { files, setFiles, addFiles, fileRef, showAttachedFeedback, attachedExiting };
}

export type EmailAttachments = ReturnType<typeof useEmailAttachments>;
