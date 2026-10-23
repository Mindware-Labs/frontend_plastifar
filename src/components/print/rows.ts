/** Renglones vacíos hasta completar los del papel; con más datos, sigue. */
export function padRows<T>(items: T[], minimum: number): (T | null)[] {
  return items.length >= minimum ? items : [...items, ...Array<null>(minimum - items.length).fill(null)];
}
