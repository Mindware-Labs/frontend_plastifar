import type { FieldValues, Path, UseFormSetError, UseFormSetFocus } from "react-hook-form";
import { ApiError } from "../api/client";

/**
 * A que campo va un error del servidor. Sin `startsWith`, cualquier mensaje con
 * uno de los estados admitidos va a ese campo (el 409 de un nombre repetido).
 */
export interface ServerErrorRule<TField extends string> {
  field: TField;
  /** Comienzo del mensaje, en minuscula. */
  startsWith?: string;
}

interface ApplyServerErrorOptions<T extends FieldValues> {
  setError: UseFormSetError<T>;
  setFocus?: UseFormSetFocus<T>;
  rules?: ServerErrorRule<Path<T>>[];
  /** Estados que hablan de un campo; los demas son de la peticion. */
  statuses?: number[];
  /** Solo los campos registrados con ref; los de Controller no reciben foco. */
  focusable?: Path<T>[];
  /** Mensaje cuando el fallo no viene del API (red caida, excepcion). */
  fallback: string;
}

/**
 * Lleva el error de un guardado a su campo cuando es de un campo, y si no
 * devuelve el mensaje para el aviso general del formulario.
 *
 * @returns null si el error quedo en un campo; el mensaje general si no.
 */
export function applyServerError<T extends FieldValues>(
  err: unknown,
  { setError, setFocus, rules = [], statuses = [400, 409], focusable = [], fallback }: ApplyServerErrorOptions<T>,
): string | null {
  if (!(err instanceof ApiError)) return fallback;

  if (statuses.includes(err.status)) {
    const message = err.message.trim().toLowerCase();
    const field = rules.find(({ startsWith }) => startsWith === undefined || message.startsWith(startsWith))?.field;
    if (field) {
      setError(field, { message: err.message });
      if (setFocus && focusable.includes(field)) setFocus(field);
      return null;
    }
  }

  return err.message;
}
