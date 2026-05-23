"use client";

import { useState } from "react";
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

  return (
    <div style={containerStyle}>
      {label && <label style={{ fontSize: 13 }}>{label}</label>}
      <div style={{ position: "relative" }}>
        <input
          type={visible ? "text" : "password"}
          name={name}
          required={required}
          placeholder={placeholder}
          value={value}
          onChange={onChange}
          autoComplete={autoComplete}
          style={{
            ...inputStyle,
            paddingRight: 76,
          }}
        />
        <button
          type="button"
          onClick={() => setVisible((current) => !current)}
          aria-label={visible ? "Hide password" : "View password"}
          style={{
            position: "absolute",
            right: 8,
            top: "50%",
            transform: "translateY(-50%)",
            border: "1px solid #d1d5db",
            borderRadius: 6,
            background: "#ffffff",
            color: "#374151",
            fontSize: 12,
            fontWeight: 700,
            padding: "4px 8px",
            cursor: "pointer",
            lineHeight: 1,
          }}
        >
          {visible ? "Hide" : "View"}
        </button>
      </div>
    </div>
  );
}
