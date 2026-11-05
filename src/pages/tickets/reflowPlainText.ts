/** Normaliza saltos de línea suaves en correos pegados para aprovechar el ancho. */
export function reflowPlainText(text: string): string {
  return text
    .replace(/\r\n/g, "\n")
    .split(/\n{2,}/)
    .map((paragraph) =>
      paragraph
        .split("\n")
        .map((line) => line.trim())
        .join(" ")
        .trim(),
    )
    .join("\n\n");
}
