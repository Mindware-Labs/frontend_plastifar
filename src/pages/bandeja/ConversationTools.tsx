import { Plus, StickyNote, Tag, Trash2, UserRound, X } from "lucide-react";
import { useEffect, useState, type KeyboardEvent } from "react";
import { ApiError } from "../../api/client";
import { emailsApi } from "../../api/emails";
import { Select, type SelectOption } from "../../components/ui/Select";
import { useAuth } from "../../context/useAuth";
import { formatDateTime } from "../../lib/format";
import type { EmailNoteResponse, StaffOptionResponse, TagCountResponse } from "../../types/api";

/** Color estable por etiqueta: la misma palabra siempre se pinta igual. */
const TAG_TONES = [
  "bg-brand-red/10 text-brand-red-dark",
  "bg-brand-green/10 text-brand-green",
  "bg-warn/10 text-warn",
  "bg-sky-500/10 text-sky-700",
  "bg-violet-500/10 text-violet-700",
  "bg-fill text-brand-gray",
];

export function tagTone(tag: string) {
  let hash = 0;
  for (const char of tag) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return TAG_TONES[hash % TAG_TONES.length];
}

export function TagChip({ tag, small = false, onRemove }: { tag: string; small?: boolean; onRemove?: () => void }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full font-heading font-bold uppercase tracking-[0.06em] ${tagTone(tag)} ${
        small ? "px-1.5 py-px text-[9.5px]" : "h-5 px-2 text-[10px]"
      }`}
    >
      {tag}
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Quitar la etiqueta ${tag}`}
          className="opacity-60 transition-opacity hover:opacity-100"
        >
          <X className="h-2.5 w-2.5" />
        </button>
      )}
    </span>
  );
}

const labelClass = "font-heading text-[10px] font-semibold uppercase tracking-[0.08em] text-faint";

interface AssignmentProps {
  emailId: number;
  assignedStaffId: number | null;
  assignedStaffName: string | null;
  onChanged: (staffId: number | null, name: string | null) => void;
}

/** Quien atiende la conversacion: un selector con el equipo activo y un atajo para tomarla. */
export function AssignmentControl({ emailId, assignedStaffId, assignedStaffName, onChanged }: AssignmentProps) {
  const { user } = useAuth();
  const [options, setOptions] = useState<StaffOptionResponse[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    emailsApi
      .staffOptions()
      .then(setOptions)
      .catch(() => setOptions([]));
  }, []);

  async function assign(staffId: number | null) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const result = await emailsApi.assign(emailId, staffId);
      onChanged(result.assignedStaffId, result.assignedStaffName);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo asignar");
    } finally {
      setBusy(false);
    }
  }

  const mine = user !== null && assignedStaffId === user.staffId;

  const staffList = options
    ? assignedStaffId !== null && assignedStaffName && !options.some((o) => o.id === assignedStaffId)
      ? [...options, { id: assignedStaffId, name: assignedStaffName }]
      : options
    : assignedStaffId !== null && assignedStaffName
      ? [{ id: assignedStaffId, name: assignedStaffName }]
      : [];

  const selectOptions: SelectOption[] = [
    { value: "", label: "Sin asignar" },
    ...staffList.map((option) => ({
      value: String(option.id),
      label: option.name,
    })),
  ];

  return (
    <div className="flex min-w-0 items-center gap-2">
      <UserRound className="h-3.5 w-3.5 shrink-0 text-faint" />
      <Select
        size="sm"
        value={assignedStaffId !== null ? String(assignedStaffId) : ""}
        disabled={busy || options === null}
        onChange={(next) => {
          const nextId = next === "" ? null : Number(next);
          if (nextId !== assignedStaffId) {
            void assign(nextId);
          }
        }}
        options={selectOptions}
        placeholder="Sin asignar"
        state={error ? "error" : "idle"}
        aria-label="Asignar la conversación"
        className="w-[190px] sm:w-[200px]"
      />
      {!mine && user && (
        <button
          type="button"
          disabled={busy}
          onClick={() => assign(user.staffId)}
          className="shrink-0 rounded-edge px-1.5 py-0.5 font-heading text-[10px] font-bold uppercase
            tracking-[0.08em] text-brand-red-dark outline-none transition-colors hover:bg-brand-red/[0.06]
            focus-visible:ring-3 focus-visible:ring-brand-red/20 disabled:opacity-50"
        >
          Asignarme
        </button>
      )}
      {error && <span className="truncate text-[11px] text-brand-red-dark">{error}</span>}
    </div>
  );
}

interface TagEditorProps {
  emailId: number;
  tags: string[];
  onChanged: (tags: string[]) => void;
}

