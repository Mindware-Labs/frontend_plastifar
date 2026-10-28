import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  dueDateToApi,
  parseDueDateFromApi,
  taskCommentSchema,
  taskFormSchema,
  taskReasonSchema,
} from "./taskSchema.ts";

const valid = {
  title: "Reimprimir guías",
  instructions: "Dejarlas en recepción.",
  departmentId: "4",
  assignedStaffId: "",
  priority: "Normal" as const,
  status: "Pendiente" as const,
  clientId: "",
  contactId: "",
  dueDate: "",
};

describe("taskFormSchema", () => {
  it("acepta una tarea mínima", () => {
    assert.equal(taskFormSchema.safeParse(valid).success, true);
  });

  it("rechaza título vacío o de más de 200 caracteres", () => {
    assert.equal(taskFormSchema.safeParse({ ...valid, title: "   " }).success, false);
    assert.equal(taskFormSchema.safeParse({ ...valid, title: "a".repeat(201) }).success, false);
    assert.equal(taskFormSchema.safeParse({ ...valid, title: "a".repeat(200) }).success, true);
  });

  it("exige instrucciones y departamento", () => {
    assert.equal(taskFormSchema.safeParse({ ...valid, instructions: " " }).success, false);
    assert.equal(taskFormSchema.safeParse({ ...valid, instructions: "a".repeat(8001) }).success, false);
    assert.equal(taskFormSchema.safeParse({ ...valid, departmentId: "" }).success, false);
  });

  it("solo acepta una fecha de calendario o vacío", () => {
    assert.equal(taskFormSchema.safeParse({ ...valid, dueDate: "2026-10-27" }).success, true);
    assert.equal(taskFormSchema.safeParse({ ...valid, dueDate: "mañana" }).success, false);
    assert.equal(taskFormSchema.safeParse({ ...valid, dueDate: "2026-10-27", dueTime: "14:30" }).success, true);
    assert.equal(taskFormSchema.safeParse({ ...valid, dueDate: "2026-10-27", dueTime: "invalido" }).success, false);
  });

  it("convierte y analiza fecha con hora a formato ISO", () => {
    assert.equal(dueDateToApi(""), null);
    assert.equal(dueDateToApi("2026-10-27"), "2026-10-27T00:00:00Z");
    const isoWithTime = dueDateToApi("2026-10-27", "14:30");
    assert.match(isoWithTime!, /^2026-10-27T/);
    const parsed = parseDueDateFromApi(isoWithTime);
    assert.equal(parsed.date, "2026-10-27");
    assert.equal(parsed.time, "14:30");
  });
});

describe("cierre y motivo", () => {
  it("exige el comentario de cierre y el motivo", () => {
    assert.equal(taskCommentSchema.safeParse({ comment: " " }).success, false);
    assert.equal(taskCommentSchema.safeParse({ comment: "a".repeat(4001) }).success, false);
    assert.equal(taskCommentSchema.safeParse({ comment: "Quedó entregado." }).success, true);
    assert.equal(taskReasonSchema.safeParse({ reason: "" }).success, false);
    assert.equal(taskReasonSchema.safeParse({ reason: "Faltó una copia." }).success, true);
  });
});
