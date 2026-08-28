import { forwardRef, type InputHTMLAttributes, type ReactElement } from "react";
import { cn } from "../../lib/cn";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, error, id, className, ...props },
  ref,
): ReactElement {
  const inputId = id ?? props.name;
  return (
    <div className="flex flex-col gap-1.5">
      {label ? (
        <label htmlFor={inputId} className="text-sm font-medium text-primary">
          {label}
        </label>
      ) : null}
      <input
        ref={ref}
        id={inputId}
        className={cn(
          "w-full rounded-control border border-subtle bg-surface px-3.5 py-2.5 text-sm text-primary placeholder:text-secondary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent",
          error ? "border-status-failed-text" : undefined,
          className,
        )}
        {...props}
      />
      {error ? <p className="text-xs text-status-failed-text">{error}</p> : null}
    </div>
  );
});
