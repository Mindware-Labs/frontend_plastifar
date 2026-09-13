import {
  Loader2,
  MessageSquare,
  Send,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { ticketsApi } from "../../api/tickets";
import { openOverlay } from "../../hooks/overlayStack";
import { Avatar } from "../../components/ui/Avatar";
import { Button } from "../../components/ui/Button";
import { formatDateTime } from "../../lib/format";
import type { TicketTaskCommentResponse, TicketTaskResponse } from "../../types/api";

interface TaskCommentsAsideProps {
  task: TicketTaskResponse;
  ticketId: number;
  currentStaffId: number;
  currentStaffName?: string;
  onClose: () => void;
  onCommentAdded: (taskId: number, comment: TicketTaskCommentResponse) => void;
  className?: string;
  targetHeight?: number | null;
}

export function TaskCommentsAside({
  task,
  ticketId,
  currentStaffId,
  currentStaffName,
  onClose,
  onCommentAdded,
  className = "",
  targetHeight,
}: TaskCommentsAsideProps) {
  const [commentText, setCommentText] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const commentsEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Desplazar suavemente al último comentario al abrir o al añadir uno nuevo
  useEffect(() => {
    commentsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [task.comments.length]);

  // Escape cierra el panel solo si no hay un dialogo abierto encima.
  useEffect(() => {
    const overlay = openOverlay();
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && overlay.isTop()) onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      overlay.close();
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  // Enfocar el textarea al montar o al cambiar de tarea
  useEffect(() => {
    textareaRef.current?.focus();
  }, [task.id]);

  const handleSendComment = async () => {
    const trimmed = commentText.trim();
    if (!trimmed || isSending) return;

    try {
      setIsSending(true);
      setError(null);
      const newComment = await ticketsApi.addTaskComment(ticketId, task.id, {
        comment: trimmed,
      });
      onCommentAdded(task.id, newComment);
      setCommentText("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al enviar el comentario.");
    } finally {
      setIsSending(false);
    }
  };

  return (
    <aside
      aria-label="Comentarios de la tarea"
      className={`${className} animate-plf-side-panel-in`}
    >
      <div
        style={targetHeight ? { height: `${targetHeight}px` } : undefined}
        className="flex flex-col h-[520px] max-h-[calc(100vh-6rem)] overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-2xs"
      >
        {/* Cabecera del panel lateral: Comentarios al extremo izquierdo, X al extremo derecho */}
        <div className="flex h-11 shrink-0 items-center justify-between gap-2 border-b border-zinc-100 px-3.5 bg-white">
          <div className="flex items-center gap-2 min-w-0">
            <span
              aria-hidden
              className="flex size-5 shrink-0 items-center justify-center rounded-md bg-brand-red/10 text-brand-red"
            >
              <MessageSquare className="size-3" />
            </span>
            <span className="font-heading text-[10.5px] font-bold uppercase tracking-[0.08em] text-ink">
              Comentarios
            </span>
            <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-zinc-100 px-1.5 font-heading text-[9.5px] font-bold text-zinc-600 tabular-nums">
              {task.comments.length}
            </span>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar panel de comentarios (Esc)"
            title="Cerrar panel de comentarios (Esc)"
            className="flex size-6 items-center justify-center rounded-md text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 transition-colors cursor-pointer shrink-0"
          >
            <X className="size-3.5" />
          </button>
        </div>

        {/* Lista scrollable de comentarios: tamaño fijo con flex-1 y scroll interno */}
        <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-2.5 bg-zinc-50/25">
          {task.comments.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full py-8 text-center">
              <div className="flex size-10 items-center justify-center rounded-full bg-zinc-100 text-zinc-400 mb-2">
                <MessageSquare className="size-4.5 stroke-[1.75]" />
              </div>
              <p className="font-heading text-[12.5px] font-semibold text-zinc-700">
                Sin comentarios aún
              </p>
              <p className="mt-1 max-w-[220px] text-[11px] text-zinc-400 leading-relaxed">
                Deja una nota, observación o actualización sobre el avance de esta tarea.
              </p>
            </div>
          ) : (
            task.comments.map((comment) => {
              const isMyComment = comment.authorStaffId === currentStaffId;

              return (
                <div
                  key={comment.id}
                  className="rounded-lg border border-zinc-200/80 bg-white p-2.5 shadow-2xs space-y-1.5 transition-colors hover:border-zinc-300"
                >
                  <div className="flex items-center justify-between gap-2 text-[11px]">
                    <div className="flex items-center gap-1.5 min-w-0 font-medium text-zinc-800">
                      <Avatar name={comment.authorStaffName} seed={comment.authorStaffId} size={17} />
                      <span className="font-semibold text-zinc-900 truncate max-w-[130px]" title={comment.authorStaffName}>
                        {comment.authorStaffName}
                      </span>
                      {isMyComment && (
                        <span className="rounded bg-brand-red/10 px-1 py-0.2 font-heading text-[8.5px] font-bold text-brand-red">
                          Tú
                        </span>
                      )}
                    </div>
                    <span className="shrink-0 text-[10px] text-zinc-400 tabular-nums">
                      {formatDateTime(comment.createdAt)}
                    </span>
                  </div>
                  <p className="text-[12px] leading-relaxed text-zinc-700 whitespace-pre-wrap break-words">
                    {comment.comment}
                  </p>
                </div>
              );
            })
          )}
          <div ref={commentsEndRef} />
        </div>

        {/* Input para redactar nuevo comentario: fijo en la parte inferior */}
        <div className="shrink-0 bg-white border-t border-zinc-100 p-3">
          {error && (
            <div className="mb-2 rounded-md bg-red-50 border border-red-200/80 p-2 text-[11px] text-red-600">
              {error}
            </div>
          )}

          <div className="rounded-lg border border-zinc-200 bg-white p-2 shadow-2xs transition-all focus-within:border-brand-red focus-within:ring-2 focus-within:ring-brand-red/15">
            <div className="flex items-start gap-2">
              <div className="mt-0.5 shrink-0">
                <Avatar
                  name={currentStaffName ?? "Usuario"}
                  seed={currentStaffId}
                  size={20}
                />
              </div>
              <textarea
                ref={textareaRef}
                rows={2}
                placeholder="Escribe un comentario..."
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void handleSendComment();
                  }
                }}
                className="w-full resize-none bg-transparent text-[12px] leading-relaxed text-zinc-800 outline-none placeholder:text-zinc-400"
              />
            </div>

            <div className="mt-2 flex items-center justify-between border-t border-zinc-100 pt-2 text-[10.5px]">
              <span className="text-zinc-400 flex items-center gap-1">
                <kbd className="rounded border border-zinc-200 bg-zinc-50 px-1 py-0.5 font-mono text-[9px] text-zinc-500">
                  Enter
                </kbd>
                para enviar
              </span>

              <div className="flex items-center gap-1.5 ml-auto">
                {commentText.trim() && (
                  <button
                    type="button"
                    onClick={() => setCommentText("")}
                    className="h-6.5 rounded-md px-2 text-[10.5px] font-medium text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 transition-colors cursor-pointer"
                  >
                    Limpiar
                  </button>
                )}

                <Button
                  type="button"
                  size="sm"
                  disabled={!commentText.trim() || isSending}
                  onClick={() => void handleSendComment()}
                  className="h-7 px-2.5 text-[11.5px]"
                >
                  {isSending ? (
                    <>
                      <Loader2 className="size-3 animate-spin mr-1" />
                      <span>Enviando...</span>
                    </>
                  ) : (
                    <>
                      <Send className="size-3 mr-1" />
                      <span>Comentar</span>
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
