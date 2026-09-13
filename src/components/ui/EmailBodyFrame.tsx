import DOMPurify from "dompurify";
import { useMemo } from "react";

interface EmailBodyFrameProps {
  html: string;
  title: string;
  className?: string;
  /** Alto estimado a partir del contenido, para tarjetas donde el marco no puede medirse. */
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
  "body{margin:0;font-family:system-ui,sans-serif;font-size:14px;color:#1B1B1D;word-break:break-word}img{max-width:100%}";

function buildDocument(clean: string): string {
  return (
    `<!doctype html><html><head><meta charset="utf-8">` +
    `<meta http-equiv="Content-Security-Policy" content="${FRAME_CSP}">` +
    `<base target="_blank"><style>${FRAME_STYLE}</style></head><body>${clean}</body></html>`
  );
}

/** Sin scripts ni acceso al DOM no hay como medir: se estima por bloques y largo del texto. */
function estimateHeight(clean: string): number {
  const blocks = (clean.match(/<(p|br|div|li|tr|h[1-6]|blockquote)\b/gi) ?? []).length;
  const text = clean.replace(/<[^>]*>/g, "");
  const lines = Math.max(blocks, Math.ceil(text.length / 90), 1);
  return Math.min(640, Math.max(64, lines * 22 + 32));
}

/** Marco aislado con CSP y sandbox para renderizado seguro de HTML externo. */
export function EmailBodyFrame({ html, title, className = "", fit = false }: EmailBodyFrameProps) {
  const clean = useMemo(() => DOMPurify.sanitize(html, SANITIZE_OPTIONS), [html]);
  const srcDoc = useMemo(() => buildDocument(clean), [clean]);
  const height = fit ? estimateHeight(clean) : undefined;

  return (
    <iframe
      sandbox="allow-popups allow-popups-to-escape-sandbox"
      referrerPolicy="no-referrer"
      srcDoc={srcDoc}
      title={title}
      style={height !== undefined ? { height } : undefined}
      className={`w-full border-0 bg-white ${className}`}
    />
  );
}
