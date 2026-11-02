import { LoaderCircle } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";
import { Button } from "../../components/shadcn/button";

interface MailToolbarIconButtonProps extends ComponentProps<typeof Button> {
  pending?: boolean;
  children: ReactNode;
  buttonClassName?: string;
}

export function MailToolbarIconButton({
  pending = false,
  children,
  buttonClassName = "",
  className = "",
  disabled,
  ...props
}: MailToolbarIconButtonProps) {
  return (
    <Button
      {...props}
      disabled={disabled || pending}
      className={`${buttonClassName} ${className} ${pending ? "bg-zinc-100/80 text-zinc-500" : ""}`}
    >
      {pending ? (
        <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden />
      ) : (
        children
      )}
    </Button>
  );
}
