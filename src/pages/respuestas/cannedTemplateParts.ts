import { normalizeVariableKey } from "../../lib/cannedVariables";

export type TemplatePart =
  | { kind: "text"; text: string }
  | { kind: "variable"; key: string };

const VARIABLE_PATTERN = /\{([a-z0-9_.]+)\}/gi;

export function templateHasVariables(raw: string): boolean {
  return /\{[a-z][a-z0-9_.]*\}/i.test(raw);
}

/** Convierte `{cliente.nombre}` escrito a mano en segmentos con chips. */
export function normalizeTemplateValue(raw: string): string {
  if (!templateHasVariables(raw)) return raw;
  return stringifyTemplate(parseTemplateString(raw));
}

/** Convierte el texto guardado en segmentos alternando texto y variables. */
export function parseTemplateString(raw: string): TemplatePart[] {
  VARIABLE_PATTERN.lastIndex = 0;
  if (!raw) return [{ kind: "text", text: "" }];

  const parts: TemplatePart[] = [];
  let lastIndex = 0;

  for (const match of raw.matchAll(VARIABLE_PATTERN)) {
    const index = match.index ?? 0;
    if (index > lastIndex) {
      parts.push({ kind: "text", text: raw.slice(lastIndex, index) });
    }
    parts.push({ kind: "variable", key: normalizeVariableKey(match[1]) });
    lastIndex = index + match[0].length;
  }

  if (lastIndex < raw.length) {
    parts.push({ kind: "text", text: raw.slice(lastIndex) });
  }

  if (parts.length === 0) parts.push({ kind: "text", text: "" });
  return coalesceTextParts(parts);
}

export function stringifyTemplate(parts: TemplatePart[]): string {
  return parts
    .map((part) => (part.kind === "text" ? part.text : `{${part.key}}`))
    .join("");
}

function coalesceTextParts(parts: TemplatePart[]): TemplatePart[] {
  const merged: TemplatePart[] = [];
  for (const part of parts) {
    if (part.kind === "text") {
      const prev = merged[merged.length - 1];
      if (prev?.kind === "text") prev.text += part.text;
      else merged.push({ ...part });
    } else {
      merged.push(part);
    }
  }
  return merged.length > 0 ? merged : [{ kind: "text", text: "" }];
}

export function insertVariableIntoParts(
  parts: TemplatePart[],
  token: string,
  partIndex: number,
  caret: number,
): TemplatePart[] {
  const key = normalizeVariableKey(token);
  const next = [...parts];
  let idx = partIndex;
  if (next[idx]?.kind !== "text") {
    idx = next.findIndex((p) => p.kind === "text");
    if (idx < 0) {
      return coalesceTextParts([{ kind: "variable", key }, { kind: "text", text: "" }]);
    }
  }

  const textPart = next[idx] as { kind: "text"; text: string };
  const before = textPart.text.slice(0, caret);
  const after = textPart.text.slice(caret);

  const replacement: TemplatePart[] = [];
  if (before) replacement.push({ kind: "text", text: before });
  replacement.push({ kind: "variable", key });
  replacement.push({ kind: "text", text: after });

  next.splice(idx, 1, ...replacement);
  return coalesceTextParts(next);
}

export function removeVariableFromParts(parts: TemplatePart[], variableIndex: number): TemplatePart[] {
  if (parts[variableIndex]?.kind !== "variable") return parts;
  const next = parts.filter((_, i) => i !== variableIndex);
  return coalesceTextParts(next);
}

export function updateTextPart(parts: TemplatePart[], textIndex: number, text: string): TemplatePart[] {
  if (parts[textIndex]?.kind !== "text") return parts;
  const next = [...parts];
  next[textIndex] = { kind: "text", text };
  return next;
}
