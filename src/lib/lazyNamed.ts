import { lazy, type ComponentType } from "react";

/**
 * `React.lazy` para modulos con export con nombre: cada pantalla se descarga
 * en su propio fragmento la primera vez que se abre, en vez de venir todas en
 * el bundle inicial.
 */
export function lazyNamed<M, K extends keyof M>(load: () => Promise<M>, name: K) {
  return lazy(() =>
    load().then((module) => ({ default: module[name] as M[K] & ComponentType<any> })),
  );
}
