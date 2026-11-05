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
    <div className="shrink-0 border-t border-zinc-100 bg-white">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="group flex w-full items-center justify-between px-4 py-2 text-left outline-none transition-colors hover:bg-zinc-50/80 select-none cursor-pointer"
      >
        <div className="flex items-center gap-2 text-zinc-500 group-hover:text-zinc-800 transition-colors">
          <StickyNote className="size-3.5 text-zinc-400 group-hover:text-zinc-600 transition-colors" />
          <span className="text-[12px] font-medium">
            {open ? "Cerrar nota interna" : "Agregar nota interna…"}
          </span>
        </div>
        <span className="text-[11px] font-medium text-zinc-400 group-hover:text-zinc-600 transition-colors">
          {open ? "Ocultar" : "Ctrl+Enter"}
        </span>
      </button>

      {open && (
        <div className="flex flex-col gap-2 px-4 pb-3 pt-0">
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
