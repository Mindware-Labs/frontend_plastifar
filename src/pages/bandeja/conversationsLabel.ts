/** "3 conversaciones archivadas": concuerda el sustantivo y el participio con la cantidad. */
export function conversations(count: number, singular: string, plural: string) {
  return `${count} ${count === 1 ? `conversación ${singular}` : `conversaciones ${plural}`}`;
}
