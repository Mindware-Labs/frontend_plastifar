/** Atenuacion del 60 % mientras hay una relectura en vuelo (DESIGN.md, «Stale data»). */
export function staleClass(isStale: boolean): string {
  return `transition-opacity ${isStale ? "opacity-60" : ""}`;
}
