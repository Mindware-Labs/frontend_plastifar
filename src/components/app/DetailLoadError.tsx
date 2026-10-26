import type { ReactNode } from "react";
import { ErrorRetry } from "../ui/ErrorRetry";
import { ModuleHeader, type ModuleHeaderSection } from "./ModuleHeader";

interface DetailLoadErrorProps {
  /** Titulo generico de la ficha: el del registro no se conoce si no cargo. */
  title: string;
  sections?: ModuleHeaderSection[];
  /** Ancho de la ficha, el mismo que tendria cargada. */
  className?: string;
  onRetry: () => void;
  children: ReactNode;
}

/** Ficha que no se pudo cargar: la cabecera del modulo y el fallo con su salida. */
export function DetailLoadError({ title, sections, className, onRetry, children }: DetailLoadErrorProps) {
  return (
    <div className={className}>
      <ModuleHeader title={title} sections={sections} />
      <ErrorRetry onRetry={onRetry}>{children}</ErrorRetry>
    </div>
  );
}
