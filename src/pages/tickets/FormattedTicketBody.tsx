import React, { useMemo } from "react";

interface FormattedTicketBodyProps {
  text?: string | null;
  html?: string | null;
  className?: string;
}

/**
 * Renderiza el cuerpo de un mensaje o descripción de ticket de forma inteligente:
 * 1. Desenvuelve los saltos de línea suaves (soft line-breaks de ~70 caracteres propios de emails o generadores de texto)
 *    para que la prosa fluya ocupando el 100% del ancho de la tarjeta.
 * 2. Mantiene párrafos separados (doble salto de línea).
 * 3. Formatea listas con viñetas (- , * , • ) o listas numeradas (1. , 2. ).
 * 4. Preserva bloques de firma o despedida cortos.
 * 5. Convierte URLs en enlaces clickeables y soporta **negrita** e *itálica*.
 */
export function FormattedTicketBody({ text, html, className = "" }: FormattedTicketBodyProps) {
  const content = useMemo(() => {
    if (text && text.trim().length > 0) {
      return text;
    }
    if (html && html.trim().length > 0) {
      return html
        .replace(/<br\s*[\/]?>/gi, "\n")
        .replace(/<\/p>/gi, "\n\n")
        .replace(/<[^>]*>?/gm, "");
    }
    return "";
  }, [text, html]);

  const blocks = useMemo(() => {
    const normalized = content.replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();
    if (!normalized) return [];
    return normalized.split(/\n{2,}/);
  }, [content]);

  if (!content.trim()) {
    return null;
  }

  const renderInline = (inlineText: string): React.ReactNode => {
    // Detecta URLs, negritas (**texto**) e itálicas (*texto*)
    const tokens = inlineText.split(/(https?:\/\/[^\s<]+|\*\*[^*]+\*\*|\*[^*]+\*)/g);
    return tokens.map((token, i) => {
      if (/^https?:\/\//i.test(token)) {
        return (
          <a
            key={i}
            href={token}
            target="_blank"
            rel="noopener noreferrer"
            className="break-all text-brand-red underline decoration-brand-red/40 transition-colors hover:decoration-brand-red"
          >
            {token}
          </a>
        );
      }
      if (token.startsWith("**") && token.endsWith("**") && token.length > 4) {
        return (
          <strong key={i} className="font-semibold text-ink">
            {token.slice(2, -2)}
          </strong>
        );
      }
      if (token.startsWith("*") && token.endsWith("*") && token.length > 2) {
        return (
          <em key={i} className="italic text-ink">
            {token.slice(1, -1)}
          </em>
        );
      }
      return token;
    });
  };

  const isBulletLine = (line: string) => /^[-*•–]\s+/.test(line);
  const isNumberedLine = (line: string) => /^\d+[\.\)]\s+/.test(line);
  const isKeyValueLine = (line: string) => /^[A-Za-zÁ-ÿ0-9\s#_-]{2,30}:\s*.+$/.test(line);

  return (
    <div className={`w-full space-y-3 break-words leading-relaxed text-ink ${className}`}>
      {blocks.map((block, bIndex) => {
        const lines = block
          .split("\n")
          .map((l) => l.trim())
          .filter(Boolean);

        if (lines.length === 0) return null;

        // Caso A: Todas las líneas son viñetas
        if (lines.every(isBulletLine)) {
          return (
            <ul key={bIndex} className="my-2 list-disc space-y-1 pl-5">
              {lines.map((l, lIndex) => (
                <li key={lIndex} className="pl-1">
                  {renderInline(l.replace(/^[-*•–]\s+/, ""))}
                </li>
              ))}
            </ul>
          );
        }

        // Caso B: Primera línea encabezado y el resto viñetas
        if (lines.length > 1 && !isBulletLine(lines[0]) && lines.slice(1).every(isBulletLine)) {
          return (
            <div key={bIndex} className="space-y-1.5">
              <p>{renderInline(lines[0])}</p>
              <ul className="list-disc space-y-1 pl-5">
                {lines.slice(1).map((l, lIndex) => (
                  <li key={lIndex} className="pl-1">
                    {renderInline(l.replace(/^[-*•–]\s+/, ""))}
                  </li>
                ))}
              </ul>
            </div>
          );
        }

        // Caso C: Todas las líneas son numeradas
        if (lines.every(isNumberedLine)) {
          return (
            <ol key={bIndex} className="my-2 list-decimal space-y-1 pl-5">
              {lines.map((l, lIndex) => (
                <li key={lIndex} className="pl-1">
                  {renderInline(l.replace(/^\d+[\.\)]\s+/, ""))}
                </li>
              ))}
            </ol>
          );
        }

        // Caso D: Primera línea encabezado y el resto numeradas
        if (lines.length > 1 && !isNumberedLine(lines[0]) && lines.slice(1).every(isNumberedLine)) {
          return (
            <div key={bIndex} className="space-y-1.5">
              <p>{renderInline(lines[0])}</p>
              <ol className="list-decimal space-y-1 pl-5">
                {lines.slice(1).map((l, lIndex) => (
                  <li key={lIndex} className="pl-1">
                    {renderInline(l.replace(/^\d+[\.\)]\s+/, ""))}
                  </li>
                ))}
              </ol>
            </div>
          );
        }

        // Caso E: Formato clave-valor estructurado
        if (lines.length >= 2 && lines.every(isKeyValueLine)) {
          return (
            <div key={bIndex} className="my-1.5 space-y-1">
              {lines.map((l, lIndex) => {
                const colonIdx = l.indexOf(":");
                const key = l.slice(0, colonIdx);
                const val = l.slice(colonIdx + 1);
                return (
                  <div key={lIndex} className="flex flex-wrap items-baseline gap-1.5">
                    <span className="font-semibold text-ink">{key}:</span>
                    <span>{renderInline(val.trim())}</span>
                  </div>
                );
              })}
            </div>
          );
        }

        // Caso F: Bloque de despedida / firma corta intencional (líneas breves, <= 45 caracteres)
        const hasLongLine = lines.some((l) => l.length > 45);
        const isSignatureOrShortBlock =
          !hasLongLine &&
          lines.length <= 4 &&
          (lines[0].endsWith(",") || lines[0].endsWith(":") || lines.length <= 2);

        if (isSignatureOrShortBlock) {
          return (
            <p key={bIndex} className="leading-relaxed">
              {lines.map((l, lIndex) => (
                <React.Fragment key={lIndex}>
                  {lIndex > 0 && <br />}
                  {renderInline(l)}
                </React.Fragment>
              ))}
            </p>
          );
        }

        // Caso G: Prosa continua. Desenvuelve los saltos artificiales para que el texto
        // ocupe fluidamente todo el ancho disponible de la tarjeta.
        const joinedProse = lines.join(" ");
        return (
          <p key={bIndex} className="leading-relaxed">
            {renderInline(joinedProse)}
          </p>
        );
      })}
    </div>
  );
}
