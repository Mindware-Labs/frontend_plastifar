/** Exportacion a CSV del resultado tal como se ve (seccion 11.3). */
export function downloadCsv(filename: string, headers: string[], rows: (string | number)[][]) {
  const escape = (value: string | number) => {
    const text = String(value);
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };

  // BOM: para que Excel reconozca UTF-8 en vez de leerlo como Latin-1.
  const csv = "﻿" + [headers, ...rows].map((row) => row.map(escape).join(",")).join("\r\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
