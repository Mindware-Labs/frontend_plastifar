import { parseTemplateString } from "./cannedTemplateParts";
import { CannedVariableToken } from "./CannedVariableToken";

/** Párrafo o línea con variables renderizadas como chips. */
export function CannedTemplateInline({ value, size = "sm" }: { value: string; size?: "sm" | "md" }) {
  const parts = parseTemplateString(value);

  return (
    <>
      {parts.map((part, index) =>
        part.kind === "text" ? (
          <span key={`t-${index}`} className="whitespace-pre-wrap">
            {part.text}
          </span>
        ) : (
          <span key={`v-${index}`} className="mx-0.5 inline-flex align-baseline">
            <CannedVariableToken variableKey={part.key} readOnly size={size} />
          </span>
        ),
      )}
    </>
  );
}
