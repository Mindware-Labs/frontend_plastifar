import { Button } from "../ui/Button";

interface EnterpriseFormSaveDraftButtonProps {
  visible: boolean;
  disabled?: boolean;
  onClick: () => void;
}

/** Acción secundaria compartida en los asistentes PF-FOR del ticket. */
export function EnterpriseFormSaveDraftButton({
  visible,
  disabled,
  onClick,
}: EnterpriseFormSaveDraftButtonProps) {
  if (!visible) return null;
  return (
    <Button type="button" variant="secondary" size="sm" onClick={onClick} disabled={disabled}>
      Guardar borrador
    </Button>
  );
}
