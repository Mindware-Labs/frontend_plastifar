import { Suspense, lazy } from "react";
import { Spinner } from "./Spinner";

// BlockNote pesa mas que el resto del panel: se descarga al abrir el editor, no al entrar.
const BlockEditor = lazy(() => import("./BlockEditor"));

interface LazyBlockEditorProps {
  initialContent?: unknown;
  onChange: (blocks: unknown) => void;
  placeholder?: string;
}

export function LazyBlockEditor(props: LazyBlockEditorProps) {
  return (
    <Suspense
      fallback={
        <div className="flex h-full items-center justify-center">
          <Spinner />
        </div>
      }
    >
      <BlockEditor {...props} />
    </Suspense>
  );
}
