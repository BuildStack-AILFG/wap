"use client";

import { ReactNode, useState } from "react";
import { Eye, EyeOff } from "lucide-react";

type FormFieldProps = {
  id: string;
  label: string;
  type?: string;
  value: string;
  placeholder?: string;
  autoComplete?: string;
  icon?: ReactNode;
  error?: string;
  touched?: boolean;
  onChange: (value: string) => void;
  onBlur?: () => void;
  rightSlot?: ReactNode;
  showPasswordToggle?: boolean;
};

export default function FormField({
  id,
  label,
  type = "text",
  value,
  placeholder,
  autoComplete,
  icon,
  error,
  touched,
  onChange,
  onBlur,
  rightSlot,
  showPasswordToggle,
}: FormFieldProps) {
  const [visible, setVisible] = useState(false);
  const resolvedType = showPasswordToggle ? (visible ? "text" : "password") : type;
  const showError = Boolean(touched && error);

  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <label htmlFor={id} className="text-[12px] font-semibold uppercase tracking-wide text-[#4B5563]">
          {label}
        </label>
        {rightSlot}
      </div>
      <div
        className={`flex items-center gap-2 rounded-xl border bg-white px-3.5 py-2.5 transition-colors ${
          showError
            ? "border-red-400 ring-1 ring-red-100"
            : "border-[#E2E8F0] focus-within:border-emerald-600 focus-within:ring-2 focus-within:ring-emerald-100"
        }`}
      >
        {icon && <span className="shrink-0 text-[#9CA3AF]">{icon}</span>}
        <input
          id={id}
          name={id}
          type={resolvedType}
          value={value}
          placeholder={placeholder}
          autoComplete={autoComplete}
          aria-invalid={showError}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          className="w-full bg-transparent text-[14px] text-[#111827] outline-none placeholder:text-[#9CA3AF]"
        />
        {showPasswordToggle && (
          <button
            type="button"
            tabIndex={-1}
            onClick={() => setVisible((v) => !v)}
            aria-label={visible ? "Hide password" : "Show password"}
            className="shrink-0 text-[#9CA3AF] transition-colors hover:text-[#4B5563]"
          >
            {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        )}
      </div>
      {showError && <p className="mt-1.5 text-[12.5px] text-red-600">{error}</p>}
    </div>
  );
}
