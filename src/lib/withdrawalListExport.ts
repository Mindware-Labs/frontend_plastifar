import type { WithdrawalSummary } from "../types/withdrawals";
import { formatDay } from "./dates";
import { formatAmountOrPlain } from "./numbers";
import { exportPlastifarListToExcel, exportPlastifarListToPdf, type PlastifarListReportOptions } from "./plastifarListReport";
import { WITHDRAWAL_FORM_CONTROL } from "./withdrawals";

const HEADERS = [
  "Número",
  "Ticket",
  "Cliente",
  "Fecha",
  "Motivo",
  "Vendedor",
  "Moneda",
  "Valor total",
  "Estado",
] as const;

const COL_WEIGHTS = [22, 22, 34, 18, 26, 28, 12, 22, 22];
const AMOUNT_COL = 7;

function filenameStem(): string {
  return `Retiros_Plastifar_${new Date().toISOString().slice(0, 10).replace(/-/g, "")}`;
}

function rowValues(item: WithdrawalSummary): string[] {
  return [
    item.number,
    item.ticketNumber,
    item.clientName,
    formatDay(item.requestDate),
    item.reason,
    item.requestedByName,
    item.currency ?? "—",
    formatAmountOrPlain(item.totalValue, item.currency),
    item.status,
  ];
}

function options(): PlastifarListReportOptions<WithdrawalSummary> {
  return {
    reportTitle: "REPORTE DE SOLICITUDES DE RETIRO DE MERCANCÍA",
    formCode: WITHDRAWAL_FORM_CONTROL.code,
    formRevision: WITHDRAWAL_FORM_CONTROL.revision,
    filenameStem: filenameStem(),
    worksheetName: "Retiros",
    listBandTitle: "Listado de solicitudes",
    headers: HEADERS,
    colWeights: COL_WEIGHTS,
    rightAlignColumns: [AMOUNT_COL],
    amountColumnIndex: AMOUNT_COL,
    getRowValues: rowValues,
    getAmountValue: (item) => item.totalValue,
  };
}

export function exportWithdrawalsListToExcel(items: WithdrawalSummary[]): Promise<void> {
  return exportPlastifarListToExcel(items, options());
}

export function exportWithdrawalsListToPdf(items: WithdrawalSummary[]): Promise<void> {
  return exportPlastifarListToPdf(items, options());
}
