interface BadgeProps {
  variant?: "neutral" | "success" | "red" | "green";
  children: React.ReactNode;
}

const variantClasses: Record<NonNullable<BadgeProps["variant"]>, string> = {
  neutral: "bg-zinc-100 text-zinc-600",
  success: "bg-green-50 text-brand-green",
  red: "bg-red-50 text-brand-red",
  green: "bg-green-50 text-brand-green",
};

export function Badge({ variant = "neutral", children }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${variantClasses[variant]}`}
    >
      {children}
    </span>
  );
}
