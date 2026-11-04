import { useQuery } from "@tanstack/react-query";
import { ChevronDown, Plus, StickyNote, X } from "lucide-react";
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { AppleMotionBlock } from "../../components/ui/AppleMotionBlock";
import { TEXTAREA_AUTO_GROW_CLASS, TEXTAREA_ONE_LINE_MIN_PX } from "../../components/ui/Field";
import { useAppleListMotion } from "../../hooks/useAppleListMotion";
import { useDisclosureMotion } from "../../hooks/useDisclosureMotion";
import {
  COMPOSER_FIELD_ENTER_MS,
  COMPOSER_FIELD_EXIT_MS,
} from "./useComposerFieldMotion";
import { ApiError } from "../../api/client";
import { emailsApi } from "../../api/emails";
import { useAuth } from "../../context/useAuth";
import { autoResizeTextarea } from "../../lib/autoResizeTextarea";
import type { EmailNoteResponse } from "../../types/api";
import { InternalNoteThread } from "../../components/notes/InternalNoteThread";

interface ConversationNotesProps {
  emailId: number;
  /** Permite sincronizar la cantidad de notas con el exterior si se necesita. */
  onNotesCountChange?: (count: number) => void;
}

export interface ConversationNotesHandle {
  appendNote: (note: EmailNoteResponse) => void;
}

const POPOVER_ADD_FORM_KEY = "popover-add-form";
const NO_NOTES: EmailNoteResponse[] = [];
const ADD_NOTE_PANEL_FORM_KEY = "add-note-panel-form";

function mergeNotes(
  fetched: EmailNoteResponse[],
  local: EmailNoteResponse[] | null,
): EmailNoteResponse[] {
  if (!local?.length) return fetched;
  const byId = new Map(fetched.map((note) => [note.id, note]));
  for (const note of local) {
    if (!byId.has(note.id)) byId.set(note.id, note);
  }
  return [...byId.values()].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );
}

/** Misma gramática que TextAreaField autoGrow: una línea al inicio, crece sin scroll interno. */
const NOTE_TEXTAREA_CLASS = `w-full rounded-edge border bg-white px-3 py-2.5 text-[13px] leading-relaxed text-ink outline-none
  transition-[height,border-color,box-shadow] duration-200 ease-plf-spring motion-reduce:transition-none placeholder:text-faint
  border-line-strong hover:border-hairline-hover focus:border-brand-red focus:ring-3 focus:ring-brand-red/10 shadow-2xs
  ${TEXTAREA_AUTO_GROW_CLASS}`;

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

export const ConversationNotes = forwardRef<ConversationNotesHandle, ConversationNotesProps>(
  function ConversationNotes({ emailId, onNotesCountChange }, ref) {
  const { user } = useAuth();
  const notesQuery = useQuery({
    queryKey: ["emails", emailId, "notes"],
    queryFn: () => emailsApi.notes(emailId),
  });

  // Notas creadas desde aqui: se suman a lo leido aunque la lectura llegue despues. Se vacian al cambiar de correo.
  const [localNotes, setLocalNotes] = useState<EmailNoteResponse[]>([]);
  const [localFor, setLocalFor] = useState(emailId);
  if (localFor !== emailId) {
    setLocalFor(emailId);
    setLocalNotes([]);
  }

  // Un fallo de carga cuenta como «sin notas», igual que antes.
  const fetchedNotes = notesQuery.isError ? NO_NOTES : (notesQuery.data ?? null);
  const notes = useMemo(
    () =>
      fetchedNotes === null && localNotes.length === 0 ? null : mergeNotes(fetchedNotes ?? [], localNotes),
    [fetchedNotes, localNotes],
  );

  const addLocalNote = useCallback((note: EmailNoteResponse) => {
    setLocalNotes((prev) => (prev.some((item) => item.id === note.id) ? prev : [...prev, note]));
  }, []);

  const notesCount = notes?.length ?? null;
  useEffect(() => {
    if (notesCount !== null) onNotesCountChange?.(notesCount);
  }, [notesCount, onNotesCountChange]);

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

  const addFormKeys = useMemo(() => (showAddForm ? [POPOVER_ADD_FORM_KEY] : []), [showAddForm]);
  const addFormMotion = useAppleListMotion(addFormKeys, {
    minItems: 0,
    enterMs: COMPOSER_FIELD_ENTER_MS,
    exitMs: COMPOSER_FIELD_EXIT_MS,
  });

  useImperativeHandle(
    ref,
    () => ({
      appendNote: addLocalNote,
    }),
    [addLocalNote],
  );

  const closeAddForm = useCallback(() => {
    addFormMotion.requestRemove(POPOVER_ADD_FORM_KEY, () => {
      setShowAddForm(false);
      setDraft("");
    });
  }, [addFormMotion]);

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
        autoResizeTextarea(textareaRef.current, TEXTAREA_ONE_LINE_MIN_PX);
      }, 80);
    }
  }, [open, showAddForm, notes]);

  useLayoutEffect(() => {
    if (open && (notes?.length === 0 || showAddForm)) {
      autoResizeTextarea(textareaRef.current, TEXTAREA_ONE_LINE_MIN_PX);
    }
  }, [open, showAddForm, notes, draft]);

  async function handleAdd() {
    const body = draft.trim();
    if (!body || busy) return;
    setBusy(true);
    setError(null);
    try {
      const newNote = await emailsApi.addNote(emailId, body);
      addLocalNote(newNote);
      closeAddForm();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo guardar la nota");
    } finally {
      setBusy(false);
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

          <div className="max-h-64 overflow-y-auto pr-0.5">
            <InternalNoteThread
              density="compact"
              notes={(notes ?? []).map((note) => ({
                id: note.id,
                parentId: note.parentId ?? null,
                authorStaffId: note.staffId,
                authorName: note.authorName,
                body: note.body,
                createdAt: note.createdAt,
              }))}
              currentStaffId={user?.staffId}
              canReply={Boolean(user)}
              onReply={async (parentId, body) => {
                const created = await emailsApi.addNote(emailId, body, parentId);
                addLocalNote(created);
              }}
            />
          </div>

          {/* Formulario para agregar nota (misma entrada que CC/CCO) */}
          {(showAddForm || count === 0) && (
            <AppleMotionBlock
              phase={addFormMotion.phaseFor(POPOVER_ADD_FORM_KEY)}
              rowPreset="composer"
              className={count > 0 ? "mt-3 border-t border-zinc-100 pt-2.5" : ""}
            >
              <div className="flex flex-col gap-1.5">
                <textarea
                  ref={textareaRef}
                  value={draft}
                  onChange={(event) => {
                    setDraft(event.target.value);
                    autoResizeTextarea(event.target, TEXTAREA_ONE_LINE_MIN_PX);
                  }}
                  onKeyDown={handleKeyDown}
                  placeholder="Escribe una nota para el equipo… (Ctrl+Enter para guardar)"
                  rows={1}
                  maxLength={4000}
                  className={NOTE_TEXTAREA_CLASS}
                />
                {error && <span className="text-[11px] font-medium text-brand-red-dark">{error}</span>}
                <div className="flex items-center justify-between pt-0.5">
                  <span className="text-[11px] text-zinc-400">Ctrl+Enter para guardar</span>
                  <div className="flex items-center gap-1.5">
                    {count > 0 && (
                      <button
                        type="button"
                        onClick={closeAddForm}
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
            </AppleMotionBlock>
          )}
        </div>
      )}
    </div>
  );
},
);

