import { ChevronDown, Plus, StickyNote, Trash2, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from "react";
import { useDisclosureMotion } from "../../hooks/useDisclosureMotion";
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

/** Auto-ajuste de altura del área de texto para notas internas. */
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
  const [originX, setOriginX] = useState(0);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { mounted, exiting, ref: popoverRef } = useDisclosureMotion<HTMLDivElement>(open);

  const closePopover = useCallback(() => setOpen(false), []);

  function togglePopover() {
    if (open) {
      closePopover();
      return;
    }
    // El panel va pegado al borde derecho: el origen se mide desde ahí hasta el centro de la tarjeta.
    setOriginX((triggerRef.current?.offsetWidth ?? 0) / 2);
    setShowAddForm(false);
    setOpen(true);
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
    if (!open) return;
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
  }, [open, closePopover]);

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
            className="pointer-events-none absolute -bottom-1 -right-1 -z-10 h-full w-full rounded-lg
              border border-amber-200/80 bg-amber-50/50 shadow-2xs
              transition-all duration-200 group-hover/note:-bottom-1.5 group-hover/note:-right-1.5"
          />
        )}
        {count >= 3 && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -bottom-2 -right-2 -z-20 h-full w-full rounded-lg
              border border-amber-200/50 bg-amber-50/30
              transition-all duration-200 group-hover/note:-bottom-2.5 group-hover/note:-right-2.5"
          />
        )}

        {/* Tarjeta principal interactiva que muestra la última nota */}
        <button
          ref={triggerRef}
          type="button"
          onClick={togglePopover}
          data-open={open}
          className="group/btn flex max-w-[280px] sm:max-w-[340px] md:max-w-[390px] items-center gap-2.5 rounded-lg
            border border-amber-200/90 bg-amber-50/70 px-2.5 py-1.5 text-left outline-none
            shadow-2xs transition-all duration-150 cursor-pointer
            hover:border-amber-300 hover:bg-amber-100/60 active:scale-[0.99]
            focus-visible:border-amber-400 focus-visible:ring-2 focus-visible:ring-amber-400/20
            data-[open=true]:border-amber-300 data-[open=true]:bg-amber-100/70 data-[open=true]:shadow-xs"
          title={count > 1 ? `${count} notas internas · Clic para desplegar todas` : "Nota interna · Clic para ver detalles"}
        >
          <div className="flex size-5.5 shrink-0 items-center justify-center rounded-md bg-amber-100/90 text-amber-700 shadow-2xs">
            <StickyNote className="h-3 w-3" />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 text-[10.5px]">
              <span className="truncate font-semibold text-amber-950">{latestNote.authorName}</span>
              <span className="shrink-0 text-amber-300">·</span>
              <span className="shrink-0 font-medium text-amber-800/80">{formatNoteTime(latestNote.createdAt)}</span>
            </div>
            <p className="truncate text-[11.5px] leading-snug text-amber-950/90 font-normal">
              {latestNote.body}
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-1">
            {count > 1 && (
              <span className="inline-flex shrink-0 items-center rounded-md bg-amber-200/90 px-1.5 py-0.5 font-heading text-[9.5px] font-bold tabular-nums text-amber-950 shadow-2xs">
                {count}
              </span>
            )}
            <ChevronDown
              className={`h-3 w-3 shrink-0 text-amber-600 transition-transform duration-280 ease-plf-spring motion-reduce:transition-none group-hover/btn:text-amber-800 ${
                open ? "rotate-180 text-amber-800" : ""
              }`}
            />
          </div>
        </button>
      </div>

      {/* Panel desplegado (Popover) con todas las notas y el creador */}
      {mounted && (
        <div
          ref={popoverRef}
          aria-hidden={exiting}
          style={{ transformOrigin: `calc(100% - ${originX}px) top` }}
          className={`absolute right-0 top-full z-50 mt-1.5 w-[340px] sm:w-[400px] rounded-lg border
            border-zinc-200/90 bg-white p-3 shadow-[0_10px_28px_-6px_rgba(0,0,0,0.12),0_2px_8px_-2px_rgba(0,0,0,0.04)]
            ${exiting ? "pointer-events-none" : ""}`}
        >
          {/* Cabecera del popover */}
          <div data-motion-item className="mb-2.5 flex items-center justify-between border-b border-zinc-100 pb-2">
            <div className="flex items-center gap-2">
              <div className="flex size-5.5 shrink-0 items-center justify-center rounded-md bg-amber-100/90 text-amber-700 shadow-2xs">
                <StickyNote className="h-3 w-3" />
              </div>
              <span className="font-heading text-[11px] font-bold uppercase tracking-wider text-zinc-900">
                Notas internas {count > 0 ? `(${count})` : ""}
              </span>
            </div>

            <div className="flex items-center gap-1">
              {count > 0 && !showAddForm && (
                <button
                  type="button"
                  onClick={() => setShowAddForm(true)}
                  className="inline-flex items-center gap-1 rounded-md border border-zinc-200 bg-white px-2 py-0.5 font-heading text-[10.5px] font-bold uppercase
                    tracking-wider text-zinc-700 shadow-2xs transition-all hover:bg-zinc-50 hover:border-zinc-300"
                >
                  <Plus className="h-2.5 w-2.5" />
                  Agregar
                </button>
              )}
              <button
                type="button"
                onClick={closePopover}
                aria-label="Cerrar notas"
                className="flex size-5 items-center justify-center rounded-md text-zinc-400 transition-colors
                  hover:bg-zinc-100 hover:text-zinc-700"
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
                data-motion-item
                className="group/item relative rounded-lg border border-amber-200/90 bg-amber-50/70 p-2.5 shadow-2xs transition-colors
                  hover:bg-amber-50"
              >
                <div className="flex items-center justify-between text-[10.5px]">
                  <div className="flex items-center gap-1.5 truncate">
                    <span className="font-semibold text-amber-950">{note.authorName}</span>
                    <span className="text-amber-300">·</span>
                    <span className="text-amber-800/80">{formatDateTime(note.createdAt)}</span>
                  </div>
                  {(user?.staffId === note.staffId || user?.isAdmin) && (
                    <button
                      type="button"
                      onClick={(e) => handleRemove(note, e)}
                      aria-label="Borrar esta nota"
                      title="Borrar nota"
                      className="text-amber-400 opacity-60 transition-opacity hover:text-brand-red hover:opacity-100"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  )}
                </div>
                <p className="mt-1.5 whitespace-pre-wrap text-[12px] leading-relaxed text-amber-950 font-normal">
                  {note.body}
                </p>
              </div>
            ))}
          </div>

          {/* Formulario para agregar nota */}
          {(showAddForm || count === 0) && (
            <div className={`flex flex-col gap-1.5 ${count > 0 ? "mt-3 border-t border-zinc-100 pt-2.5" : ""}`}>
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
                className="w-full min-h-[60px] max-h-[340px] resize-none overflow-hidden rounded-lg border border-zinc-200
                  bg-white px-3 py-2 text-[12px] leading-relaxed text-zinc-900 shadow-2xs outline-none transition-all placeholder:text-zinc-400
                  focus:border-zinc-400 focus:ring-2 focus:ring-zinc-400/20"
              />
              {error && <span className="text-[11px] font-medium text-brand-red-dark">{error}</span>}
              <div className="flex items-center justify-between pt-0.5">
                <span className="text-[11px] text-zinc-400">Ctrl+Enter para guardar</span>
                <div className="flex items-center gap-1.5">
                  {count > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        setShowAddForm(false);
                        setDraft("");
                      }}
                      className="h-7 rounded-lg px-2 text-[11px] font-medium text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 transition-colors"
                    >
                      Cancelar
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleAdd}
                    disabled={busy || !draft.trim()}
                    className="h-7 rounded-lg border border-zinc-900 bg-zinc-900 px-2.5 text-[11px] font-semibold text-white
                      shadow-2xs outline-none transition-all hover:bg-zinc-800 disabled:opacity-40 active:scale-95"
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

