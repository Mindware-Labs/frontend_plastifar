import type { Priority, SlaPolicy, SlaPolicyType } from "../types/settings";
import { humanizeMinutes, workdayMinutes } from "./sla";

const PRIORITY_RANK: Record<Priority, number> = {
  Emergencia: 0,
  Alta: 1,
  Normal: 2,
  Baja: 3,
};

export function sortSlaPolicies(policies: SlaPolicy[]): SlaPolicy[] {
  return [...policies].sort((a, b) => {
    const byPriority = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
    if (byPriority !== 0) return byPriority;
    if (a.isDefault !== b.isDefault) return a.isDefault ? -1 : 1;
    return a.name.localeCompare(b.name, "es");
  });
}

export function slaPolicyPlazoLabel(policy: SlaPolicy): string {
  const perDay = workdayMinutes(policy);
  const plazo = humanizeMinutes(policy.resolutionMinutes, perDay);
  return policy.businessHoursOnly ? `${plazo} · horario laboral` : `${plazo} · 24/7`;
}

/** Política que mejor representa la prioridad del ticket (p. ej. al mostrar el SLA inicial). */
export function resolveSlaPolicyIdForPriority(policies: SlaPolicy[], priority: string): string {
  const ranked = sortSlaPolicies(policies);
  const match =
    ranked.find((p) => p.priority === priority && p.isDefault) ??
    ranked.find((p) => p.priority === priority);
  return match ? String(match.id) : pickDefaultSlaPolicyId(ranked);
}

export function pickDefaultSlaPolicyId(policies: SlaPolicy[]): string {
  if (policies.length === 0) return "";
  const normalDefault = policies.find((p) => p.isDefault && p.priority === "Normal");
  if (normalDefault) return String(normalDefault.id);
  const anyDefault = policies.find((p) => p.isDefault);
  if (anyDefault) return String(anyDefault.id);
  return String(sortSlaPolicies(policies)[0]!.id);
}

export function findSlaPolicyById(policies: SlaPolicy[], id: string): SlaPolicy | undefined {
  if (!id) return undefined;
  const num = Number(id);
  if (!Number.isFinite(num)) return undefined;
  return policies.find((p) => p.id === num);
}

export function filterSlaPolicies(
  policies: SlaPolicy[],
  term: string,
  options?: { alwaysIncludeId?: string },
): SlaPolicy[] {
  const q = term.trim().toLowerCase();
  if (!q) return policies;
  const pinned = options?.alwaysIncludeId;
  return policies.filter((policy) => {
    if (pinned && String(policy.id) === pinned) return true;
    const haystack = [
      policy.name,
      policy.priority,
      slaPolicyPlazoLabel(policy),
      policy.isDefault ? "predeterminada" : "",
    ]
      .join(" ")
      .toLowerCase();
    return haystack.includes(q);
  });
}

export type SlaPickerKind = SlaPolicyType;
