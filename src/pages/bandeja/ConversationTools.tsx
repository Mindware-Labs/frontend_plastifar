import { StickyNote, Trash2, UserRound } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { ApiError } from "../../api/client";
import { emailsApi } from "../../api/emails";
import { Alert } from "../../components/ui/Alert";
import { Button } from "../../components/ui/Button";
import { Modal } from "../../components/ui/Modal";
import { Select, type SelectOption } from "../../components/ui/Select";
import { useAuth } from "../../context/useAuth";
import { useModalAnimation } from "../../hooks/useModalAnimation";
import { formatDateTime } from "../../lib/format";
import type { EmailNoteResponse, StaffOptionResponse } from "../../types/api";

const labelClass = "font-heading text-[10px] font-semibold uppercase tracking-[0.08em] text-faint";

function autoResizeTextarea(textarea: HTMLTextAreaElement | null) {
  if (!textarea) return;
  textarea.style.height = "auto";
  const borderOffset = textarea.offsetHeight - textarea.clientHeight;
  const targetHeight = Math.max(textarea.scrollHeight + borderOffset, 64);
  if (targetHeight >= 220) {
    textarea.style.height = "220px";
    textarea.style.overflowY = "auto";
  } else {
    textarea.style.height = `${targetHeight}px`;
    textarea.style.overflowY = "hidden";
  }
}

interface AssignWithNoteModalProps {
  targetStaffName: string;
  isSaving: boolean;
  error: string | null;
  onConfirm: (noteText: string) => Promise<void> | void;
  onClose: () => void;
}

function AssignWithNoteModal({
  targetStaffName,
  isSaving,
  error,
  onConfirm,
  onClose,
}: AssignWithNoteModalProps) {
  const [note, setNote] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { isExiting, requestClose } = useModalAnimation(onClose);

  useEffect(() => {
    setTimeout(() => {
      textareaRef.current?.focus();
      autoResizeTextarea(textareaRef.current);
    }, 80);
  }, []);

  function handleCancel() {
    if (!isSaving) requestClose();
  }

  function handleSubmit() {
    void onConfirm(note);
  }

  return (
    <Modal
      eyebrow="Asignación de conversación"
      title={`Asignar a ${targetStaffName}`}
      onClose={onClose}
      isExiting={isExiting}
      onRequestClose={handleCancel}
    >
      <div className="flex flex-col gap-4">
        <div className="flex items-start gap-3 rounded-edge border border-warn/30 bg-warn/[0.07] p-3 text-[12.5px] text-ink">
          <StickyNote className="mt-0.5 h-4 w-4 shrink-0 text-warn" />
          <div className="flex flex-col gap-0.5">
            <p className="font-semibold text-ink">¿Deseas agregar una nota interna?</p>
            <p className="text-[12px] leading-relaxed text-subtle">
              Puedes agregar una indicación o contexto para que <strong>{targetStaffName}</strong> sepa qué hacer al recibir este correo. Este paso es opcional.
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="assign-modal-note" className="font-heading text-[10.5px] font-semibold uppercase tracking-[0.08em] text-faint">
            Nota interna (opcional)
          </label>
          <textarea
            id="assign-modal-note"
            ref={textareaRef}
            value={note}
            onChange={(e) => {
              setNote(e.target.value);
              autoResizeTextarea(e.target);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                handleSubmit();
              }
            }}
            placeholder={`Escribe una indicación o contexto para ${targetStaffName}… (Ctrl+Enter para confirmar)`}
            rows={2}
            maxLength={4000}
            className="w-full min-h-[64px] max-h-[220px] resize-none overflow-hidden rounded-edge border border-line
              bg-white px-3 py-2 text-[12.5px] leading-relaxed text-ink outline-none placeholder:text-faint
              focus-visible:border-brand-red/40"
          />
          <div className="flex items-center justify-between text-[10.5px] text-faint">
            <span>Presiona Ctrl+Enter para confirmar</span>
            <span>{note.length}/4000</span>
          </div>
        </div>

        {error && <Alert variant="error">{error}</Alert>}
      </div>

      <div className="mt-6 flex justify-end gap-2 border-t border-line pt-4">
        <Button type="button" variant="secondary" onClick={handleCancel} disabled={isSaving}>
          Cancelar
        </Button>
        <Button type="button" onClick={handleSubmit} isLoading={isSaving}>
          {note.trim() ? "Asignar con nota" : "Asignar sin nota"}
        </Button>
      </div>
    </Modal>
  );
}

