import { ApiError } from "../../api/client";

/**
 * Unico lugar del modulo de Clientes donde el TEXTO de un error del servidor
 * decide a que campo va su mensaje.
 *
 * La seccion 4.2 exige que un error de campo se marque en su campo y le
 * devuelva el foco, y los 400 y 409 de ClientsController y ContactsController
 * son especificos —«El territorio no existe», «El vendedor no existe o no esta
 * activo», «El correo no es valido»—, pero viajan solo como `{ message }`: no
 * hay un codigo de campo que leer.
 *
 * Por eso la correspondencia se hace buscando palabras en el mensaje, y por eso
 * vive aqui y no repartida por los dialogos: asi el acoplamiento a la
 * redaccion exacta del servidor se ve de un vistazo y se cambia en un sitio.
 * Renombrar «RNC» a «Registro Nacional» rompe el foco sin avisar; el arreglo de
 * verdad es que el servidor devuelva un codigo de campo junto al mensaje, y
 * cuando exista este archivo se reduce a leerlo.
 */
export interface FieldRule<TField extends string> {
  field: TField;
  /** Palabras, ya sin acentos y en minuscula, que apuntan a ese campo. */
  matches: string[];
}

/** Sin acentos y en minuscula: el servidor tilda y el navegador no debe depender de ello. */
function normalize(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

/**
 * Devuelve el campo al que pertenece el error y su mensaje, o null cuando no es
 * un error de campo reconocible —entonces corresponde el aviso general del
 * dialogo—. Gana la primera regla que coincide, asi que van de la mas
 * especifica a la mas general.
 */
export function fieldForServerError<TField extends string>(
  error: unknown,
  rules: FieldRule<TField>[],
): { field: TField; message: string } | null {
  // 400 dato invalido y 409 duplicado son los dos que hablan de un campo
  // concreto; 401, 403, 404 y 429 son de la peticion, no del formulario.
  if (!(error instanceof ApiError) || (error.status !== 400 && error.status !== 409)) return null;

  const message = normalize(error.message);
  const rule = rules.find((entry) => entry.matches.some((word) => message.includes(word)));

  return rule ? { field: rule.field, message: error.message } : null;
}
