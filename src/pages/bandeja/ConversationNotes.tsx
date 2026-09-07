import { ChevronDown, Plus, StickyNote, Trash2, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from "react";
import { ApiError } from "../../api/client";
import { emailsApi } from "../../api/emails";
import { useAuth } from "../../context/useAuth";
import { formatDateTime } from "../../lib/format";
import type { EmailNoteResponse } from "../../types/api";

interface ConversationNotesProps {
  emailId: number;
  /** Permite sincronizar la cantidad de notas con el exterior si se necesita. */
  onNotesCountChange?: (count: number) => void;
}

function formatNoteTime(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const diffMs = Math.max(0, now.getTime() - date.getTime());
  const diffMinutes = Math.floor(diffMs / 60000);
  if (diffMinutes < 1) return "ahora";
  if (diffMinutes < 60) return `hace ${diffMinutes}m`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `hace ${diffHours}h`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return "ayer";
  if (diffDays < 7) return `hace ${diffDays}d`;
  return date.toLocaleDateString("es-419", { day: "2-digit", month: "short" });
}

/**
 * Ajusta la altura del textarea de notas según su contenido.
 * Inicia en un tamaño base de 2 líneas (~54px) y crece automáticamente
 * a medida que se agregan líneas, evitando que haga scroll interno.
 */
function autoResizeTextarea(textarea: HTMLTextAreaElement | null) {
  if (!textarea) return;
  textarea.style.height = "auto";
  const borderOffset = textarea.offsetHeight - textarea.clientHeight;
  const targetHeight = Math.max(textarea.scrollHeight + borderOffset, 54);
  if (targetHeight >= 340) {
    textarea.style.height = "340px";
    textarea.style.overflowY = "auto";
  } else {
    textarea.style.height = `${targetHeight}px`;
    textarea.style.overflowY = "hidden";
  }
}

export function ConversationNotes({ emailId, onNotesCountChange }: ConversationNotesProps) {
  const { user } = useAuth();
  const [notes, setNotes] = useState<EmailNoteResponse[] | null>(null);
  const [open, setOpen] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const isClosingRef = useRef(false);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const closePopover = useCallback(() => {
    if (isClosingRef.current) return;
    isClosingRef.current = true;
    setIsClosing(true);
    window.setTimeout(() => {
      setOpen(false);
      setIsClosing(false);
      isClosingRef.current = false;
      setShowAddForm(false);
    }, 160);
  }, []);

  function togglePopover() {
    if (open) {
      closePopover();
    } else {
      isClosingRef.current = false;
      setIsClosing(false);
      setOpen(true);
    }
  }

  useEffect(() => {
    let cancelled = false;
    emailsApi
      .notes(emailId)
      .then((list) => {
        if (!cancelled) {
          setNotes(list);
          onNotesCountChange?.(list.length);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setNotes([]);
          onNotesCountChange?.(0);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [emailId, onNotesCountChange]);

  // Cierra al hacer clic fuera
  useEffect(() => {
    if (!open || isClosing) return;
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        closePopover();
      }
    }
    function handleKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key === "Escape") {
        closePopover();
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, isClosing, closePopover]);

  // Foco automático y auto-ajuste de altura en el textarea cuando se abre el formulario
  useEffect(() => {
    if (open && (notes?.length === 0 || showAddForm)) {
      setTimeout(() => {
        textareaRef.current?.focus();
        autoResizeTextarea(textareaRef.current);
      }, 80);
    }
  }, [open, showAddForm, notes]);

  useEffect(() => {
    if (open && (notes?.length === 0 || showAddForm)) {
      autoResizeTextarea(textareaRef.current);
    }
  }, [open, showAddForm, notes, draft]);

  async function handleAdd() {
    const body = draft.trim();
    if (!body || busy) return;
    setBusy(true);
    setError(null);
    try {
      const newNote = await emailsApi.addNote(emailId, body);
      const nextNotes = [...(notes ?? []), newNote];
      setNotes(nextNotes);
      onNotesCountChange?.(nextNotes.length);
      setDraft("");
      setShowAddForm(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo guardar la nota");
    } finally {
      setBusy(false);
    }
  }

  async function handleRemove(note: EmailNoteResponse, event: React.MouseEvent) {
    event.stopPropagation();
    try {
      await emailsApi.removeNote(note.id);
      const nextNotes = (notes ?? []).filter((n) => n.id !== note.id);
      setNotes(nextNotes);
      onNotesCountChange?.(nextNotes.length);
      if (nextNotes.length === 0) {
        setShowAddForm(true);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo borrar la nota");
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      void handleAdd();
    }
  }

  const count = notes?.length ?? 0;
  if (count === 0 || !notes) {
    return null;
  }

  // La última nota creada es la más reciente
  const latestNote = notes[notes.length - 1];

  return (
    <div
      ref={containerRef}
      className={`relative z-30 flex flex-col items-end ${
        count >= 3 ? "mb-3" : count >= 2 ? "mb-2" : "mb-1.5"
      }`}
    >
      {/* Tarjeta encima de la fecha */}
      <div className="group/note relative">
          {/* Capas visuales apiladas (stacked cards) que denotan físicamente múltiples notas */}
          {count >= 2 && (
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -bottom-1 -right-1 -z-10 h-full w-full rounded-edge
                border border-warn/35 bg-warn/[0.06] shadow-[0_1px_3px_rgba(0,0,0,0.05)]
                transition-all duration-200 group-hover/note:-bottom-1.5 group-hover/note:-right-1.5"
            />
          )}
          {count >= 3 && (
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -bottom-2 -right-2 -z-20 h-full w-full rounded-edge
                border border-warn/20 bg-warn/[0.03]
                transition-all duration-200 group-hover/note:-bottom-2.5 group-hover/note:-right-2.5"
            />
          )}

          {/* Tarjeta principal interactiva que muestra la última nota */}
          <button
            type="button"
            onClick={togglePopover}
            data-open={open && !isClosing}
            className="flex max-w-[280px] sm:max-w-[340px] md:max-w-[390px] items-center gap-2 rounded-edge
              border border-warn/35 bg-[#fffdf7] px-2.5 py-1.5 text-left outline-none
              shadow-[0_1px_2px_rgba(194,118,10,0.08)] transition-all duration-150
              hover:border-warn/60 hover:bg-[#fff9ea] hover:shadow-xs
              focus-visible:ring-3 focus-visible:ring-warn/25
              data-[open=true]:border-warn/70 data-[open=true]:bg-[#fff7e2]"
            title={count > 1 ? `${count} notas internas · Clic para desplegar todas` : "Nota interna · Clic para ver detalles"}
          >
            <StickyNote className="h-3.5 w-3.5 shrink-0 text-warn" />

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 text-[10.5px]">
                <span className="truncate font-semibold text-ink">{latestNote.authorName}</span>
                <span className="shrink-0 text-faint">·</span>
                <span className="shrink-0 text-subtle">{formatNoteTime(latestNote.createdAt)}</span>
              </div>
              <p className="truncate text-[11.5px] leading-snug text-ink/90">
                {latestNote.body}
              </p>
            </div>

            {/* Distintivo de múltiples notas y chevron */}
            {count > 1 && (
              <span className="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-warn/15 px-1.5 py-0.5 font-heading text-[9.5px] font-bold text-warn-dark">
                {count}
              </span>
            )}
            <ChevronDown
              className={`h-3 w-3 shrink-0 text-warn/80 transition-transform duration-200 ${
                open && !isClosing ? "rotate-180" : ""
              }`}
            />
          </button>
        </div>

      {/* Panel desplegado (Popover) con todas las notas y el creador */}
      {(open || isClosing) && (
        <div
          className={`absolute right-0 top-full z-50 mt-1.5 w-[340px] sm:w-[400px] rounded-edge border
            border-line-strong bg-white p-3 shadow-[0_12px_36px_-4px_rgba(27,27,29,0.18)]
            ${isClosing ? "animate-plf-popover-out" : "animate-plf-popover-in"}`}
        >
          {/* Cabecera del popover */}
          <div className="mb-2.5 flex items-center justify-between border-b border-line pb-2">
            <div className="flex items-center gap-1.5">
              <StickyNote className="h-3.5 w-3.5 text-warn" />
              <span className="font-heading text-[11px] font-bold uppercase tracking-[0.08em] text-ink">
                Notas internas {count > 0 ? `(${count})` : ""}
              </span>
            </div>

            <div className="flex items-center gap-1">
              {count > 0 && !showAddForm && (
                <button
                  type="button"
                  onClick={() => setShowAddForm(true)}
                  className="inline-flex items-center gap-1 rounded-edge px-1.5 py-0.5 font-heading text-[10px] font-bold uppercase
                    tracking-[0.06em] text-brand-red-dark transition-colors hover:bg-brand-red/[0.06]"
                >
                  <Plus className="h-2.5 w-2.5" />
                  Agregar
                </button>
              )}
              <button
                type="button"
                onClick={closePopover}
                aria-label="Cerrar notas"
                className="flex size-5 items-center justify-center rounded-edge text-faint transition-colors
                  hover:bg-fill hover:text-ink"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          </div>

          {/* Listado de todas las notas */}
          <div className="flex max-h-56 flex-col gap-2 overflow-y-auto pr-0.5">
            {[...(notes ?? [])].reverse().map((note) => (
              <div
                key={note.id}
                className="group/item relative rounded-edge border border-warn/30 bg-warn/[0.06] p-2.5 transition-colors
                  hover:bg-warn/[0.09]"
              >
                <div className="flex items-center justify-between text-[10.5px]">
                  <div className="flex items-center gap-1.5 truncate">
                    <span className="font-semibold text-ink">{note.authorName}</span>
                    <span className="text-faint">·</span>
                    <span className="text-subtle">{formatDateTime(note.createdAt)}</span>
                  </div>
                  {(user?.staffId === note.staffId || user?.isAdmin) && (
                    <button
                      type="button"
                      onClick={(e) => handleRemove(note, e)}
                      aria-label="Borrar esta nota"
                      title="Borrar nota"
                      className="text-faint opacity-60 transition-opacity hover:text-brand-red hover:opacity-100"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  )}
                </div>
                <p className="mt-1.5 whitespace-pre-wrap text-[12px] leading-relaxed text-ink">
                  {note.body}
                </p>
              </div>
            ))}
          </div>

          {/* Formulario para agregar nota */}
          {(showAddForm || count === 0) && (
            <div className={`flex flex-col gap-1.5 ${count > 0 ? "mt-3 border-t border-line pt-2.5" : ""}`}>
              <textarea
                ref={textareaRef}
                value={draft}
                onChange={(event) => {
                  setDraft(event.target.value);
                  autoResizeTextarea(event.target);
                }}
                onKeyDown={handleKeyDown}
                placeholder="Escribe una nota para el equipo… (Ctrl+Enter para guardar)"
                rows={2}
                maxLength={4000}
                className="w-full min-h-[54px] max-h-[340px] resize-none overflow-hidden rounded-edge border border-line
                  bg-white px-2.5 py-1.5 text-[12px] leading-[18px] text-ink outline-none placeholder:text-faint
                  focus-visible:border-brand-red/40"
              />
              {error && <span className="text-[11px] text-brand-red-dark">{error}</span>}
              <div className="flex items-center justify-between pt-0.5">
                <span className="text-[10px] text-faint">Ctrl+Enter para guardar</span>
                <div className="flex items-center gap-1.5">
                  {count > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        setShowAddForm(false);
                        setDraft("");
                      }}
                      className="rounded-edge px-2 py-0.5 text-[11px] text-subtle hover:text-ink"
                    >
                      Cancelar
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleAdd}
                    disabled={busy || !draft.trim()}
                    className="rounded-edge bg-ink px-2.5 py-1 text-[11px] font-semibold text-white
                      outline-none transition-opacity hover:opacity-90 disabled:opacity-40"
                  >
                    {busy ? "Guardando…" : "Guardar nota"}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

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
        autoResizeTextarea(textareaRef.current);
      }, 80);
    }
  }, [open]);

  useEffect(() => {
    if (open) {
      autoResizeTextarea(textareaRef.current);
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
    <div className="shrink-0 border-t border-line">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="flex w-full items-center gap-2 px-4 py-2 text-left outline-none transition-colors hover:bg-canvas/70"
      >
        <StickyNote className="h-3.5 w-3.5 text-warn" />
        <span className="font-heading text-[10px] font-semibold uppercase tracking-[0.08em] text-faint">
          Agregar nota interna
        </span>
        <span className="ml-auto text-[10.5px] text-faint">{open ? "Ocultar" : "Mostrar"}</span>
      </button>

      {open && (
        <div className="flex flex-col gap-2 px-4 pb-3">
          <textarea
            ref={textareaRef}
            value={draft}
            onChange={(event) => {
              setDraft(event.target.value);
              autoResizeTextarea(event.target);
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
            className="w-full min-h-[54px] max-h-[340px] resize-none overflow-hidden rounded-edge border border-line
              bg-white px-2.5 py-1.5 text-[12px] leading-[18px] text-ink outline-none placeholder:text-faint
              focus-visible:border-brand-red/40"
          />
          {error && <span className="text-[11px] text-brand-red-dark">{error}</span>}
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-faint">Ctrl+Enter para guardar</span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  setDraft("");
                }}
                className="rounded-edge px-2 py-1 text-[11.5px] text-subtle hover:text-ink"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={add}
                disabled={busy || !draft.trim()}
                className="rounded-edge bg-ink px-2.5 py-1 text-[11.5px] font-semibold text-white outline-none
                  transition-opacity hover:opacity-90 disabled:opacity-40"
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

