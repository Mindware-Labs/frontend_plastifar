import type { LucideIcon } from "lucide-react";

export type EnterpriseFormType = "reclamacion" | "retiro" | "discrepancia" | "hca";

export interface CommonExtractedData {
  invoiceRef: string;
  description: string;
  lines: Array<{
    productId: string;
    quantity: string;
    unitPrice: string;
    productName?: string;
  }>;
}

/** Formulario ya registrado en el ticket, tal como lo lista la barra de sub-pestanas. */
export interface RegisteredForm {
  key: string;
  type: EnterpriseFormType;
  code: string;
  title: string;
  badgeText: string;
  data: any;
}

/** Formato que se puede iniciar desde el ticket. */
export interface AvailableForm {
  key: string;
  code: string;
  codeColor: string;
  title: string;
  description: string;
  dept: string;
  icon: LucideIcon;
  btnLabel: string;
  disabled: boolean;
  action: () => void;
}

/** Origen de una migracion entre formularios. */
export interface MigrationSource {
  type: EnterpriseFormType;
  label: string;
  data: CommonExtractedData;
}
