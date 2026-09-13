/** Estado binario de una fila: punto verde 348 C para activo, gris para inactivo. */
export function StatusDot({ active }: { active: boolean }) {
  return (
    <span className="inline-flex items-center gap-[7px] whitespace-nowrap text-[12.5px] text-brand-gray">
      <span
        aria-hidden
        className={`h-[7px] w-[7px] shrink-0 rounded-full ${active ? "bg-brand-green" : "bg-line-strong"}`}
      />
      {active ? "Activo" : "Inactivo"}
    </span>
  );
}
