import { ChevronDown, CornerDownRight, Loader2, Reply, Send, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  COMPOSER_FIELD_ENTER_MS,
  COMPOSER_FIELD_EXIT_MS,
} from "../../pages/bandeja/useComposerFieldMotion";
import { useAppleListMotion, type AppleListPhase } from "../../hooks/useAppleListMotion";
import { AppleMotionBlock } from "../ui/AppleMotionBlock";
import { Avatar } from "../ui/Avatar";
import { TEXTAREA_AUTO_GROW_CLASS } from "../ui/Field";
import { autoResizeTextarea } from "../../lib/autoResizeTextarea";
import { formatDateTime, formatEmailListDate } from "../../lib/format";
import { buildNoteThread, type ThreadNote } from "../../lib/noteThread";

const REPLY_TEXTAREA_MIN_PX = 36;
const NOTE_REPLY_THREAD_GAP_PX = 10;
/** Aire entre nota padre y primera respuesta; el tronco sube ese mismo tramo. */
const NOTE_REPLY_PARENT_GAP_PX = 10;

const REPLY_TEXTAREA_CLASS = `w-full rounded-md border border-line-strong bg-white px-2.5 py-1.5 text-[12px] leading-snug text-ink outline-none
  transition-[height,border-color,box-shadow] duration-200 ease-plf-panel placeholder:text-faint
  focus:border-brand-red focus:ring-2 focus:ring-brand-red/10 shadow-2xs ${TEXTAREA_AUTO_GROW_CLASS}`;

export interface InternalNoteThreadItem extends ThreadNote {
  authorStaffId: number;
  authorName: string;
  body: string;
}

interface InternalNoteThreadProps<T extends InternalNoteThreadItem> {
  notes: T[];
  currentStaffId?: number;
  canReply?: boolean;
  emptyState?: ReactNode;
  onReply: (parentId: number, body: string) => Promise<void>;
  /** Contenido extra bajo el cuerpo (adjuntos, etc.). */
  renderExtra?: (note: T) => ReactNode;
  /** Variante visual: bandeja compacta vs ficha amplia. */
  density?: "compact" | "comfortable";
}

function isReplyNote(note: ThreadNote): boolean {
  return note.parentId != null;
}

function ReplyComposer({
  parentAuthorName,
  busy,
  onCancel,
  onSubmit,
}: {
  parentAuthorName: string;
  busy: boolean;
  onCancel: () => void;
  onSubmit: (body: string) => void;
}) {
  const [draft, setDraft] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    textareaRef.current?.focus();
    autoResizeTextarea(textareaRef.current, REPLY_TEXTAREA_MIN_PX);
  }, []);

  return (
    <div className="flex flex-col gap-1.5 rounded-md border border-amber-200/80 bg-white p-2 shadow-2xs">
      <p className="flex items-center gap-1 text-[10.5px] font-medium leading-none text-zinc-600">
        <CornerDownRight className="size-3 shrink-0 text-amber-700" aria-hidden />
        <span>
          Respondiendo a <span className="font-semibold text-zinc-800">{parentAuthorName}</span>
        </span>
      </p>
      <textarea
        ref={textareaRef}
        value={draft}
        rows={1}
        placeholder="Escribe tu respuesta…"
        className={REPLY_TEXTAREA_CLASS}
        style={{ minHeight: REPLY_TEXTAREA_MIN_PX }}
        onChange={(e) => {
          setDraft(e.target.value);
          autoResizeTextarea(e.target, REPLY_TEXTAREA_MIN_PX);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && draft.trim()) {
            e.preventDefault();
            onSubmit(draft.trim());
          }
        }}
      />
      <div className="flex items-center justify-end gap-1.5">
        <button
          type="button"
          onClick={onCancel}
          disabled={busy}
          className="inline-flex h-6 items-center gap-1 rounded-md px-1.5 text-[11px] font-medium text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800 cursor-pointer disabled:opacity-50"
        >
          <X className="size-3" />
          Cancelar
        </button>
        <button
          type="button"
          disabled={busy || !draft.trim()}
          onClick={() => onSubmit(draft.trim())}
          className="inline-flex h-6 items-center gap-1 rounded-md bg-brand-red px-2 text-[11px] font-semibold text-white shadow-2xs hover:bg-brand-red/90 cursor-pointer disabled:opacity-50"
        >
          {busy ? <Loader2 className="size-3 animate-spin" /> : <Send className="size-3" />}
          Enviar
        </button>
      </div>
    </div>
  );
}

