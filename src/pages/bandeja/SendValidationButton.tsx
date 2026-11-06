import { Send } from "lucide-react";
import { SubmitValidationButton } from "../../components/app/SubmitValidationButton";
import type { ValidationItem } from "../../lib/validationItems";

interface SendValidationButtonProps {
  ready: boolean;
  sending?: boolean;
  missingItems: ValidationItem[];
  onSend: () => void;
  onFocusField?: (fieldId: string) => void;
  size?: "sm" | "md";
  className?: string;
}

export function SendValidationButton({
  ready,
  sending = false,
  missingItems,
  onSend,
  onFocusField,
  size,
  className = "",
}: SendValidationButtonProps) {
  return (
    <SubmitValidationButton
      appearance="send"
      size={size}
      ready={ready}
      busy={sending}
      missingItems={missingItems}
      onSubmit={onSend}
      onFocusField={onFocusField}
      sendIcon={<Send className="h-[14px] w-[14px]" />}
      sendLabel="Enviar"
      blockTitle="No se puede enviar"
      hintText="Para poder enviar el correo, completa los siguientes requisitos:"
      shortcutLabel="Ctrl + ↵"
      className={className}
    >
      Enviar
    </SubmitValidationButton>
  );
}
