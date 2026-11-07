import type { CaptureBlock } from "./printCapture";

/** Un corte no baja de esta fracción de página: evita páginas casi vacías. */
const MIN_PAGE_FILL = 0.25;

/**
 * Cortes de página (px del canvas) que caen entre bloques, nunca dentro de una
 * fila, un párrafo o un `.avoid-break` que quepa en una página. Si en el tramo
 * no hay ningún corte limpio, se corta al alto de página como último recurso.
 */
export function pickPageBreaks(totalHeight: number, pageHeight: number, blocks: CaptureBlock[]): number[] {
  // Un grupo más alto que una página no puede mantenerse entero: se parte por sus filas.
  const forbidden = blocks.filter((block) => block.bottom - block.top <= pageHeight);
  const candidates = Array.from(
    new Set(blocks.flatMap((block) => [Math.round(block.top), Math.round(block.bottom)])),
  ).sort((a, b) => b - a);

  const isClean = (y: number) => forbidden.every((block) => y <= block.top || y >= block.bottom);

  const breaks: number[] = [];
  let start = 0;
  while (totalHeight - start > pageHeight) {
    const limit = start + pageHeight;
    const floor = start + pageHeight * MIN_PAGE_FILL;
    const cut = candidates.find((y) => y <= limit && y > floor && isClean(y)) ?? Math.floor(limit);
    breaks.push(cut);
    start = cut;
  }
  breaks.push(totalHeight);
  return breaks;
}