/** Etiquetas libres de la conversacion, con las ya usadas como sugerencia. */
export function TagEditor({ emailId, tags, onChanged }: TagEditorProps) {
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");
  const [known, setKnown] = useState<TagCountResponse[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!adding) return;
    emailsApi
      .tags()
      .then(setKnown)
      .catch(() => undefined);
  }, [adding]);

  async function save(next: string[]) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const result = await emailsApi.updateTags(emailId, next);
      onChanged(result.tags);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudieron guardar las etiquetas");
    } finally {
      setBusy(false);
    }
  }

  function add(raw: string) {
    const tag = raw.trim().toLowerCase();
    if (!tag) return;
    setDraft("");
    if (tags.includes(tag)) return;
    void save([...tags, tag]);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault();
      add(draft);
    } else if (event.key === "Escape") {
      setAdding(false);
      setDraft("");
    }
  }

  const term = draft.trim().toLowerCase();
  const suggestions = known.filter((k) => !tags.includes(k.tag) && (!term || k.tag.includes(term))).slice(0, 6);

  return (
    <div className="flex min-w-0 flex-wrap items-center gap-1.5">
      <Tag className="h-3.5 w-3.5 shrink-0 text-faint" />
      {tags.map((tag) => (
        <TagChip key={tag} tag={tag} onRemove={() => save(tags.filter((t) => t !== tag))} />
      ))}

      {adding ? (
        <div className="relative">
          <input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={() => setTimeout(() => setAdding(false), 150)}
            placeholder="etiqueta"
            maxLength={30}
            autoFocus
            className="h-5 w-28 rounded-edge border border-line bg-white px-1.5 text-[11px] text-ink outline-none
              focus-visible:border-brand-red/40"
          />
          {suggestions.length > 0 && (
            <ul className="absolute left-0 top-full z-30 mt-1 w-44 rounded-edge border border-line bg-white py-1 shadow-[0_8px_24px_-4px_rgba(27,27,29,0.14)]">
              {suggestions.map((suggestion) => (
                <li key={suggestion.tag}>
                  <button
                    type="button"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => add(suggestion.tag)}
                    className="flex w-full items-center justify-between px-2.5 py-1 text-left text-[11.5px] text-ink hover:bg-brand-red/[0.05]"
                  >
                    {suggestion.tag}
                    <span className="text-[10px] text-faint">{suggestion.count}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          disabled={busy}
          title="Agregar etiqueta"
          className="inline-flex h-5 items-center gap-0.5 rounded-full border border-dashed border-line px-1.5
            font-heading text-[10px] font-bold uppercase tracking-[0.06em] text-faint transition-colors
            hover:border-brand-red/40 hover:text-brand-red-dark disabled:opacity-50"
        >
          <Plus className="h-2.5 w-2.5" />
          Etiqueta
        </button>
      )}
      {error && <span className="text-[11px] text-brand-red-dark">{error}</span>}
    </div>
  );
}

interface NotesPanelProps {
  emailId: number;
}

/** Notas internas de la conversacion: se ven aqui y en la exportacion, nunca en el correo. */
export function NotesPanel({ emailId }: NotesPanelProps) {
  const { user } = useAuth();
  const [notes, setNotes] = useState<EmailNoteResponse[] | null>(null);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    emailsApi
      .notes(emailId)
      .then((list) => {
        if (!cancelled) setNotes(list);
      })
      .catch(() => {
        if (!cancelled) setNotes([]);
      });
    return () => {
      cancelled = true;
    };
  }, [emailId]);

  async function add() {
    const body = draft.trim();
    if (!body || busy) return;
    setBusy(true);
    setError(null);
    try {
      const note = await emailsApi.addNote(emailId, body);
      setNotes([...(notes ?? []), note]);
      setDraft("");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo guardar la nota");
    } finally {
      setBusy(false);
    }
  }

  async function remove(note: EmailNoteResponse) {
    try {
      await emailsApi.removeNote(note.id);
      setNotes((notes ?? []).filter((n) => n.id !== note.id));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo borrar la nota");
    }
  }

  const count = notes?.length ?? 0;

  return (
    <div className="shrink-0 border-t border-line">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="flex w-full items-center gap-2 px-4 py-2 text-left outline-none hover:bg-canvas/70"
      >
        <StickyNote className="h-3.5 w-3.5 text-warn" />
        <span className={labelClass}>Notas internas{count > 0 ? ` (${count})` : ""}</span>
        <span className="ml-auto text-[10.5px] text-faint">{open ? "Ocultar" : "Mostrar"}</span>
      </button>

      {open && (
        <div className="flex max-h-56 flex-col gap-2 overflow-y-auto px-4 pb-3">
          {(notes ?? []).map((note) => (
            <div key={note.id} className="rounded-edge border border-warn/30 bg-warn/[0.06] px-3 py-2">
              <div className="flex items-center gap-2 text-[10.5px] text-subtle">
                <span className="font-semibold text-ink">{note.authorName}</span>
                <span>{formatDateTime(note.createdAt)}</span>
                {(user?.staffId === note.staffId || user?.isAdmin) && (
                  <button
                    type="button"
                    onClick={() => remove(note)}
                    aria-label="Borrar la nota"
                    className="ml-auto text-faint transition-colors hover:text-brand-red"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                )}
              </div>
              <p className="mt-1 whitespace-pre-wrap text-[12.5px] leading-relaxed text-ink">{note.body}</p>
            </div>
          ))}

          <div className="flex flex-col gap-1.5">
            <textarea
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) add();
              }}
              placeholder="Escribe una nota para el equipo… (Ctrl+Enter para guardar)"
              rows={2}
              maxLength={4000}
              className="w-full resize-none rounded-edge border border-line bg-white px-2.5 py-1.5 text-[12px] text-ink
                outline-none placeholder:text-faint focus-visible:border-brand-red/40"
            />
            {error && <span className="text-[11px] text-brand-red-dark">{error}</span>}
            <div className="flex justify-end">
              <button
                type="button"
                onClick={add}
                disabled={busy || !draft.trim()}
                className="rounded-edge bg-ink px-2.5 py-1 text-[11.5px] font-semibold text-white outline-none
                  transition-opacity hover:opacity-90 disabled:opacity-40"
              >
                Guardar nota
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
