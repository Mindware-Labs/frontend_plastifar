import { createContext, useCallback, useRef, useState, type ReactNode } from "react";

export interface ReceiptAction {
  label: string;
  run: () => Promise<unknown> | void;
}

export interface Receipt {
  id: number;
  /** Clave de fusion: "archivar" nunca se funde con "papelera". */
  action: string;
  kind: "done" | "failed";
  /** El hecho, en pasado. Nunca se trunca. */
  title: string;
  /** El objeto sobre el que se hizo. Se trunca. */
  detail?: string;
  /** Solo en los que se pueden compensar; al fundirse se retira, porque solo revierte el ultimo. */
  action2?: ReceiptAction;
  count: number;
}

interface ReceiptInput {
  action: string;
  title: string;
  detail?: string;
  undo?: ReceiptAction;
}

interface ReceiptsValue {
  receipts: Receipt[];
  done: (input: ReceiptInput) => void;
  failed: (input: ReceiptInput) => void;
  dismiss: (id: number) => void;
  /** Alto que otra barra reserva abajo a la derecha, para que el recibo no la tape. */
  inset: number;
  reserveInset: (px: number) => () => void;
}

/** Dos acciones iguales seguidas se cuentan en un solo recibo en vez de apilar torres. */
const MERGE_WINDOW = 6000;

export const ReceiptContext = createContext<ReceiptsValue>({
  receipts: [],
  done: () => undefined,
  failed: () => undefined,
  dismiss: () => undefined,
  inset: 0,
  reserveInset: () => () => undefined,
});

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
