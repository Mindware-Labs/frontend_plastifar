import { autoResizeTextarea } from "../../lib/autoResizeTextarea";

/** Auto-ajuste de altura del area de texto para notas internas. */
export function resizeNoteTextarea(textarea: HTMLTextAreaElement | null) {
  autoResizeTextarea(textarea, 54, 340);
}
