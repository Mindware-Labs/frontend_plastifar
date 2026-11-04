import type { TicketDetailResponse } from "../../types/api";
import type { TaskDetail } from "../../types/tasks";
import {
  TicketFormsTab,
  type RegisteredFormItem,
} from "../tickets/TicketFormsTab";

export type { RegisteredFormItem };

interface TaskFormsTabProps {
  task: Pick<TaskDetail, "id" | "number" | "title" | "status">;
  /** Ticket operativo interno (PF-FOR); no se muestra en la UI de tareas. */
  formHostTicket: TicketDetailResponse;
  onHasFormsChanged?: (hasForms: boolean) => void;
  onFormsChanged?: () => void;
  onViewDocument?: (form: RegisteredFormItem) => void;
}

/** Pestaña Formularios de una tarea: misma lógica PF-FOR, copy y códigos de tarea (TAR). */
export function TaskFormsTab({
  task,
  formHostTicket,
  onHasFormsChanged,
  onFormsChanged,
  onViewDocument,
}: TaskFormsTabProps) {
  return (
    <TicketFormsTab
      ticket={formHostTicket}
      formScope="task"
      standaloneTaskId={task.id}
      standaloneTaskStatus={task.status}
      taskNumber={task.number}
      taskTitle={task.title}
      onHasFormsChanged={onHasFormsChanged}
      onTicketStatusChanged={onFormsChanged}
      onViewDocument={onViewDocument}
    />
  );
}
