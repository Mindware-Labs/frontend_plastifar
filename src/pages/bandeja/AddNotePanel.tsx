import { StickyNote } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { ApiError } from "../../api/client";
import { emailsApi } from "../../api/emails";
import { resizeNoteTextarea } from "./noteTextarea";

interface AddNotePanelProps {
  emailId: number;
  onNoteAdded: () => void;
}

/** El creador se mantiene al pie de la conversacion, donde estaba antes. */
export function AddNotePanel({ emailId, onNoteAdded }: AddNotePanelProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (open) {
      setTimeout(() => {
        textareaRef.current?.focus();
        resizeNoteTextarea(textareaRef.current);
      }, 80);
    }
  }, [open]);

  useEffect(() => {
    if (open) {
      resizeNoteTextarea(textareaRef.current);
    }
  }, [open, draft]);

  async function add() {
    const body = draft.trim();
    if (!body || busy) return;
    setBusy(true);
    setError(null);
    try {
      await emailsApi.addNote(emailId, body);
      setDraft("");
      setOpen(false);
      onNoteAdded();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo guardar la nota");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="shrink-0 border-t border-zinc-200/80 bg-zinc-50/50">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="group flex w-full items-center gap-2.5 px-4 py-2 text-left outline-none transition-colors hover:bg-zinc-100/70 select-none cursor-pointer"
      >
        <div className="flex size-5.5 shrink-0 items-center justify-center rounded-md bg-amber-100/90 text-amber-700 shadow-2xs">
          <StickyNote className="h-3 w-3" />
        </div>
        <span className="font-heading text-[11px] font-bold uppercase tracking-wider text-zinc-600 group-hover:text-zinc-900 transition-colors">
          Agregar nota interna
        </span>
        <span className="ml-auto rounded-md border border-zinc-200/80 bg-white px-2 py-0.5 text-[10.5px] font-semibold text-zinc-600 shadow-2xs group-hover:border-zinc-300 group-hover:text-zinc-900 transition-all">
          {open ? "Ocultar" : "Mostrar"}
        </span>
      </button>

      {open && (
        <div className="flex flex-col gap-2.5 px-4 pb-3.5 pt-1">
          <textarea
            ref={textareaRef}
            value={draft}
            onChange={(event) => {
              setDraft(event.target.value);
              resizeNoteTextarea(event.target);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
                event.preventDefault();
                void add();
              }
            }}
            placeholder="Escribe una nota para el equipo… (Ctrl+Enter para guardar)"
            rows={2}
            maxLength={4000}
            className="w-full min-h-[64px] max-h-[340px] resize-none overflow-hidden rounded-lg border border-zinc-200
              bg-white p-3 text-[12.5px] leading-relaxed text-zinc-900 shadow-2xs outline-none transition-all placeholder:text-zinc-400
              focus:border-zinc-400 focus:ring-2 focus:ring-zinc-400/20"
          />
          {error && <span className="text-[11px] font-medium text-brand-red-dark">{error}</span>}
          <div className="flex items-center justify-between pt-0.5">
            <span className="text-[11px] text-zinc-400">Ctrl+Enter para guardar</span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  setDraft("");
                }}
                className="h-7.5 rounded-lg px-2.5 text-[11.5px] font-medium text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={add}
                disabled={busy || !draft.trim()}
                className="h-7.5 rounded-lg border border-zinc-900 bg-zinc-900 px-3 text-[11.5px] font-semibold text-white shadow-2xs
                  transition-all hover:bg-zinc-800 active:scale-95 disabled:opacity-40 cursor-pointer"
              >
                {busy ? "Guardando…" : "Guardar nota"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
