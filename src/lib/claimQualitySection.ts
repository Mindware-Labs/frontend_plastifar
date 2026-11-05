import type { CustomerClaim } from "../types/claims";

export type ClaimQualitySectionStatus = CustomerClaim["qualitySectionStatus"];

export function getClaimQualitySectionLabel(status: ClaimQualitySectionStatus): string {
  switch (status) {
    case "waived":
      return "Calidad: no requerida";
    case "pending":
      return "Calidad: pendiente";
    case "in_progress":
      return "Calidad: en progreso";
    case "complete":
      return "Calidad: completa";
    default:
      return "Calidad";
  }
}

export function claimQualitySectionTone(
  status: ClaimQualitySectionStatus,
): "neutral" | "amber" | "emerald" | "slate" {
  switch (status) {
    case "waived":
      return "slate";
    case "pending":
      return "amber";
    case "in_progress":
      return "amber";
    case "complete":
      return "emerald";
    default:
      return "neutral";
  }
}
