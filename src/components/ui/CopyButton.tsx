import { Check, Copy } from "lucide-react";
import { useState } from "react";

const baseClass =
  "inline-flex h-5 w-5 items-center justify-center rounded text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition-colors";

interface CopyButtonProps {
  text: string;
  label?: string;
  /** Clases que se suman al final de las base (p. ej. "cursor-pointer"). */
  className?: string;
}

/** Copia el texto al portapapeles y muestra un check durante 1,5 s. */
export function CopyButton({ text, label = "Copiar", className }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      type="button"
      title={label}
      onClick={(e) => {
        e.stopPropagation();
        void navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className={className ? `${baseClass} ${className}` : baseClass}
    >
      {copied ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
    </button>
  );
}