function NoteCard<T extends InternalNoteThreadItem>({
  node,
  depth,
  currentStaffId,
  canReply,
  replyingToId,
  replyBusy,
  density,
  onStartReply,
  onCancelReply,
  onSubmitReply,
  replyPhaseFor,
  replyComposerExiting,
  bodyExpanded,
  bodyPhaseFor,
  bodyExiting,
  onToggleBody,
  onEnsureBodyOpen,
  renderExtra,
}: {
  node: import("../../lib/noteThread").NoteThreadNode<T>;
  depth: number;
  currentStaffId?: number;
  canReply?: boolean;
  replyingToId: number | null;
  replyBusy: boolean;
  density: "compact" | "comfortable";
  onStartReply: (id: number) => void;
  onCancelReply: () => void;
  onSubmitReply: (parentId: number, body: string) => void;
  replyPhaseFor: (noteId: number) => AppleListPhase;
  replyComposerExiting: (noteId: number) => boolean;
  bodyExpanded: (noteId: number) => boolean;
  bodyPhaseFor: (noteId: number) => AppleListPhase;
  bodyExiting: (noteId: number) => boolean;
  onToggleBody: (noteId: number) => void;
  onEnsureBodyOpen: (noteId: number) => void;
  renderExtra?: (note: T) => ReactNode;
}) {
  const { note, replies } = node;
  const isMine = currentStaffId != null && note.authorStaffId === currentStaffId;

  const headerPad = density === "compact" ? "px-2.5 py-1.5" : "px-3 py-1.5";
  const bodyPad = density === "compact" ? "px-2.5 py-2" : "px-3 py-2";
  const collapsible = depth > 0 || isReplyNote(note);
  const expanded = collapsible ? bodyExpanded(note.id) : true;
  const showBody = collapsible ? expanded || bodyExiting(note.id) : true;

  const noteDateLabel = formatEmailListDate(note.createdAt);

  const headerIdentity = (
    <div className="flex min-w-0 flex-1 items-center gap-2">
      {collapsible && (
        <ChevronDown
          className={`size-3.5 shrink-0 text-amber-700 transition-transform duration-300 ease-plf-panel ${
            expanded ? "rotate-180" : ""
          }`}
          aria-hidden
        />
      )}
      <Avatar name={note.authorName} seed={note.authorStaffId} size={density === "compact" ? 20 : 22} />
      <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5">
        <span className="truncate text-[12px] font-semibold text-zinc-900" title={note.authorName}>
          {note.authorName}
        </span>
        {isMine && (
          <span className="rounded bg-brand-red/10 px-1 py-0.5 font-heading text-[8.5px] font-bold text-brand-red">
            Tú
          </span>
        )}
        {collapsible && (
          <>
            <span className="inline-flex items-center gap-0.5 rounded-md bg-white/80 px-1.5 py-0.5 text-[10px] font-medium text-amber-900/80 ring-1 ring-inset ring-amber-200/80">
              <CornerDownRight className="size-2.5" aria-hidden />
              Respuesta
            </span>
            <time
              dateTime={note.createdAt}
              title={formatDateTime(note.createdAt)}
              className="text-[11px] font-medium tabular-nums text-zinc-400"
            >
              {noteDateLabel}
            </time>
          </>
        )}
      </div>
    </div>
  );

  const noteCard = (
    <>
      <article className="rounded-lg border border-amber-200/90 bg-amber-50/30 shadow-2xs">
        <header
          className={`relative flex min-h-[34px] items-center justify-between gap-x-2 gap-y-1 ${headerPad} ${
            showBody ? "border-b border-amber-200/70" : ""
          }`}
        >
          {collapsible ? (
            <button
              type="button"
              aria-expanded={expanded}
              onClick={() => onToggleBody(note.id)}
              className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 text-left"
            >
              {headerIdentity}
            </button>
          ) : (
            <div className="min-w-0 flex-1">{headerIdentity}</div>
          )}
          {!collapsible && (
            <time
              dateTime={note.createdAt}
              title={formatDateTime(note.createdAt)}
              className="shrink-0 text-[11px] font-medium tabular-nums text-zinc-400"
            >
              {noteDateLabel}
            </time>
          )}
          {canReply && replyingToId !== note.id && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onEnsureBodyOpen(note.id);
                onStartReply(note.id);
              }}
              className="inline-flex h-6 shrink-0 items-center gap-1 rounded-md px-2 text-[10.5px] font-medium text-zinc-600 hover:bg-white/90 hover:text-zinc-900 cursor-pointer"
            >
              <Reply className="size-3" />
              Responder
            </button>
          )}
          {depth > 0 && (
            <span
              aria-hidden
              className="pointer-events-none absolute -left-[9.5px] z-10 w-[9.5px] rounded-bl-[7px] border-b border-l border-amber-300/80"
              style={{ top: -(NOTE_REPLY_PARENT_GAP_PX + 1), bottom: expanded && !bodyExiting(note.id) ? -1 : "calc(50% - 0.5px)" }}
            />
          )}
        </header>
        {showBody &&
          (collapsible ? (
            <AppleMotionBlock phase={bodyPhaseFor(note.id)} rowPreset="composer">
              <div className={`${bodyPad} text-[12px] leading-snug text-zinc-800`}>
                <p className="whitespace-pre-wrap">{note.body}</p>
                {renderExtra?.(note)}
              </div>
            </AppleMotionBlock>
          ) : (
            <div className={`${bodyPad} text-[12px] leading-snug text-zinc-800`}>
              <p className="whitespace-pre-wrap">{note.body}</p>
              {renderExtra?.(note)}
            </div>
          ))}
        {(replyingToId === note.id || replyComposerExiting(note.id)) && (
          <AppleMotionBlock
            phase={replyPhaseFor(note.id)}
            rowPreset="composer"
            className="border-t border-amber-200/60 px-2.5 py-2"
          >
            <ReplyComposer
              parentAuthorName={note.authorName}
              busy={replyBusy}
              onCancel={onCancelReply}
              onSubmit={(body) => onSubmitReply(note.id, body)}
            />
          </AppleMotionBlock>
        )}
      </article>
      {replies.length > 0 && (
        <div className="relative mt-2.5 flex flex-col gap-2.5 pl-[26px]">
          {replies.map((child, idx) => (
            <div key={child.note.id} className="relative z-[1]">
              {idx < replies.length - 1 && (
                <span
                  aria-hidden
                  className="pointer-events-none absolute -left-[9px] w-px bg-amber-300/80"
                  style={{ top: -NOTE_REPLY_PARENT_GAP_PX, bottom: -NOTE_REPLY_THREAD_GAP_PX }}
                />
              )}
              <NoteCard
                node={child}
                depth={depth + 1}
                currentStaffId={currentStaffId}
                canReply={canReply}
                replyingToId={replyingToId}
                replyBusy={replyBusy}
                density={density}
                onStartReply={onStartReply}
                onCancelReply={onCancelReply}
                onSubmitReply={onSubmitReply}
                replyPhaseFor={replyPhaseFor}
                replyComposerExiting={replyComposerExiting}
                bodyExpanded={bodyExpanded}
                bodyPhaseFor={bodyPhaseFor}
                bodyExiting={bodyExiting}
                onToggleBody={onToggleBody}
                onEnsureBodyOpen={onEnsureBodyOpen}
                renderExtra={renderExtra}
              />
            </div>
          ))}
        </div>
      )}
    </>
  );

  return <div className="relative">{noteCard}</div>;
}

