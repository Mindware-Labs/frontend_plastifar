interface ProductNameCodeProps {
  name: string;
  code: string;
}

/** Nombre del producto con su codigo debajo, para la celda de una tabla de lineas. */
export function ProductNameCode({ name, code }: ProductNameCodeProps) {
  return (
    <>
      <span className="block text-[12.5px] text-ink">{name}</span>
      <span className="font-mono text-[11px] text-faint">{code}</span>
    </>
  );
}
