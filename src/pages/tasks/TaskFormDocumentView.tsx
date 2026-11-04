import type { RegisteredFormItem } from "./TaskFormsTab";
import { TicketFormDocumentView } from "../tickets/TicketFormDocumentView";

interface TaskFormDocumentViewProps {
  form: RegisteredFormItem;
  taskNumber: string;
  onBack: () => void;
}

/** Vista de documento PF-FOR desde una tarea (referencia TAR, no ticket). */
export function TaskFormDocumentView({ form, taskNumber, onBack }: TaskFormDocumentViewProps) {
  return (
    <TicketFormDocumentView
      form={form}
      formHostKind="task"
      contextCode={taskNumber}
      backLabel="Volver a la tarea"
      onBack={onBack}
    />
  );
}
