// Variables de las plantillas de correo.
//
// Se escriben entre llaves dobles y el conjunto es cerrado: la seccion 8.3 del
// plan exige que una variable desconocida se rechace al guardar, no al enviar.
// Un error de plantilla no puede descubrirse con el correo ya en camino.

import { TEMPLATE_VARIABLES } from "../types/settings";

const PATTERN = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;

const KNOWN = new Set<string>(TEMPLATE_VARIABLES.map((variable) => variable.key));

/** Variables que aparecen en el texto, sin repetir y en orden de aparicion. */
export function usedVariables(text: string): string[] {
  return [...new Set([...text.matchAll(PATTERN)].map((match) => match[1]))];
}

/** Variables usadas que no pertenecen al catalogo. */
export function unknownVariables(text: string): string[] {
  return usedVariables(text).filter((variable) => !KNOWN.has(variable));
}

/** Sustituye cada variable por su valor de ejemplo, para la vista previa. */
export function renderPreview(text: string): string {
  return text.replace(PATTERN, (match, name: string) => {
    const variable = TEMPLATE_VARIABLES.find((candidate) => candidate.key === name);
    return variable ? variable.sample : match;
  });
}
