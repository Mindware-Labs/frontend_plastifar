/** Exportacion a CSV del resultado tal como se ve (seccion 11.3). */

export interface CsvSection {
  /** Encabezado del bloque, el mismo que rotula la tabla en pantalla. */
  title: string;
  headers: string[];
  rows: (string | number)[][];
}

/**
 * Separador coma, no punto y coma: es-DO usa el punto como separador decimal,
 * asi que ninguna cifra exportada contiene una coma y el formato queda alineado
 * con RFC 4180. En una localidad de coma decimal habria que revisar esto.
 */
const DELIMITER = ",";

/** RFC 4180: se entrecomilla ante comilla, coma, LF y tambien CR suelto. */
const MUST_QUOTE = /["\r\n,]/;

/** Excel evalua como formula toda celda que empiece por = + - o @. */
const FORMULA_START = /^[=+\-@\t\r]/;

/** Caracteres que no pueden viajar en el atributo `download`. */
// eslint-disable-next-line no-control-regex
const UNSAFE_FILENAME = /[\u0000-\u001f\u007f\\/:*?"<>|]/g;

/**
 * El CSV de bitacora arrastra texto escrito por usuarios. Se antepone una
 * comilla simple para que Excel lea la celda como texto y no como codigo.
 */
function escape(value: string | number): string {
  const raw = String(value);
  const text = FORMULA_START.test(raw) ? `'${raw}` : raw;
  return MUST_QUOTE.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function safeFilename(filename: string): string {
  const cleaned = filename.replace(UNSAFE_FILENAME, "-").replace(/^\.+/, "").trim();
  return cleaned === "" ? "export.csv" : cleaned;
}

function serialize(sections: CsvSection[]): string {
  const lines: string[] = [];

  sections.forEach((section, index) => {
    if (index > 0) lines.push("");
    // El titulo del bloque va en su propia fila: el CSV conserva la misma
    // division que la pantalla en vez de fusionar tablas distintas.
    if (sections.length > 1) lines.push(escape(section.title));
    lines.push(section.headers.map(escape).join(DELIMITER));
    section.rows.forEach((row) => lines.push(row.map(escape).join(DELIMITER)));
  });

  // BOM: para que Excel reconozca UTF-8 en vez de leerlo como Latin-1.
  return "﻿" + lines.join("\r\n");
}

function download(filename: string, csv: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = safeFilename(filename);
  // Firefox solo dispara el click sintetico si el ancla esta en el documento.
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Firefox y WebKit resuelven la descarga en un tick posterior: revocar en el
  // mismo tick la cancelaba o dejaba un archivo de 0 bytes.
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** Una sola tabla. */
export function downloadCsv(filename: string, headers: string[], rows: (string | number)[][]) {
  download(filename, serialize([{ title: "", headers, rows }]));
}

/** Varias tablas en una hoja, cada una bajo su propio encabezado. */
export function downloadCsvSections(filename: string, sections: CsvSection[]) {
  download(filename, serialize(sections));
}
