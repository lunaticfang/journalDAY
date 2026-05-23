"use client";

import { useId, useState } from "react";
import type { ChangeEvent, CSSProperties } from "react";

type PasswordFieldProps = {
  label?: string;
  placeholder?: string;
  value: string;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
  autoComplete?: string;
  required?: boolean;
  name?: string;
  inputStyle?: CSSProperties;
  containerStyle?: CSSProperties;
};

export default function PasswordField({
  label,
  placeholder,
  value,
  onChange,
  autoComplete,
  required,
  name,
  inputStyle,
  containerStyle,
}: PasswordFieldProps) {
  const [visible, setVisible] = useState(false);
  const inputId = useId();

  return (
    <div className="password-field" style={containerStyle}>
      {label && (
        <label htmlFor={inputId} className="password-field__label">
          {label}
        </label>
      )}
      <div className="password-field__inputWrap">
        <input
          id={inputId}
          type={visible ? "text" : "password"}
          name={name}
          required={required}
          placeholder={placeholder}
          value={value}
          onChange={onChange}
          autoComplete={autoComplete}
          className="password-field__input"
          style={{
            ...inputStyle,
            paddingRight: 48,
          }}
        />
        <button
          type="button"
          onClick={() => setVisible((current) => !current)}
          aria-label={visible ? "Hide password" : "View password"}
          title={visible ? "Hide password" : "View password"}
          className="password-field__toggle"
        >
          {visible ? (
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M2 2l20 20" />
              <path d="M9.9 4.24A10.94 10.94 0 0112 4c7 0 10 8 10 8a15.87 15.87 0 01-3.3 4.5" />
              <path d="M6.7 6.7A15.9 15.9 0 002 12s3 8 10 8a10.94 10.94 0 005.76-1.67" />
              <path d="M9.88 9.88a3 3 0 104.24 4.24" />
            </svg>
          ) : (
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M2 12s3-8 10-8 10 8 10 8-3 8-10 8-10-8-10-8z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          )}
        </button>
      </div>
    </div>
  );
}
