import { Component, type ReactNode } from "react";
import { ErrorRetry } from "../ui/ErrorRetry";

interface Props {
  children: ReactNode;
  /** Cambia al navegar: una pantalla nueva no hereda el fallo de la anterior. */
  resetKey: string;
}

interface State {
  failed: boolean;
  resetKey: string;
}

/**
 * Lo que se ve cuando una pantalla no llega a montarse.
 *
 * Cada pantalla se descarga en su propio fragmento (`lazyNamed`). Si esa
 * descarga falla —la red se cortó, o hubo un despliegue y el fragmento viejo ya
 * no existe— React propaga el error hacia arriba y, sin un limite, desmontaba
 * la aplicacion entera: pantalla en blanco, sin barra lateral, sin salida.
 *
 * Con el limite el fallo queda dentro del area de contenido. La barra lateral
 * sigue ahi, y la salida es recargar: tras un despliegue es lo unico que trae
 * los fragmentos nuevos.
 */
export class ScreenErrorBoundary extends Component<Props, State> {
  state: State = { failed: false, resetKey: this.props.resetKey };

  static getDerivedStateFromError(): Partial<State> {
    return { failed: true };
  }

  static getDerivedStateFromProps(props: Props, state: State): Partial<State> | null {
    return props.resetKey !== state.resetKey ? { failed: false, resetKey: props.resetKey } : null;
  }

  render() {
    if (!this.state.failed) return this.props.children;

    return (
      <div className="pt-4">
        <ErrorRetry onRetry={() => window.location.reload()}>
          No se pudo abrir esta pantalla. Puede ser la conexión o una versión nueva del panel.
        </ErrorRetry>
      </div>
    );
  }
}
