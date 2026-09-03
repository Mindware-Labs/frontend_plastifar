/**
 * Cabecera de pagina: solo titulo y descripcion. El breadcrumb ya no vive
 * aqui — es responsabilidad del App Shell (TopBar), no del contenido de un
 * modulo. Notificaciones y perfil tambien viven en el TopBar global.
 */
export function DashboardHeader() {
  return (
    <div>
      <h1 className="font-heading text-[24px] font-bold tracking-[-0.02em] text-ink">Dashboard</h1>
      <p className="mt-0.5 text-[13px] text-muted">
        Vista general de la operación de soporte — volumen, cumplimiento de SLA y la bandeja completa.
      </p>
    </div>
  );
}
