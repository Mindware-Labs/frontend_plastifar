import { useState } from "react";
import type { SortDir } from "../components/ui/DataTable";

/**
 * Orden de un listado por columnas. La misma columna alterna el sentido; otra
 * columna empieza ascendente. `sortOf(clave)` es lo que recibe `<Th sort>`.
 */
export function useSort<K extends string>(initialKey: K, initialDir: SortDir) {
  const [sort, setSort] = useState<{ key: K; dir: SortDir }>({ key: initialKey, dir: initialDir });

  function toggle(key: K) {
    setSort((current) =>
      current.key === key ? { key, dir: current.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" },
    );
  }

  const sortOf = (key: K) => ({ dir: sort.key === key ? sort.dir : null, onToggle: () => toggle(key) });

  return { sort, sortOf };
}
