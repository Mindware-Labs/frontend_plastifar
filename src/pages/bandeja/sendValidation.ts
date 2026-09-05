export interface ValidationItem {
  id: string;
  label: string;
  short: string;
}

export function formatMissingDetail(items: ValidationItem[]): string {
  const shorts = items.map((item) => item.short);
  if (shorts.length === 0) return "Completa los campos requeridos.";
  if (shorts.length === 1) return `Falta ${shorts[0]}.`;
  if (shorts.length === 2) return `Falta ${shorts[0]} y ${shorts[1]}.`;
  return `Falta ${shorts.slice(0, -1).join(", ")} y ${shorts[shorts.length - 1]}.`;
}
