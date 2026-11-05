import type { ReactNode } from "react";
import { formCrossfadeLayerClass, useFormCrossfadeStack } from "../../hooks/useFormCrossfadeStack";
import type { RegisteredFormItem } from "./TicketFormsTab";

interface RegisteredFormCrossfadeShellProps {
  activeKey: string;
  direction: "forward" | "backward";
  enabled: boolean;
  forms: RegisteredFormItem[];
  children: (form: RegisteredFormItem) => ReactNode;
}

/** Dos capas superpuestas: la saliente y la entrante se funden a la vez (sin flash a blanco). */
export function RegisteredFormCrossfadeShell({
  activeKey,
  direction,
  enabled,
  forms,
  children,
}: RegisteredFormCrossfadeShellProps) {
  const layers = useFormCrossfadeStack(activeKey, enabled);

  return (
    <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-2xs">
      <div className="relative grid [&>*]:col-start-1 [&>*]:row-start-1 [&>*]:min-w-0">
        {layers.map((layer) => {
          const form = forms.find((item) => item.key === layer.key);
          if (!form) return null;
          return (
            <div
              key={`${layer.key}-${layer.role}`}
              className={`p-5 ${formCrossfadeLayerClass(layer.role, direction)} ${layer.role === "exit" ? "pointer-events-none z-0" : "z-[1]"}`}
            >
              {children(form)}
            </div>
          );
        })}
      </div>
    </div>
  );
}
