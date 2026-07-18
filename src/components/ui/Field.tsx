import { clsx } from "clsx";
import type {
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";

const controlBase =
  "w-full rounded-lg border border-line bg-paper-raised px-3.5 h-11 text-sm text-ink placeholder:text-ink-faint outline-none transition-colors focus:border-accent focus:ring-2 focus:ring-accent-soft disabled:opacity-50";

function Wrapper({
  label,
  htmlFor,
  hint,
  required,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-[13px] font-medium text-ink-soft">
        {label}
        {required && <span className="text-crit"> *</span>}
      </label>
      {children}
      {hint && <p className="text-xs text-ink-faint">{hint}</p>}
    </div>
  );
}

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  hint?: string;
}

export function Input({ label, hint, id, className, ...props }: InputProps) {
  const inputId = id ?? props.name ?? label;
  return (
    <Wrapper label={label} htmlFor={inputId} hint={hint} required={props.required}>
      <input id={inputId} className={clsx(controlBase, className)} {...props} />
    </Wrapper>
  );
}

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  hint?: string;
}

export function Textarea({ label, hint, id, className, ...props }: TextareaProps) {
  const inputId = id ?? props.name ?? label;
  return (
    <Wrapper label={label} htmlFor={inputId} hint={hint} required={props.required}>
      <textarea
        id={inputId}
        className={clsx(controlBase, "h-auto min-h-24 py-2.5 resize-y", className)}
        {...props}
      />
    </Wrapper>
  );
}

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  hint?: string;
}

export function Select({ label, hint, id, className, children, ...props }: SelectProps) {
  const inputId = id ?? props.name ?? label;
  return (
    <Wrapper label={label} htmlFor={inputId} hint={hint} required={props.required}>
      <select
        id={inputId}
        className={clsx(controlBase, "appearance-none", className)}
        {...props}
      >
        {children}
      </select>
    </Wrapper>
  );
}
