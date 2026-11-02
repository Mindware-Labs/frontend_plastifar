import type { ReactNode } from "react";
import { AppleMotionBlock } from "../../components/ui/AppleMotionBlock";
import type { AppleListPhase } from "../../hooks/useAppleListMotion";

interface ComposerFieldMotionRowProps {
  open: boolean;
  phase: AppleListPhase;
  children: ReactNode;
}

export function ComposerFieldMotionRow({ open, phase, children }: ComposerFieldMotionRowProps) {
  if (!open) return null;

  return (
    <AppleMotionBlock phase={phase} rowPreset="composer" className="shrink-0">
      <div className="flex shrink-0 items-center gap-3 border-b border-zinc-100 px-4 py-1.5 transition-colors focus-within:bg-zinc-50/50">
        {children}
      </div>
    </AppleMotionBlock>
  );
}
