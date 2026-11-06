export interface ValidationItem {
  id: string;
  label: string;
  short: string;
}

export function buildValidationItems(
  checks: Array<{ id: string; label: string; short?: string; valid: boolean }>,
): ValidationItem[] {
  return checks
    .filter((check) => !check.valid)
    .map(({ id, label, short }) => ({
      id,
      label,
      short: short ?? label,
    }));
}

export function focusFormField(fieldId: string) {
  const el = document.getElementById(fieldId);
  if (!(el instanceof HTMLElement)) return;
  el.focus();
  el.scrollIntoView({ block: "nearest", behavior: "smooth" });
}

