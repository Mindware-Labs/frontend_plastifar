import type { ValidationItem } from "./validationItems";

/** Formato mínimo a@b.c — alineado con lo que acepta el API de envío. */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function parseRecipientList(raw: string): string[] {
  return raw
    .split(/[,;]/)
    .map((part) => part.trim())
    .filter(Boolean);
}

export function isValidRecipientEmail(email: string): boolean {
  return EMAIL_RE.test(email.trim());
}

export function findInvalidRecipients(raw: string): string[] {
  return parseRecipientList(raw).filter((addr) => !isValidRecipientEmail(addr));
}

export function hasInvalidRecipients(raw: string): boolean {
  const trimmed = raw.trim();
  if (!trimmed) return false;
  return findInvalidRecipients(trimmed).length > 0;
}

export function recipientFieldValidationItems(
  raw: string,
  options: { id: string; emptyLabel: string; emptyShort: string; invalidLabel?: string },
): ValidationItem[] {
  const trimmed = raw.trim();
  if (!trimmed) {
    return [
      {
        id: options.id,
        label: options.emptyLabel,
        short: options.emptyShort,
      },
    ];
  }

  const invalid = findInvalidRecipients(trimmed);
  if (invalid.length === 0) return [];

  if (invalid.length === 1) {
    return [
      {
        id: options.id,
        label: options.invalidLabel ?? `Correo no válido: ${invalid[0]}`,
        short: "un correo con formato válido",
      },
    ];
  }

  return [
    {
      id: options.id,
      label: `${invalid.length} direcciones no válidas`,
      short: "correos con formato válido",
    },
  ];
}

/** CC/CCO: vacío ok; con texto, cada dirección debe ser válida. */
export function optionalRecipientFieldValidationItems(
  raw: string,
  options: { id: string; fieldLabel: string },
): ValidationItem[] {
  const trimmed = raw.trim();
  if (!trimmed) return [];

  const invalid = findInvalidRecipients(trimmed);
  if (invalid.length === 0) return [];

  if (invalid.length === 1) {
    return [
      {
        id: options.id,
        label: `${options.fieldLabel}: correo no válido (${invalid[0]})`,
        short: `un correo válido en ${options.fieldLabel}`,
      },
    ];
  }

  return [
    {
      id: options.id,
      label: `${options.fieldLabel}: ${invalid.length} correos no válidos`,
      short: `correos válidos en ${options.fieldLabel}`,
    },
  ];
}
