export const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{8,}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateEmailInput(email) {
  const value = String(email || "").trim();
  if (!value) return "Email is required.";
  if (!EMAIL_REGEX.test(value)) return "Enter a valid email address.";
  return "";
}

export function validateLoginInput({ email, password }) {
  const emailError = validateEmailInput(email);
  if (emailError) return emailError;
  if (!String(password || "").trim()) return "Password is required.";
  return "";
}

export function validateRegisterInput({ name, email, password, confirmPassword }) {
  if (!String(name || "").trim()) return "Name is required.";

  const emailError = validateEmailInput(email);
  if (emailError) return emailError;

  if (!String(password || "").trim()) return "Password is required.";
  if (!PASSWORD_REGEX.test(password)) {
    return "Password must be 8+ chars with uppercase, lowercase, number, and special character.";
  }
  if (!String(confirmPassword || "").trim()) return "Confirm password is required.";
  if (password !== confirmPassword) return "Password and confirm password do not match.";

  return "";
}
