import { Spinner } from "./Spinner";

/** Carga de una pantalla entera, antes de tener nada que mostrar. */
export function PageSpinner() {
  return (
    <div className="flex justify-center py-16">
      <Spinner />
    </div>
  );
}
