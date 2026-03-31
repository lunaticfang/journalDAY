export const PASSWORD_MIN_LENGTH = 12;
export const PASSWORD_POLICY_HINT =
  "Use at least 12 characters with uppercase, lowercase, a number, and a symbol.";
export const INVALID_CREDENTIALS_MESSAGE = "Invalid email or password.";
export const RESET_REQUEST_MESSAGE =
  "If an account exists for that email, a password reset link has been sent.";

export function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

export function validatePasswordStrength(password) {
  const value = String(password || "");

  if (value.length < PASSWORD_MIN_LENGTH) {
    return PASSWORD_POLICY_HINT;
  }

  if (!/[a-z]/.test(value)) {
    return PASSWORD_POLICY_HINT;
  }

  if (!/[A-Z]/.test(value)) {
    return PASSWORD_POLICY_HINT;
  }

  if (!/\d/.test(value)) {
    return PASSWORD_POLICY_HINT;
  }

  if (!/[^A-Za-z0-9]/.test(value)) {
    return PASSWORD_POLICY_HINT;
  }

  return "";
}
