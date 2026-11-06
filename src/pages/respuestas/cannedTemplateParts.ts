import { normalizeVariableKey } from "../../lib/cannedVariables";

export type TemplatePart =
  | { kind: "text"; text: string }
  | { kind: "variable"; key: string };

const VARIABLE_PATTERN = /\{([a-z0-9_.]+)\}/gi;

export function templateHasVariables(raw: string): boolean {
  return /\{[a-z][a-z0-9_.]*\}/i.test(raw);
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

