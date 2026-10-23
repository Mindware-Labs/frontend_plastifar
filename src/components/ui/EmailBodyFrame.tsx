import DOMPurify from "dompurify";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

interface EmailBodyFrameProps {
  html: string;
  title: string;
  className?: string;
  /** Ajusta la altura del marco al tamaño exacto de su contenido */
  fit?: boolean;
}

const SANITIZE_OPTIONS = {
  FORBID_TAGS: ["script", "meta", "base", "form", "iframe", "object", "embed", "link"],
  ADD_ATTR: ["target"],
};

// img-src https: se queda porque las imagenes cid: llegan ya cambiadas por enlaces firmados https del bucket.
const FRAME_CSP =
  "default-src 'none'; img-src data: https:; style-src 'unsafe-inline'";

const FRAME_STYLE =
  "body{margin:0;padding:0;overflow:hidden;font-family:system-ui,sans-serif;font-size:13.5px;line-height:1.6;color:#1B1B1D;word-break:break-word}img{max-width:100%}";

function buildDocument(clean: string): string {
  return (
    `<!doctype html><html><head><meta charset="utf-8">` +
    `<meta http-equiv="Content-Security-Policy" content="${FRAME_CSP}">` +
    `<base target="_blank"><style>${FRAME_STYLE}</style></head><body>${clean}</body></html>`
  );
}

/** Fallback en caso de que el iframe tarde en cargar o falle la medición */
function estimateInitialHeight(clean: string): number {
  const text = clean.replace(/<[^>]*>/g, "").trim();
  if (!text) return 32;
  const blocks = (clean.match(/<(p|br|div|li|tr|h[1-6]|blockquote)\b/gi) ?? []).length;
  // Promedio ~110 caracteres por línea en desktop
  const lines = Math.max(blocks, Math.ceil(text.length / 110), 1);
  return Math.min(800, Math.max(28, lines * 22 + 8));
}

/** Marco aislado con CSP y sandbox para renderizado seguro de HTML externo. */
export function EmailBodyFrame({ html, title, className = "", fit = false }: EmailBodyFrameProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const clean = useMemo(() => DOMPurify.sanitize(html, SANITIZE_OPTIONS), [html]);
  const srcDoc = useMemo(() => buildDocument(clean), [clean]);

  const [measuredHeight, setMeasuredHeight] = useState<number>(() =>
    fit ? estimateInitialHeight(clean) : 0
  );

  const measureHeight = useCallback(() => {
    if (!fit || !iframeRef.current) return;
    try {
      const doc = iframeRef.current.contentDocument || iframeRef.current.contentWindow?.document;
      if (!doc || !doc.body) return;

      const scrollH = doc.documentElement?.scrollHeight || doc.body.scrollHeight || 0;
      const offsetH = doc.documentElement?.offsetHeight || doc.body.offsetHeight || 0;
      const actualHeight = Math.max(scrollH, offsetH);

      if (actualHeight > 0) {
        setMeasuredHeight(actualHeight);
      }
    } catch {
      // Si por política del navegador no se puede acceder al contentDocument, queda con la estimación.
    }
  }, [fit]);

  useEffect(() => {
    if (!fit) return;
    // Reestimar cuando el HTML cambie
    setMeasuredHeight(estimateInitialHeight(clean));

    // Múltiples intentos tras montar para asegurar que las fuentes/imágenes se asienten
    const t1 = setTimeout(measureHeight, 50);
    const t2 = setTimeout(measureHeight, 200);
    const t3 = setTimeout(measureHeight, 600);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [clean, fit, measureHeight]);

  return (
    <iframe
      ref={iframeRef}
      sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox"
      referrerPolicy="no-referrer"
      srcDoc={srcDoc}
      title={title}
      onLoad={measureHeight}
      style={fit && measuredHeight > 0 ? { height: `${measuredHeight}px` } : undefined}
      className={`w-full border-0 bg-white transition-[height] duration-150 ${className}`}
    />
  );
}
