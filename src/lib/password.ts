import { z } from "zod";

/** Reglas de validación y fortaleza de contraseñas compartidas. */
export interface PasswordRule {
  id: string;
  label: string;
  test: (value: string) => boolean;
}

const PASSWORD_MIN_LENGTH = 8;
/** Lo exporta el modulo porque el dialogo de cambio de contrasena lo
    muestra en su mensaje de error: el limite se dice una sola vez. */
export const PASSWORD_MAX_LENGTH = 128;

export const PASSWORD_RULES: PasswordRule[] = [
  {
    id: "case",
    label: "Mayúsculas y minúsculas",
    test: (value) => /\p{Lu}/u.test(value) && /\p{Ll}/u.test(value),
  },
  { id: "number", label: "Al menos un número (0–9)", test: (value) => /\p{Nd}/u.test(value) },
  {
    id: "special",
    label: "Un carácter especial",
    // Igual que el backend: cualquier caracter que no sea letra ni digito, espacios incluidos.
    test: (value) => /[^\p{L}\p{N}]/u.test(value),
  },
  {
    id: "length",
    label: `Al menos ${PASSWORD_MIN_LENGTH} caracteres`,
    test: (value) => value.length >= PASSWORD_MIN_LENGTH && value.length <= PASSWORD_MAX_LENGTH,
  },
];

export type StrengthLevel = "weak" | "average" | "strong";

/**
 * Cuantas reglas se cumplen decide el tramo; la escala es el ancho de la barra.
 *
 * La puerta es binaria: el formulario no deja enviar hasta cumplir las cuatro
 * reglas. Por eso el tramo intermedio no dice "Media" —una palabra que suena a
 * aceptable— sino "Incompleta", en ambar, que es el color que este sistema usa
 * para "todavia no". Solo el tramo que el servidor aceptaria dice "Válida".
 */
const STRENGTH_LEVELS: { max: number; scale: number; level: StrengthLevel; label: string }[] = [
  { max: 1, scale: 0.15, level: "weak", label: "Débil" },
  { max: 3, scale: 0.6, level: "average", label: "Incompleta" },
  { max: 4, scale: 1, level: "strong", label: "Válida" },
];

export function evaluatePassword(value: string) {
  const rules = PASSWORD_RULES.map((rule) => ({ ...rule, met: rule.test(value) }));
  const score = rules.filter((rule) => rule.met).length;
  const tier = STRENGTH_LEVELS.find((level) => score <= level.max) ?? STRENGTH_LEVELS[STRENGTH_LEVELS.length - 1];

  return { rules, score, tier, isValid: score === PASSWORD_RULES.length };
}

/** Validacion para react-hook-form: el detalle lo explica la lista de requisitos. */
export const passwordSchema = z
  .string()
  .max(PASSWORD_MAX_LENGTH, `Máximo ${PASSWORD_MAX_LENGTH} caracteres`)
  .refine((value) => PASSWORD_RULES.every((rule) => rule.test(value)), {
    message: "Aún falta cumplir algún requisito",
  });
