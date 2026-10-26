import { useNoticeInset } from "../../context/useReceipts";

/** Su unico trabajo es existir: mientras el editor este abierto, el recibo se corre hacia arriba. */
export function ComposerInset() {
  useNoticeInset(44);
  return null;
}