interface AssignmentProps {
  emailId: number;
  assignedStaffId: number | null;
  assignedStaffName: string | null;
  onChanged: (staffId: number | null, name: string | null) => void;
  onNoteAdded?: () => void;
}

/** Quien atiende la conversacion: un selector con el equipo activo y un atajo para tomarla. */
export function AssignmentControl({
  emailId,
  assignedStaffId,
  assignedStaffName,
  onChanged,
  onNoteAdded,
}: AssignmentProps) {
  const { user } = useAuth();
  const [options, setOptions] = useState<StaffOptionResponse[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingAssignment, setPendingAssignment] = useState<{ staffId: number; staffName: string } | null>(null);

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

  async function handleConfirmAssignment(noteText: string) {
    if (!pendingAssignment) return;
    setBusy(true);
    setError(null);
    try {
      const result = await emailsApi.assign(emailId, pendingAssignment.staffId);
      const trimmed = noteText.trim();
      if (trimmed) {
        await emailsApi.addNote(emailId, trimmed);
        onNoteAdded?.();
      }
      onChanged(result.assignedStaffId, result.assignedStaffName);
      setPendingAssignment(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo completar la asignación");
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

  const ASSIGN_ME_VALUE = "__assign_me__";

  const selectOptions: SelectOption[] = [];

  // Atajo al inicio del desplegable: asignarme sin ocupar espacio propio junto al Select.
  if (!mine && user) {
    selectOptions.push({ value: ASSIGN_ME_VALUE, label: "Asignarme" });
  }

  selectOptions.push({ value: "", label: "Sin asignar" });

  // Si está asignado a mí actualmente, añadimos la opción con hidden: true
  // para que el botón de Select muestre "Asignado a mí", pero NO salga en el desplegable.
  if (mine && user) {
    selectOptions.push({
      value: String(user.staffId),
      label: "Asignado a mí",
      hidden: true,
    });
  }

  // Añadimos al resto del personal (excluyendo siempre al usuario actual)
  for (const staff of staffList) {
    if (user && staff.id === user.staffId) {
      continue;
    }
    selectOptions.push({
      value: String(staff.id),
      label: staff.name,
    });
  }

  return (
    <div className="flex min-w-0 items-center gap-1.5">
      <Select
        size="xs"
        variant="subtle"
        leftIcon={
          <UserRound
            className={`h-3 w-3 shrink-0 ${
              mine
                ? "text-brand-red"
                : assignedStaffId !== null
                  ? "text-ink/80"
                  : "text-faint"
            }`}
          />
        }
        value={assignedStaffId !== null ? String(assignedStaffId) : ""}
        disabled={busy || options === null}
        onChange={(next) => {
          if (next === ASSIGN_ME_VALUE) {
            if (user) void assign(user.staffId);
            return;
          }

          const nextId = next === "" ? null : Number(next);
          if (nextId === assignedStaffId) return;

          if (nextId === null) {
            void assign(null);
          } else {
            const target = staffList.find((s) => s.id === nextId);
            setPendingAssignment({
              staffId: nextId,
              staffName: target?.name ?? "esta persona",
            });
          }
        }}
        options={selectOptions}
        placeholder="Sin asignar"
        state={error ? "error" : "idle"}
        aria-label="Asignar la conversación"
        className="w-auto min-w-[130px] max-w-[190px]"
      />
      {error && !pendingAssignment && <span className="truncate text-[11px] text-brand-red-dark">{error}</span>}

      {pendingAssignment && (
        <AssignWithNoteModal
          targetStaffName={pendingAssignment.staffName}
          isSaving={busy}
          error={error}
          onConfirm={handleConfirmAssignment}
          onClose={() => {
            setPendingAssignment(null);
            setError(null);
          }}
        />
      )}
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
