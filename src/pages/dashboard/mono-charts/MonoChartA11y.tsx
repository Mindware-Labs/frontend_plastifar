// Soporte no visual de los charts: leyenda con distincion que no depende del
// color y tabla equivalente para lectores de pantalla. Un grafico sin
// alternativa textual no existe para quien no lo ve, y rojo/verde es justo el
// par que la deuteranopia no separa — por eso cada serie lleva ademas icono y
// forma propia (relleno vs. contorno, linea continua vs. discontinua).
import type { ComponentType } from "react";

export interface LegendItem {
  label: string;
  color: string;
  /** La forma es la distincion real; el color solo la refuerza. */
  shape: "solid" | "hatch" | "line" | "dashed";
  icon: ComponentType<{ className?: string }>;
}

function Swatch({ item }: { item: LegendItem }) {
  // La muestra se dibuja con fondo, no con borde: un `border-top` de 2 px es
  // indistinguible de un filete de acento sobre una tarjeta, que es justo lo
  // que el sistema prohibe, y aqui no es eso — es el trazo de la serie.
  if (item.shape === "line" || item.shape === "dashed") {
    return (
      <span
        aria-hidden
        className="h-0.5 w-3.5 shrink-0"
        style={
          item.shape === "line"
            ? { backgroundColor: item.color }
            : {
                backgroundImage: `repeating-linear-gradient(90deg, ${item.color} 0 3px, transparent 3px 5px)`,
              }
        }
      />
    );
  }

  return (
    <span
      aria-hidden
      className="h-2.5 w-2.5 shrink-0 rounded-edge"
      style={
        item.shape === "solid"
          ? { backgroundColor: item.color }
          : // Rayas del propio color sobre el blanco de la tarjeta, en vez de
            // rayas blancas sobre el color: mismo dibujo, sin meter un blanco
            // literal que no esta en la paleta.
            {
              backgroundImage: `repeating-linear-gradient(45deg, ${item.color} 0 2px, transparent 2px 4px)`,
            }
      }
    />
  );
}

export function MonoChartLegend({ items }: { items: LegendItem[] }) {
  return (
    <ul className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1">
      {items.map((item) => (
        <li key={item.label} className="flex items-center gap-1.5 text-[11px] text-muted">
          <Swatch item={item} />
          <item.icon className="h-3 w-3 shrink-0" aria-hidden />
          <span>{item.label}</span>
        </li>
      ))}
    </ul>
  );
}

interface MonoChartTableProps {
  caption: string;
  columns: string[];
  rows: (string | number)[][];
}

/** Misma informacion que el grafico, en la forma que si puede leerse en serie. */
export function MonoChartTable({ caption, columns, rows }: MonoChartTableProps) {
  return (
    <table className="sr-only">
      <caption>{caption}</caption>
      <thead>
        <tr>
          {columns.map((column) => (
            <th key={column} scope="col">
              {column}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={String(row[0])}>
            <th scope="row">{row[0]}</th>
            {row.slice(1).map((cell, index) => (
              <td key={columns[index + 1]}>{cell}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
