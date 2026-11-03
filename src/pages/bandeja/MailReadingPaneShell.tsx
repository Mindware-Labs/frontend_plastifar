import type { ReactNode } from "react";

interface MailReadingPaneShellProps {
  children: ReactNode;
}

/** Panel derecho de bandeja: misma entrada elástica que ficha de ticket. */
export function MailReadingPaneShell({ children }: MailReadingPaneShellProps) {
  return (
    <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden animate-plf-receipt-in">
      {children}
    </div>
  );
}
