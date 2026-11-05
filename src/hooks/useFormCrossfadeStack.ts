import { useEffect, useRef, useState } from "react";
import { prefersReducedMotion } from "./motion";

export type FormCrossfadeLayer = { key: string; role: "enter" | "exit" };

export const FORM_CROSSFADE_DURATION_MS = 260;

export function useFormCrossfadeStack(activeKey: string, enabled: boolean): FormCrossfadeLayer[] {
  const [layers, setLayers] = useState<FormCrossfadeLayer[]>([{ key: activeKey, role: "enter" }]);
  const prevKeyRef = useRef(activeKey);

  useEffect(() => {
    if (!enabled || prefersReducedMotion()) {
      setLayers([{ key: activeKey, role: "enter" }]);
      prevKeyRef.current = activeKey;
      return;
    }

    if (prevKeyRef.current === activeKey) return;

    const exitingKey = prevKeyRef.current;
    prevKeyRef.current = activeKey;

    setLayers([
      { key: exitingKey, role: "exit" },
      { key: activeKey, role: "enter" },
    ]);

    const timer = window.setTimeout(() => {
      setLayers([{ key: activeKey, role: "enter" }]);
    }, FORM_CROSSFADE_DURATION_MS);

    return () => window.clearTimeout(timer);
  }, [activeKey, enabled]);

  return layers;
}

export function formCrossfadeLayerClass(
  role: FormCrossfadeLayer["role"],
  direction: "forward" | "backward",
): string {
  if (role === "enter") {
    return direction === "forward"
      ? "animate-plf-form-cross-in-forward motion-reduce:animate-none"
      : "animate-plf-form-cross-in-backward motion-reduce:animate-none";
  }
  return direction === "forward"
    ? "animate-plf-form-cross-out-forward motion-reduce:animate-none"
    : "animate-plf-form-cross-out-backward motion-reduce:animate-none";
}
