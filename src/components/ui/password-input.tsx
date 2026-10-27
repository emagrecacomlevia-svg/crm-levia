import { useId, useState, type ComponentProps } from "react";
import { Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";

type PasswordInputProps = Omit<ComponentProps<"input">, "type"> & {
  visibilityLabel?: string;
  containerClassName?: string;
};

export function PasswordInput({
  id,
  className,
  containerClassName,
  visibilityLabel = "senha",
  disabled,
  ...props
}: PasswordInputProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const [visible, setVisible] = useState(false);
  return (
    <span className={cn("relative block", containerClassName)}>
      <input
        {...props}
        id={inputId}
        disabled={disabled}
        type={visible ? "text" : "password"}
        className={cn(className, "pr-12")}
      />
      <button
        type="button"
        disabled={disabled}
        aria-label={`${visible ? "Ocultar" : "Mostrar"} ${visibilityLabel}`}
        aria-controls={inputId}
        aria-pressed={visible}
        onClick={() => setVisible((value) => !value)}
        className="absolute right-1 top-1/2 flex size-11 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:text-forest focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
      >
        {visible ? (
          <EyeOff aria-hidden="true" className="size-5" />
        ) : (
          <Eye aria-hidden="true" className="size-5" />
        )}
      </button>
    </span>
  );
}
