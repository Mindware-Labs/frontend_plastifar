interface AlertProps {
  variant: "error" | "success";
  children: React.ReactNode;
}

const variantClasses: Record<AlertProps["variant"], string> = {
  error: "bg-red-50 text-brand-red-dark border-red-200",
  success: "bg-green-50 text-brand-green border-green-200",
};

export function Alert({ variant, children }: AlertProps) {
  return (
    <div role="alert" className={`rounded-lg border px-4 py-3 text-sm font-medium ${variantClasses[variant]}`}>
      {children}
    </div>
  );
}
