import type { ReactNode } from "react";
import { Card } from "../components/ui/Card";
import { Logo } from "../components/Logo";

export function AuthLayout({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-100 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex justify-center">
          <Logo />
        </div>

        <Card className="overflow-hidden">
          {/* Filete rojo/verde: mismo acento que letterhead y tarjetas del brand book */}
          <div className="flex h-1.5">
            <div className="w-2/3 bg-brand-red" />
            <div className="w-1/3 bg-brand-green" />
          </div>

          <div className="p-8">
            <h1 className="font-heading text-xl font-semibold text-zinc-900">{title}</h1>
            {subtitle && <p className="mt-1 text-sm text-zinc-500">{subtitle}</p>}

            <div className="mt-6">{children}</div>
          </div>
        </Card>
      </div>
    </div>
  );
}
