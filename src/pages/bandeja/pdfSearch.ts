/** Traduce una posicion del texto plano al nodo y desplazamiento que le corresponden. */
function locate(nodes: Text[], starts: number[], position: number) {
  let low = 0;
  let high = starts.length - 1;

  while (low < high) {
    const middle = Math.ceil((low + high) / 2);
    if (starts[middle] <= position) low = middle;
    else high = middle - 1;
  }

  return { node: nodes[low], offset: position - starts[low] };
}

/** Rangos de cada coincidencia sobre la capa de texto, sin alterar los renglones de pdf.js. */
export function findRanges(root: HTMLElement, query: string): Range[] {
  const needle = query.trim().toLowerCase();
  if (needle.length === 0) return [];

  const ranges: Range[] = [];

  for (const layer of root.querySelectorAll<HTMLElement>(".textLayer")) {
    const nodes: Text[] = [];
    const starts: number[] = [];
    let text = "";

    const walker = document.createTreeWalker(layer, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const node = walker.currentNode as Text;
      starts.push(text.length);
      nodes.push(node);
      text += node.data;
    }

    if (nodes.length === 0) continue;

    const haystack = text.toLowerCase();
    let from = haystack.indexOf(needle);

    while (from !== -1) {
      const start = locate(nodes, starts, from);
      const end = locate(nodes, starts, from + needle.length);
      const range = document.createRange();
      range.setStart(start.node, start.offset);
      range.setEnd(end.node, end.offset);
      ranges.push(range);
      from = haystack.indexOf(needle, from + needle.length);
    }
  }

  return ranges;
}

/** Acerca el resultado solo si quedo fuera de la vista: evita saltos innecesarios. */
export function revealRange(range: Range, container: HTMLElement) {
  const target = range.getBoundingClientRect();
  const box = container.getBoundingClientRect();
  const margin = 60;

  if (target.top >= box.top + margin && target.bottom <= box.bottom - margin) return;
  container.scrollTop += target.top - box.top - box.height / 3;
}