export function InternalNoteThread<T extends InternalNoteThreadItem>({
  notes,
  currentStaffId,
  canReply = true,
  emptyState,
  onReply,
  renderExtra,
  density = "comfortable",
}: InternalNoteThreadProps<T>) {
  const [replyingToId, setReplyingToId] = useState<number | null>(null);
  const [replyBusy, setReplyBusy] = useState(false);

  const [expandedIds, setExpandedIds] = useState<number[]>([]);

  const expandedKeys = useMemo(
    () => expandedIds.map((id) => `body-${id}`),
    [expandedIds],
  );

  const bodyMotion = useAppleListMotion(expandedKeys, {
    minItems: 0,
    enterMs: COMPOSER_FIELD_ENTER_MS,
    exitMs: COMPOSER_FIELD_EXIT_MS,
  });

  const bodyKeyFor = useCallback((noteId: number) => `body-${noteId}`, []);

  const bodyExpanded = useCallback(
    (noteId: number) => expandedIds.includes(noteId),
    [expandedIds],
  );

  const bodyPhaseFor = useCallback(
    (noteId: number) => bodyMotion.phaseFor(bodyKeyFor(noteId)),
    [bodyMotion, bodyKeyFor],
  );

  const bodyExiting = useCallback(
    (noteId: number) => bodyMotion.isExiting(bodyKeyFor(noteId)),
    [bodyMotion, bodyKeyFor],
  );

  const ensureBodyOpen = useCallback(
    (noteId: number) => {
      const note = notes.find((n) => n.id === noteId);
      if (note == null || !isReplyNote(note)) return;
      setExpandedIds((prev) => (prev.includes(noteId) ? prev : [...prev, noteId]));
    },
    [notes],
  );

  const toggleBody = useCallback(
    (noteId: number) => {
      const note = notes.find((n) => n.id === noteId);
      if (note == null || !isReplyNote(note)) return;

      if (expandedIds.includes(noteId)) {
        bodyMotion.requestRemove(bodyKeyFor(noteId), () => {
          setExpandedIds((prev) => prev.filter((id) => id !== noteId));
        });
      } else {
        ensureBodyOpen(noteId);
      }
    },
    [bodyMotion, bodyKeyFor, expandedIds, ensureBodyOpen, notes],
  );

  const replyKeys = useMemo(
    () => (replyingToId != null ? [`reply-${replyingToId}`] : []),
    [replyingToId],
  );
  const replyMotion = useAppleListMotion(replyKeys, {
    minItems: 0,
    enterMs: COMPOSER_FIELD_ENTER_MS,
    exitMs: COMPOSER_FIELD_EXIT_MS,
  });

  const replyKeyFor = useCallback((noteId: number) => `reply-${noteId}`, []);
  const replyPhaseFor = useCallback(
    (noteId: number) => replyMotion.phaseFor(replyKeyFor(noteId)),
    [replyMotion, replyKeyFor],
  );
  const replyComposerExiting = useCallback(
    (noteId: number) => replyMotion.isExiting(replyKeyFor(noteId)),
    [replyMotion, replyKeyFor],
  );

  const closeReplyComposer = useCallback(() => {
    if (replyingToId == null) return;
    replyMotion.requestRemove(replyKeyFor(replyingToId), () => setReplyingToId(null));
  }, [replyingToId, replyMotion, replyKeyFor]);

  const roots = buildNoteThread(notes);

  const handleSubmitReply = useCallback(
    async (parentId: number, body: string) => {
      setReplyBusy(true);
      try {
        await onReply(parentId, body);
        replyMotion.requestRemove(replyKeyFor(parentId), () => setReplyingToId(null));
      } finally {
        setReplyBusy(false);
      }
    },
    [onReply, replyMotion, replyKeyFor],
  );

  if (roots.length === 0) return emptyState ?? null;

  return (
    <div className="space-y-3">
      {roots.map((node) => (
        <NoteCard
          key={node.note.id}
          node={node}
          depth={0}
          currentStaffId={currentStaffId}
          canReply={canReply}
          replyingToId={replyingToId}
          replyBusy={replyBusy}
          density={density}
          onStartReply={setReplyingToId}
          onCancelReply={closeReplyComposer}
          onSubmitReply={handleSubmitReply}
          replyPhaseFor={replyPhaseFor}
          replyComposerExiting={replyComposerExiting}
          bodyExpanded={bodyExpanded}
          bodyPhaseFor={bodyPhaseFor}
          bodyExiting={bodyExiting}
          onToggleBody={toggleBody}
          onEnsureBodyOpen={ensureBodyOpen}
          renderExtra={renderExtra}
        />
      ))}
    </div>
  );
}
