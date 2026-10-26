import { today } from "../../../lib/quality";

/** Parsea la fecha y el cuerpo de la nota si existiera un prefijo [Fecha: ...] */
export function parseNote(rawNote: string | null | undefined): { date: string; note: string } {
  if (!rawNote) return { date: today(), note: "" };
  const match = rawNote.match(/^(?:\[Fecha:\s*(\d{4}-\d{2}-\d{2})\]|Fecha:\s*(\d{4}-\d{2}-\d{2}))\s*\n?/i);
  if (match) {
    const date = match[1] || match[2];
    const cleanNote = rawNote.slice(match[0].length).trim();
    return { date, note: cleanNote };
  }
  return { date: today(), note: rawNote };
}
