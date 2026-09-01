import type { InputHTMLAttributes, ReactNode } from "react";

export function FormField({
  label,
  error,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: ReactNode; error?: string }) {
  const id = props.id ?? String(label).toLowerCase().replace(/\s+/g, "-");
  return (
    <label htmlFor={id}>
      <span>{label}</span>
      <input
        {...props}
        id={id}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : undefined}
      />
      {error ? (
        <span id={`${id}-error`} role="alert">
          {error}
        </span>
      ) : null}
    </label>
  );
}
