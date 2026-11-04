import { CornerDownRight, Loader2, Reply, Send, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  COMPOSER_FIELD_ENTER_MS,
  COMPOSER_FIELD_EXIT_MS,
} from "../../pages/bandeja/useComposerFieldMotion";
import { useAppleListMotion } from "../../hooks/useAppleListMotion";
import { AppleMotionBlock } from "../ui/AppleMotionBlock";
import { Avatar } from "../ui/Avatar";
import { TEXTAREA_AUTO_GROW_CLASS, TEXTAREA_ONE_LINE_MIN_PX } from "../ui/Field";
import { autoResizeTextarea } from "../../lib/autoResizeTextarea";
import { formatDateTime } from "../../lib/format";
import { buildNoteThread, type ThreadNote } from "../../lib/noteThread";

const REPLY_TEXTAREA_CLASS = `w-full rounded-lg border border-line-strong bg-white px-3 py-2 text-[13px] leading-relaxed text-ink outline-none
  transition-[height,border-color,box-shadow] duration-200 ease-plf-spring placeholder:text-faint
  focus:border-brand-red focus:ring-3 focus:ring-brand-red/10 shadow-2xs ${TEXTAREA_AUTO_GROW_CLASS}`;

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
    autoResizeTextarea(textareaRef.current, TEXTAREA_ONE_LINE_MIN_PX);
  }, []);

  return (
    <div className="mt-2 rounded-lg border border-amber-200/80 bg-white p-2.5 shadow-2xs">
      <p className="mb-2 flex items-center gap-1.5 text-[11px] font-medium text-zinc-600">
        <CornerDownRight className="size-3.5 shrink-0 text-amber-700" aria-hidden />
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
        style={{ minHeight: TEXTAREA_ONE_LINE_MIN_PX }}
        onChange={(e) => {
          setDraft(e.target.value);
          autoResizeTextarea(e.target, TEXTAREA_ONE_LINE_MIN_PX);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && draft.trim()) {
            e.preventDefault();
            onSubmit(draft.trim());
          }
        }}
      />
      <div className="mt-2 flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={busy}
          className="inline-flex h-7 items-center gap-1 rounded-md px-2 text-[11.5px] font-medium text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800 cursor-pointer disabled:opacity-50"
        >
          <X className="size-3.5" />
          Cancelar
        </button>
        <button
          type="button"
          disabled={busy || !draft.trim()}
          onClick={() => onSubmit(draft.trim())}
          className="inline-flex h-7 items-center gap-1.5 rounded-md bg-brand-red px-2.5 text-[11.5px] font-semibold text-white shadow-2xs hover:bg-brand-red/90 cursor-pointer disabled:opacity-50"
        >
          {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Send className="size-3.5" />}
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
  replyPhaseFor: (noteId: number) => import("../../hooks/useAppleListMotion").AppleListPhase;
  replyComposerExiting: (noteId: number) => boolean;
  renderExtra?: (note: T) => ReactNode;
}) {
  const { note, replies } = node;
  const isMine = currentStaffId != null && note.authorStaffId === currentStaffId;
  const pad = depth > 0 ? "ml-4 sm:ml-5 border-l-2 border-amber-300/70 pl-3 sm:pl-4" : "";

  const bodyPad = density === "compact" ? "p-2.5" : "p-3.5";
  const headerPad = density === "compact" ? "px-2.5 py-1.5" : "px-3.5 py-2";

  return (
    <div className={`space-y-2.5 ${pad}`}>
      <article className="overflow-hidden rounded-lg border border-amber-200/90 bg-amber-50/30 shadow-2xs">
        <header
          className={`flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-b border-amber-200/70 ${headerPad}`}
        >
          <div className="flex min-w-0 items-center gap-2">
            <Avatar name={note.authorName} seed={note.authorStaffId} size={density === "compact" ? 20 : 24} />
            <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5">
              <span className="truncate text-[12.5px] font-semibold text-zinc-900" title={note.authorName}>
                {note.authorName}
              </span>
              {isMine && (
                <span className="rounded bg-brand-red/10 px-1 py-0.5 font-heading text-[8.5px] font-bold text-brand-red">
                  Tú
                </span>
              )}
              {depth > 0 && (
                <span className="inline-flex items-center gap-0.5 rounded-md bg-white/80 px-1.5 py-0.5 text-[10px] font-medium text-amber-900/80 ring-1 ring-inset ring-amber-200/80">
                  <CornerDownRight className="size-2.5" aria-hidden />
                  Respuesta
                </span>
              )}
              <time dateTime={note.createdAt} className="text-[11px] tabular-nums text-zinc-400">
                {formatDateTime(note.createdAt)}
              </time>
            </div>
          </div>
          {canReply && replyingToId !== note.id && (
            <button
              type="button"
              onClick={() => onStartReply(note.id)}
              className="inline-flex h-7 items-center gap-1 rounded-md px-2 text-[11px] font-medium text-zinc-600 hover:bg-white/90 hover:text-zinc-900 cursor-pointer"
            >
              <Reply className="size-3.5" />
              Responder
            </button>
          )}
        </header>
        <div className={`${bodyPad} text-[13px] leading-relaxed text-zinc-800`}>
          <p className="whitespace-pre-wrap">{note.body}</p>
          {renderExtra?.(note)}
        </div>
        {(replyingToId === note.id || replyComposerExiting(note.id)) && (
          <div className={`border-t border-amber-200/60 ${bodyPad} pt-0`}>
            <AppleMotionBlock phase={replyPhaseFor(note.id)} rowPreset="composer">
              <ReplyComposer
                parentAuthorName={note.authorName}
                busy={replyBusy}
                onCancel={onCancelReply}
                onSubmit={(body) => onSubmitReply(note.id, body)}
              />
            </AppleMotionBlock>
          </div>
        )}
      </article>
      {replies.map((child) => (
        <NoteCard
          key={child.note.id}
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
          renderExtra={renderExtra}
        />
      ))}
    </div>
  );
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
          renderExtra={renderExtra}
        />
      ))}
    </div>
  );
}
