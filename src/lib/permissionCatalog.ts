import type { Permission, PermissionGroup } from "../types/permissions";

/** Aplana el catalogo agrupado a una lista de permisos con su modulo. */
export function flattenPermissions(source: PermissionGroup[]): { module: string; permission: Permission }[] {
  return source.flatMap((group) => group.permissions.map((permission) => ({ module: group.module, permission })));
}

/**
 * Catálogo canónico de permisos de Plastifar (espejo de PermissionCatalog.cs).
 * Se utiliza como fallback inmediato para que la interfaz nunca parpadee ni
 * dependa de latencia de red al calcular permisos denegados.
 */
export const DEFAULT_PERMISSION_GROUPS: PermissionGroup[] = [
  {
    module: "Personal",
    permissions: [
      { key: "staff.read", label: "Ver el personal", hint: "Consultar el listado de colaboradores y sus fichas", reserved: false },
      { key: "staff.write", label: "Crear y editar personal", hint: "Dar de alta, editar y desactivar colaboradores", requires: "staff.read", reserved: false },
      { key: "roles.read", label: "Ver los roles", hint: "Consultar los roles y sus permisos", reserved: false },
      { key: "roles.write", label: "Crear y editar roles", hint: "Definir roles y cambiar los permisos que conceden", requires: "roles.read", reserved: false },
    ],
  },
  {
    module: "Departamentos y Sedes",
    permissions: [
      { key: "departments.read", label: "Ver departamentos", hint: "Consultar el árbol departamental y sus responsables", reserved: false },
      { key: "departments.write", label: "Crear y editar departamentos", hint: "Alta, edición, movimiento jerárquico y estado de departamentos", requires: "departments.read", reserved: false },
      { key: "sedes.read", label: "Ver sedes", hint: "Consultar las sedes físicas de la empresa", reserved: false },
      { key: "sedes.write", label: "Crear y editar sedes", hint: "Alta, edición y desactivación de sedes físicas", requires: "sedes.read", reserved: false },
    ],
  },
  {
    module: "Clientes",
    permissions: [
      { key: "clients.read", label: "Ver clientes y contactos", hint: "Consultar el listado de clientes y sus fichas", reserved: false },
      { key: "clients.write", label: "Crear y editar clientes", hint: "Alta, edición y desactivación de clientes y contactos", requires: "clients.read", reserved: false },
    ],
  },
  {
    module: "Correo",
    permissions: [
      { key: "mail.read", label: "Ver la bandeja de correo", hint: "Entrar al módulo, abrir conversaciones, adjuntos y exportar hilos", reserved: false },
      { key: "mail.send", label: "Enviar correo", hint: "Responder, reenviar, redactar mensajes nuevos y reintentar envíos fallidos", requires: "mail.read", reserved: false },
      { key: "mail.manage", label: "Organizar conversaciones", hint: "Archivar, destacar, papelera, restaurar, asignar y notas internas del hilo", requires: "mail.read", reserved: false },
      { key: "mail.delete", label: "Eliminar definitivamente", hint: "Vaciar la papelera y borrar conversaciones que no son historial de un ticket", requires: "mail.read", reserved: false },
    ],
  },
  {
    module: "Tickets",
    permissions: [
      { key: "tickets.read", label: "Ver los tickets de sus departamentos", hint: "Entrar a la bandeja de sus colas", reserved: false },
      { key: "tickets.create", label: "Crear tickets", hint: "Abrir tickets en nombre de los usuarios", requires: "tickets.read", reserved: false },
      { key: "tickets.edit", label: "Editar tickets", hint: "Cambiar asunto, departamento, prioridad y datos del ticket", requires: "tickets.read", reserved: false },
      { key: "tickets.reply", label: "Responder al cliente", hint: "Publicar respuestas y notas en el hilo del ticket", requires: "tickets.read", reserved: false },
      { key: "tickets.delete", label: "Eliminar tickets", hint: "Baja lógica auditada del ticket", requires: "tickets.read", reserved: false },
      { key: "tickets.assign", label: "Asignar o reasignar", hint: "Cambiar la persona responsable de un ticket", requires: "tickets.read", reserved: false },
      { key: "tickets.close", label: "Cerrar, cancelar o reabrir", hint: "Mover el ticket a un estado final y volver a abrirlo", requires: "tickets.read", reserved: false },
      { key: "tickets.read_all", label: "Ver los tickets de todos los departamentos", hint: "Supervisión: amplía la lectura sin conceder escritura", requires: "tickets.read", reserved: false },
    ],
  },
  {
    module: "Calidad",
    permissions: [
      { key: "quality.read", label: "Ver HCA en tickets", hint: "Consultar hojas de corrección vinculadas a tickets", reserved: false },
      { key: "quality.write", label: "Crear y editar HCA", hint: "Abrir hojas y cargar el plan de acción desde el ticket", requires: "quality.read", reserved: false },
      { key: "quality.approve", label: "Aprobar acciones de calidad", hint: "Reservado para flujos de aprobación de calidad", requires: "quality.read", reserved: false },
    ],
  },
  {
    module: "Reclamaciones",
    permissions: [
      { key: "claims.read", label: "Ver las reclamaciones de sus departamentos", hint: "Consultar el formulario PF-FOR-034 de los tickets que puede ver", reserved: false },
      { key: "claims.write", label: "Registrar y editar reclamaciones", hint: "Llenar las secciones I a III del formulario al abrir el ticket", requires: "claims.read", reserved: false },
      { key: "claims.treat", label: "Tratar reclamaciones", hint: "Completar la sección IV, reservada a Calidad, y cerrar o reabrir la reclamación", requires: "claims.read", reserved: false },
    ],
  },
  {
    module: "Discrepancias de carga",
    permissions: [
      { key: "discrepancies.read", label: "Ver las investigaciones de sus departamentos", hint: "Consultar e imprimir el formulario PF-FOR-291 de los tickets que puede ver", reserved: false },
      { key: "discrepancies.write", label: "Investigar discrepancias", hint: "Registrar las líneas y los puntos de seguridad, y dar la investigación por completa", requires: "discrepancies.read", reserved: false },
      { key: "discrepancies.approve", label: "Aprobar o devolver investigaciones", hint: "Firmar como «Aprobado por» o devolver con nota", requires: "discrepancies.read", reserved: false },
    ],
  },
  {
    module: "Retiros",
    permissions: [
      { key: "withdrawals.read", label: "Ver las solicitudes de retiro de sus departamentos", hint: "Consultar e imprimir el formulario PF-FOR-068 de los tickets que puede ver", reserved: false },
      { key: "withdrawals.write", label: "Solicitar y registrar retiros", hint: "Crear, editar y cancelar solicitudes, y registrar el retiro efectuado", requires: "withdrawals.read", reserved: false },
      { key: "withdrawals.approve", label: "Aprobar o rechazar retiros", hint: "Decidir sobre las solicitudes que se deben a un error del vendedor o del almacén", requires: "withdrawals.read", reserved: false },
    ],
  },
  {
    module: "Tareas",
    permissions: [
      { key: "tasks.read", label: "Ver las tareas de sus departamentos", hint: "Consultar el listado, el detalle y el historial", reserved: false },
      { key: "tasks.create", label: "Crear tareas", hint: "Abrir tareas en sus departamentos", requires: "tasks.read", reserved: false },
      { key: "tasks.edit", label: "Editar tareas", hint: "Modificar título, descripción y asignación", requires: "tasks.read", reserved: false },
      { key: "tasks.comment", label: "Comentar tareas", hint: "Publicar seguimiento y actualizaciones", requires: "tasks.read", reserved: false },
      { key: "tasks.assign", label: "Asignar tareas", hint: "Cambiar la persona responsable de una tarea", requires: "tasks.read", reserved: false },
      { key: "tasks.close", label: "Completar, cancelar o reabrir tareas", hint: "Cerrar con evidencia, cancelar o volver a abrir", requires: "tasks.read", reserved: false },
      { key: "tasks.delete", label: "Eliminar tareas", hint: "Baja lógica auditada de la tarea", requires: "tasks.read", reserved: false },
    ],
  },
  {
    module: "Reportes",
    permissions: [
      { key: "reports.read", label: "Ver los reportes", hint: "Acceder al módulo de reportes y exportar", reserved: false },
    ],
  },
  {
    module: "Configuración",
    permissions: [
      { key: "settings.write", label: "Editar catálogos y configuración", hint: "Motivos, políticas de SLA, plantillas, líneas de producto y buzones", reserved: false },
    ],
  },
];
