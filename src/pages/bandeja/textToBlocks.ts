/** Convierte texto plano en bloques del editor: un parrafo por linea en blanco. */
export function textToBlocks(text: string): unknown[] {
  return text
    .replace(/\r\n/g, "\n")
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .map((paragraph) => ({
      type: "paragraph",
      content: paragraph.split("\n").flatMap((line, index) =>
        index === 0 ? [{ type: "text", text: line, styles: {} }] : [{ type: "text", text: `\n${line}`, styles: {} }],
      ),
    }));
}
