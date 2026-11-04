/** Nota con enlace padre para armar hilos de respuestas internas. */
export interface ThreadNote {
  id: number;
  parentId: number | null;
  createdAt: string;
}

export interface NoteThreadNode<T extends ThreadNote> {
  note: T;
  replies: NoteThreadNode<T>[];
}

/** Raíces en orden cronológico; respuestas anidadas bajo su padre. */
export function buildNoteThread<T extends ThreadNote>(notes: T[]): NoteThreadNode<T>[] {
  const byId = new Map<number, NoteThreadNode<T>>();
  for (const note of notes) {
    byId.set(note.id, { note, replies: [] });
  }

  const roots: NoteThreadNode<T>[] = [];
  const sorted = [...notes].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );

  for (const note of sorted) {
    const node = byId.get(note.id);
    if (!node) continue;
    if (note.parentId != null && byId.has(note.parentId)) {
      byId.get(note.parentId)!.replies.push(node);
    } else {
      roots.push(node);
    }
  }

  const sortReplies = (nodes: NoteThreadNode<T>[]) => {
    nodes.sort(
      (a, b) => new Date(a.note.createdAt).getTime() - new Date(b.note.createdAt).getTime(),
    );
    for (const n of nodes) sortReplies(n.replies);
  };
  sortReplies(roots);
  return roots;
}
