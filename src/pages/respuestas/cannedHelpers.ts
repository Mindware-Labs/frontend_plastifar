export const CANNED_CATEGORIES = [
  "General",
  "Atención al Cliente",
  "Logística y Envíos",
  "Facturación y Cobros",
  "Calidad y Garantías",
  "Cierre y Despedida",
] as const;

export type CannedCategory = (typeof CANNED_CATEGORIES)[number] | string;

export interface ParsedCannedResponse {
  category: string;
  cleanTitle: string;
  cleanBody: string;
  suggestedSubject?: string;
}

/** Extrae la categoría del título si viene con formato [Categoría] Título */
export function parseCannedTitle(rawTitle: string): { category: string; cleanTitle: string } {
  const match = rawTitle.match(/^\[(.*?)\]\s*(.*)$/);
  if (match) {
    const category = match[1].trim() || "General";
    const cleanTitle = match[2].trim() || rawTitle.trim();
    return { category, cleanTitle };
  }
  return { category: "General", cleanTitle: rawTitle.trim() };
}

/** Formatea el título combinando la categoría si no es General */
export function formatCannedTitle(cleanTitle: string, category: string): string {
  const cat = category.trim();
  if (!cat || cat.toLowerCase() === "general") {
    return cleanTitle.trim();
  }
  return `[${cat}] ${cleanTitle.trim()}`;
}

/** Extrae el asunto sugerido opcional del cuerpo si contiene <!--subject: ...--> */
export function parseCannedBody(rawBody: string): { cleanBody: string; suggestedSubject?: string } {
  const match = rawBody.match(/^<!--subject:\s*(.*?)\s*-->\r?\n?/);
  if (match) {
    return {
      suggestedSubject: match[1].trim(),
      cleanBody: rawBody.slice(match[0].length).trimStart(),
    };
  }
  return { cleanBody: rawBody };
}

/** Serializa el cuerpo con el asunto sugerido si fue provisto */
export function formatCannedBody(cleanBody: string, suggestedSubject?: string): string {
  const sub = suggestedSubject?.trim();
  if (sub) {
    return `<!--subject:${sub}-->\n${cleanBody.trim()}`;
  }
  return cleanBody.trim();
}

/** Devuelve la entidad completa parseada lista para la interfaz */
export function parseCanned(rawTitle: string, rawBody: string, categoryName?: string | null): ParsedCannedResponse {
  const { category: parsedCat, cleanTitle } = parseCannedTitle(rawTitle);
  const { cleanBody, suggestedSubject } = parseCannedBody(rawBody);
  const category = categoryName?.trim() || parsedCat || "General";
  return { category, cleanTitle, cleanBody, suggestedSubject };
}

/** Colores armónicos Plastifar para las etiquetas de categoría */
export function getCategoryBadgeClasses(category: string, color?: string | null): {
  badge: string;
  dot: string;
} {
  if (color) {
    const c = color.toLowerCase().trim();
    if (c === "indigo") return { badge: "border-indigo-200/80 bg-indigo-50/80 text-indigo-700", dot: "bg-indigo-500" };
    if (c === "blue") return { badge: "border-blue-200/80 bg-blue-50/80 text-blue-700", dot: "bg-blue-500" };
    if (c === "emerald") return { badge: "border-emerald-200/80 bg-emerald-50/80 text-emerald-700", dot: "bg-emerald-500" };
    if (c === "amber") return { badge: "border-amber-200/80 bg-amber-50/80 text-amber-700", dot: "bg-amber-500" };
    if (c === "teal") return { badge: "border-teal-200/80 bg-teal-50/80 text-teal-700", dot: "bg-teal-500" };
    if (c === "zinc") return { badge: "border-zinc-200 bg-zinc-100/70 text-zinc-700", dot: "bg-zinc-400" };
  }

  const cat = category.toLowerCase().trim();
  if (cat.includes("logística") || cat.includes("logistica") || cat.includes("envío") || cat.includes("envio")) {
    return {
      badge: "border-blue-200/80 bg-blue-50/80 text-blue-700",
      dot: "bg-blue-500",
    };
  }
  if (cat.includes("factura") || cat.includes("cobro") || cat.includes("pago")) {
    return {
      badge: "border-emerald-200/80 bg-emerald-50/80 text-emerald-700",
      dot: "bg-emerald-500",
    };
  }
  if (cat.includes("calidad") || cat.includes("garantía") || cat.includes("garantia") || cat.includes("reclamo")) {
    return {
      badge: "border-amber-200/80 bg-amber-50/80 text-amber-700",
      dot: "bg-amber-500",
    };
  }
  if (cat.includes("atención") || cat.includes("atencion") || cat.includes("soporte") || cat.includes("cliente")) {
    return {
      badge: "border-indigo-200/80 bg-indigo-50/80 text-indigo-700",
      dot: "bg-indigo-500",
    };
  }
  if (cat.includes("cierre") || cat.includes("despedida") || cat.includes("gracias")) {
    return {
      badge: "border-teal-200/80 bg-teal-50/80 text-teal-700",
      dot: "bg-teal-500",
    };
  }
  return {
    badge: "border-zinc-200 bg-zinc-100/70 text-zinc-700",
    dot: "bg-zinc-400",
  };
}
