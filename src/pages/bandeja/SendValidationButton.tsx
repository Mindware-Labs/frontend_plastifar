import { Send } from "lucide-react";
import type { ReactNode } from "react";
import { SubmitValidationButton } from "../../components/app/SubmitValidationButton";
import type { ValidationItem } from "../../lib/validationItems";

interface SendValidationButtonProps {
  ready: boolean;
  sending?: boolean;
  missingItems: ValidationItem[];
  onSend: () => void;
  onFocusField?: (fieldId: string) => void;
  label?: string;
  icon?: ReactNode;
  size?: "sm" | "md";
  className?: string;
}

export function SendValidationButton({
  ready,
  sending = false,
  missingItems,
  onSend,
  onFocusField,
  label = "Enviar",
  icon = <Send className="h-[14px] w-[14px]" />,
  className = "",
}: SendValidationButtonProps) {
  return (
    <SubmitValidationButton
      appearance="send"
      ready={ready}
      busy={sending}
      missingItems={missingItems}
      onSubmit={onSend}
      onFocusField={onFocusField}
      sendIcon={icon}
      sendLabel={label}
      blockTitle="No se puede enviar"
      hintText="Para poder enviar el correo, completa los siguientes requisitos:"
      shortcutLabel="Ctrl + ↵"
      className={className}
    >
      {label}
    </SubmitValidationButton>
  );
}
