import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate, type NavigateFunction } from "react-router-dom";

/*
 * Estado de un listado (filtros, busqueda, pagina) reflejado en la URL.
 *
 * Volver atras desde un detalle devolvia el listado a cero: pagina 1, sin
 * filtros, sin busqueda. Con el estado en la URL el boton «atras» lo restaura y
 * el enlace se puede compartir tal cual.
 *
 * El estado vive en React y la URL lo sigue con `replace`: escribir en la URL
 * en cada tecla llenaria el historial y haria que el input dependiera de una
 * navegacion. Varias escrituras en el mismo tick se juntan en una sola
 * navegacion; si no, la ultima pisaria a las demas.
 */

const pending = new Map<string, string | null>();
let target: { navigate: NavigateFunction; pathname: string } | null = null;

function scheduleWrite(navigate: NavigateFunction, pathname: string, key: string, value: string | null) {
  pending.set(key, value);
  const alreadyScheduled = target !== null;
  target = { navigate, pathname };
  if (alreadyScheduled) return;

  queueMicrotask(() => {
    const { navigate: go, pathname: path } = target!;
    target = null;
    const writes = [...pending];
    pending.clear();

    // Si entretanto se navego a otra pantalla, esos valores ya no aplican.
    if (window.location.pathname !== path) return;

    const params = new URLSearchParams(window.location.search);
    for (const [name, next] of writes) {
      if (next === null) params.delete(name);
      else params.set(name, next);
    }
    const search = params.toString() ? `?${params.toString()}` : "";
    if (search === window.location.search) return;
    go({ pathname: path, search, hash: window.location.hash }, { replace: true });
  });
}

interface Codec<T> {
  parse: (raw: string) => T | undefined;
  serialize: (value: T) => string;
}

function useUrlValue<T>(key: string | undefined, fallback: T, codec: Codec<T>) {
  const location = useLocation();
  const navigate = useNavigate();

  const read = (search: string): T => {
    if (key === undefined) return fallback;
    const raw = new URLSearchParams(search).get(key);
    if (raw === null) return fallback;
    return codec.parse(raw) ?? fallback;
  };

  const [value, setValue] = useState<T>(() => read(location.search));

  // Una navegacion ajena (atras/adelante, un enlace a la misma pantalla con
  // otros parametros) manda sobre el estado. Las escrituras propias dejan la
  // URL igual al estado, asi que no lo tocan.
  const [seenKey, setSeenKey] = useState(location.key);
  if (location.key !== seenKey) {
    setSeenKey(location.key);
    if (key !== undefined && !pending.has(key)) {
      // Lo que esta en la URL tal cual es lo que este hook escribio: se respeta
      // aunque `parse` no lo admita al leer (un filtro que no se restaura al
      // recargar, pero que mientras tanto si esta activo).
      const raw = new URLSearchParams(location.search).get(key);
      const ownValue = codec.serialize(value);
      const isOwn = raw === null ? ownValue === codec.serialize(fallback) : raw === ownValue;
      if (!isOwn) {
        const fromUrl = read(location.search);
        if (codec.serialize(fromUrl) !== ownValue) setValue(fromUrl);
      }
    }
  }

  const codecRef = useRef(codec);
  const fallbackRef = useRef(fallback);
  useEffect(() => {
    codecRef.current = codec;
    fallbackRef.current = fallback;
  });

  const serialized = codec.serialize(value);
  useEffect(() => {
    if (key === undefined) return;
    const isDefault = serialized === codecRef.current.serialize(fallbackRef.current);
    scheduleWrite(navigate, window.location.pathname, key, isDefault ? null : serialized);
  }, [key, serialized, navigate]);

  return [value, setValue] as const;
}

const stringCodec: Codec<string> = { parse: (raw) => raw, serialize: (value) => value };

const numberCodec: Codec<number> = {
  parse: (raw) => {
    const value = Number(raw);
    return Number.isInteger(value) && value > 0 ? value : undefined;
  },
  serialize: (value) => String(value),
};

const listCodec: Codec<string[]> = {
  parse: (raw) => (raw === "" ? [] : raw.split(",")),
  serialize: (value) => value.join(","),
};

/**
 * Filtro de texto o de opcion en `?key=`. Con `allowed`, un valor desconocido
 * en la URL (un enlace viejo, uno editado a mano) cae al valor por defecto.
 * El tipo sale de `allowed` (o del generico); sin ninguno de los dos es string.
 */
export function useUrlState<T extends string = string>(
  key: string,
  fallback: NoInfer<T>,
  allowed?: readonly T[],
) {
  const codec = stringCodec as unknown as Codec<T>;
  return useUrlValue<T>(key, fallback, {
    parse: (raw) => (allowed === undefined || allowed.includes(raw as T) ? (raw as T) : undefined),
    serialize: codec.serialize,
  });
}

/**
 * Entero positivo en `?key=` (pagina, tamaño de pagina). Sin `key`, estado
 * normal. Con `allowed`, cualquier otro valor (salvo el de por defecto) cae al
 * de por defecto: un `?tam=100000` editado a mano no llega al servidor.
 */
export function useUrlNumber(key: string | undefined, fallback: number, allowed?: readonly number[]) {
  return useUrlValue<number>(key, fallback, {
    parse: (raw) => {
      const value = numberCodec.parse(raw);
      return value === undefined || allowed === undefined || value === fallback || allowed.includes(value)
        ? value
        : undefined;
    },
    serialize: numberCodec.serialize,
  });
}

/** Seleccion multiple en `?key=a,b,c`. */
export function useUrlList(key: string, fallback: string[] = []) {
  return useUrlValue<string[]>(key, fallback, listCodec);
}
