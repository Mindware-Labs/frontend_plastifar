import { useCallback, useRef, useState, type ReactNode } from "react";
import { ReceiptContext, type Receipt, type ReceiptInput } from "./useReceipts";

/** Dos acciones iguales seguidas se cuentan en un solo recibo en vez de apilar torres. */
const MERGE_WINDOW = 6000;

export function ReceiptProvider({ children }: { children: ReactNode }) {
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [inset, setInset] = useState(0);
  const nextId = useRef(1);
  const lastAt = useRef(new Map<string, number>());

  const dismiss = useCallback((id: number) => {
    setReceipts((current) => current.filter((receipt) => receipt.id !== id));
  }, []);

  const push = useCallback((kind: Receipt["kind"], input: ReceiptInput) => {
    const now = performance.now();
    const key = `${input.action}:${kind}`;
    const previous = lastAt.current.get(key) ?? 0;
    lastAt.current.set(key, now);

    setReceipts((current) => {
      // Los fallos no se funden: cada uno es un caso distinto con su propio destinatario.
      const twin =
        kind === "done" && now - previous < MERGE_WINDOW
          ? current.find((receipt) => receipt.action === input.action && receipt.kind === kind)
          : undefined;

      if (twin) {
        return current.map((receipt) =>
          receipt.id === twin.id
            ? // Sin accion al fundirse: revertir solo el ultimo de tres seria mentir.
              { ...receipt, count: receipt.count + 1, detail: undefined, action2: undefined }
            : receipt,
        );
      }

      const receipt: Receipt = {
        id: nextId.current++,
        action: input.action,
        kind,
        title: input.title,
        detail: input.detail,
        action2: input.undo,
        count: 1,
      };

      // Uno a la vez de los que se van solos; los fallos se quedan hasta que alguien los lea.
      const kept = current.filter((item) => item.kind === "failed").slice(-2);
      return [...kept, receipt];
    });
  }, []);

  const done = useCallback((input: ReceiptInput) => push("done", input), [push]);
  const failed = useCallback((input: ReceiptInput) => push("failed", input), [push]);

  /** Quien tapa, aparta: el editor reserva su alto al montarse y lo suelta al cerrarse. */
  const reserveInset = useCallback((px: number) => {
    setInset(px);
    return () => setInset(0);
  }, []);

  return (
    <ReceiptContext.Provider value={{ receipts, done, failed, dismiss, inset, reserveInset }}>
      {children}
    </ReceiptContext.Provider>
  );
}
