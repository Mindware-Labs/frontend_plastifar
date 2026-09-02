// Wordmark de texto mientras se incorpora el archivo vectorial oficial del logo
// (el brand book exige reproducirlo siempre desde ese archivo, nunca recrearlo).
// Cuando lo tengas, reemplaza este componente por <img src="/logo.svg" ... />.

export function Logo({ className = "" }: { className?: string }) {
  return (
    <span
      className={`font-heading text-2xl font-bold tracking-tight text-brand-red ${className}`}
    >
      PLASTIFAR
    </span>
  );
}
