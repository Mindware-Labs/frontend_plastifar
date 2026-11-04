import { Eye, FileText } from "lucide-react";
import { Button } from "../../components/ui/Button";
import { formatBytes } from "../../lib/format";
import type { TaskAttachment, TaskAttachmentKind, TaskComment } from "../../types/tasks";

export function attachmentsByKind(attachments: TaskAttachment[], kind: TaskAttachmentKind) {
  return attachments.filter((a) => a.kind === kind);
}

/** Agrupa adjuntos de seguimiento con la nota cuyo momento de registro les precede. */
export function mapSeguimientoAttachmentsToComments(
  comments: TaskComment[],
  attachments: TaskAttachment[],
): Map<number, TaskAttachment[]> {
  const map = new Map<number, TaskAttachment[]>();
  const sorted = [...comments].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );
  for (const comment of sorted) {
    map.set(comment.id, []);
  }

  const seguimiento = attachments
    .filter((a) => a.kind === "Seguimiento")
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  for (const file of seguimiento) {
    const at = new Date(file.createdAt).getTime();
    let target: TaskComment | undefined;
    for (const comment of sorted) {
      if (new Date(comment.createdAt).getTime() <= at + 2000) {
        target = comment;
      } else {
        break;
      }
    }
    if (target) {
      map.get(target.id)!.push(file);
    } else if (sorted.length > 0) {
      map.get(sorted[0].id)!.push(file);
    }
  }

  return map;
}

export function TaskAttachmentInlineList({
  attachments,
  onOpen,
  compact = false,
}: {
  attachments: TaskAttachment[];
  onOpen: (attachmentId: number) => void;
  compact?: boolean;
}) {
  if (attachments.length === 0) return null;

  return (
    <ul className={`${compact ? "mt-2" : "mt-2.5"} space-y-1.5`}>
      {attachments.map((att) => (
        <li
          key={att.id}
          className="flex items-center justify-between gap-2 rounded-md border border-zinc-200/80 bg-white/90 px-2.5 py-2 shadow-2xs"
        >
          <div className="flex min-w-0 items-center gap-2">
            <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-zinc-100 text-zinc-500">
              <FileText className="size-3.5" />
            </span>
            <div className="min-w-0">
              <span className="block truncate text-[12px] font-semibold text-zinc-900" title={att.fileName}>
                {att.fileName}
              </span>
              <span className="block text-[10.5px] tabular-nums text-zinc-400">
                {formatBytes(att.sizeBytes)}
                {att.uploadedByName ? ` · ${att.uploadedByName}` : ""}
              </span>
            </div>
          </div>
          <Button type="button" variant="secondary" size="sm" onClick={() => onOpen(att.id)}>
            <Eye className="size-3" />
            Ver
          </Button>
        </li>
      ))}
    </ul>
  );
}
