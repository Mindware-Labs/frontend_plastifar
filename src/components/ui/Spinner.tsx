export function Spinner({ className = "" }: { className?: string }) {
  return (
    <span
      role="status"
      aria-label="Cargando"
      className={`inline-block h-6 w-6 animate-spin rounded-full border-2 border-brand-red border-t-transparent ${className}`}
    />
  );
}
