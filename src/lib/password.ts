import { z } from "zod";

/**
 * Reglas de contrasena del panel. Unica fuente de verdad del frontend: la usan
 * el formulario de restablecer, el de cambiar contrasena y el medidor de fuerza.
 *
 * Espejo de api/Services/PasswordPolicy.cs — si cambia una, cambia la otra.
 */
export interface PasswordRule {
  id: string;
  label: string;
  test: (value: string) => boolean;
}

export const PASSWORD_MAX_LENGTH = 128;

export const PASSWORD_RULES: PasswordRule[] = [
  {
    id: "case",
    label: "Mayúsculas y minúsculas",
    test: (value) => /[a-z]/.test(value) && /[A-Z]/.test(value),
  },
  { id: "number", label: "Al menos un número (0–9)", test: (value) => /[0-9]/.test(value) },
  {
    id: "special",
    label: "Un carácter especial",
    test: (value) => /[^A-Za-z0-9]/.test(value),
  },
  { id: "length", label: "Al menos 8 caracteres", test: (value) => value.length >= 8 },
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