interface AddNotePanelProps {
  emailId: number;
  onNoteAdded: (note: EmailNoteResponse) => void;
}

/** El creador se mantiene al pie de la conversacion, donde estaba antes. */
export function AddNotePanel({ emailId, onNoteAdded }: AddNotePanelProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const formKeys = useMemo(() => (open ? [ADD_NOTE_PANEL_FORM_KEY] : []), [open]);
  const formMotion = useAppleListMotion(formKeys, {
    minItems: 0,
    enterMs: COMPOSER_FIELD_ENTER_MS,
    exitMs: COMPOSER_FIELD_EXIT_MS,
  });

  const closeForm = useCallback(
    (afterClose?: () => void) => {
      formMotion.requestRemove(ADD_NOTE_PANEL_FORM_KEY, () => {
        setOpen(false);
        setDraft("");
        afterClose?.();
      });
    },
    [formMotion],
  );

  function toggleForm() {
    if (open) {
      closeForm();
      return;
    }
    if (formMotion.isExiting(ADD_NOTE_PANEL_FORM_KEY)) return;
    setOpen(true);
  }

  useEffect(() => {
    if (!open) return;
    const id = window.setTimeout(() => {
      textareaRef.current?.focus();
      autoResizeTextarea(textareaRef.current, TEXTAREA_ONE_LINE_MIN_PX);
    }, 120);
    return () => window.clearTimeout(id);
  }, [open]);

  useLayoutEffect(() => {
    if (open) autoResizeTextarea(textareaRef.current, TEXTAREA_ONE_LINE_MIN_PX);
  }, [open, draft]);

  async function add() {
    const body = draft.trim();
    if (!body || busy) return;
    setBusy(true);
    setError(null);
    try {
      const newNote = await emailsApi.addNote(emailId, body);
      closeForm(() => onNoteAdded(newNote));
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
        onClick={toggleForm}
        className="group flex w-full items-center gap-2.5 px-4 py-2 text-left outline-none transition-colors hover:bg-zinc-100/70 select-none cursor-pointer"
      >
        <div className="flex size-5.5 shrink-0 items-center justify-center rounded-md bg-amber-100/90 text-amber-700 shadow-2xs">
          <StickyNote className="h-3 w-3" />
        </div>
        <span className="font-heading text-[11px] font-bold uppercase tracking-wider text-zinc-600 group-hover:text-zinc-900 transition-colors">
          Agregar nota interna
        </span>
        <span className="ml-auto rounded-md border border-zinc-200/80 bg-white px-2 py-0.5 text-[10.5px] font-semibold text-zinc-600 shadow-2xs group-hover:border-zinc-300 group-hover:text-zinc-900 transition-all">
          {open || formMotion.isExiting(ADD_NOTE_PANEL_FORM_KEY) ? "Ocultar" : "Mostrar"}
        </span>
      </button>

      {open && (
        <AppleMotionBlock phase={formMotion.phaseFor(ADD_NOTE_PANEL_FORM_KEY)} rowPreset="composer">
          <div className="flex flex-col gap-2.5 px-4 pb-3.5 pt-1">
            <textarea
              ref={textareaRef}
              value={draft}
              onChange={(event) => {
                setDraft(event.target.value);
                autoResizeTextarea(event.target, TEXTAREA_ONE_LINE_MIN_PX);
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
                  event.preventDefault();
                  void add();
                }
              }}
              placeholder="Escribe una nota para el equipo… (Ctrl+Enter para guardar)"
              rows={1}
              maxLength={4000}
              className={NOTE_TEXTAREA_CLASS}
            />
            {error && <span className="text-[11px] font-medium text-brand-red-dark">{error}</span>}
            <div className="flex items-center justify-between pt-0.5">
              <span className="text-[11px] text-zinc-400">Ctrl+Enter para guardar</span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => closeForm()}
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
        </AppleMotionBlock>
      )}
    </div>
  );
}

