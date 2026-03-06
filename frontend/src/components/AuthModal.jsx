import { useEffect, useMemo, useState } from "react";

import { loginUser, registerUser } from "../api";

const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{8,}$/;
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function createCaptcha() {
  const left = Math.floor(Math.random() * 8) + 2;
  const right = Math.floor(Math.random() * 8) + 1;
  const operators = ["+", "-"];
  const operator = operators[Math.floor(Math.random() * operators.length)];

  if (operator === "+") {
    return { prompt: `${left} + ${right}`, answer: left + right };
  }

  const bigger = Math.max(left, right);
  const smaller = Math.min(left, right);
  return { prompt: `${bigger} - ${smaller}`, answer: bigger - smaller };
}

function normalizeError(err, fallback) {
  const detail = err?.response?.data?.detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) return detail.map((item) => item?.msg || "Validation error").join(" | ");
  return fallback;
}

function AuthModal({ close, onAuthSuccess, defaultMode = "login" }) {
  const [mode, setMode] = useState(defaultMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [name, setName] = useState("");
  const [captcha, setCaptcha] = useState(createCaptcha());
  const [captchaAnswer, setCaptchaAnswer] = useState("");
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [liveValidation, setLiveValidation] = useState(false);

  const isLogin = mode === "login";
  const panelClass = isLogin ? "border-cyan-500/30 bg-slate-950" : "border-emerald-500/30 bg-slate-950";
  const submitClass = isLogin ? "bg-cyan-500 text-slate-950 hover:bg-cyan-400" : "bg-emerald-500 text-slate-950 hover:bg-emerald-400";
  const accentClass = isLogin ? "text-cyan-300 hover:text-cyan-200" : "text-emerald-300 hover:text-emerald-200";
  const helperBadge = useMemo(() => (isLogin ? "Secure sign in" : "Create your workspace access"), [isLogin]);

  const resetAllFields = (nextMode = mode) => {
    setMode(nextMode);
    setEmail("");
    setPassword("");
    setConfirmPassword("");
    setName("");
    setCaptcha(createCaptcha());
    setCaptchaAnswer("");
    setError("");
    setSuccessMessage("");
    setLiveValidation(false);
  };

  const refreshCaptcha = () => {
    setCaptcha(createCaptcha());
    setCaptchaAnswer("");
  };

  const clearPasswords = () => {
    setPassword("");
    setConfirmPassword("");
  };

  useEffect(() => {
    resetAllFields(defaultMode);
  }, [defaultMode]);

  const validateEmail = () => {
    if (!email.trim()) return "Email is required.";
    if (!emailRegex.test(email.trim())) return "Enter a valid email address.";
    return "";
  };

  const validateLogin = () => {
    const emailError = validateEmail();
    if (emailError) return emailError;
    if (!password.trim()) return "Password is required.";
    return "";
  };

  const validateRegister = () => {
    if (!name.trim()) return "Name is required.";

    const emailError = validateEmail();
    if (emailError) return emailError;

    if (!password.trim()) return "Password is required.";
    if (!passwordRegex.test(password)) {
      return "Password must be 8+ chars with uppercase, lowercase, number, and special character.";
    }
    if (!confirmPassword.trim()) return "Confirm password is required.";
    if (password !== confirmPassword) return "Password and confirm password do not match.";

    return "";
  };

  useEffect(() => {
    if (!liveValidation) return;
    const validationError = isLogin ? validateLogin() : validateRegister();
    setError(validationError);
  }, [liveValidation, isLogin, email, password, confirmPassword, name]);

  const validateHumanCheck = () => {
    if (Number(captchaAnswer) !== captcha.answer) {
      setError("Human verification failed. Solve the math question correctly.");
      clearPasswords();
      return false;
    }
    return true;
  };

  const handleFieldChange = (setter) => (event) => {
    setter(event.target.value);
    if (!liveValidation) setLiveValidation(true);
    if (successMessage) setSuccessMessage("");
  };

  const login = async () => {
    setLiveValidation(true);
    setSuccessMessage("");

    const validationError = validateLogin();
    if (validationError) {
      setError(validationError);
      refreshCaptcha();
      return;
    }
    if (!validateHumanCheck()) {
      refreshCaptcha();
      return;
    }

    setError("");
    setLoading(true);
    try {
      const res = await loginUser({ email: email.trim(), password });
      localStorage.setItem("token", res.data.access_token);
      close();
      onAuthSuccess?.(res.data);
    } catch (err) {
      setError(normalizeError(err, "Invalid login credentials."));
      clearPasswords();
    } finally {
      refreshCaptcha();
      setLoading(false);
    }
  };

  const register = async () => {
    setLiveValidation(true);
    setSuccessMessage("");

    const validationError = validateRegister();
    if (validationError) {
      setError(validationError);
      refreshCaptcha();
      return;
    }
    if (!validateHumanCheck()) {
      refreshCaptcha();
      return;
    }

    setError("");
    setLoading(true);
    try {
      await registerUser({
        name: name.trim(),
        email: email.trim(),
        password,
        confirm_password: confirmPassword,
      });
      resetAllFields("login");
      setSuccessMessage("Account created. Please login.");
    } catch (err) {
      setError(normalizeError(err, "Registration failed."));
      clearPasswords();
    } finally {
      refreshCaptcha();
      setLoading(false);
    }
  };

  const submit = isLogin ? login : register;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm" onClick={close}>
      <div className={`w-full max-w-md rounded-3xl border p-6 shadow-2xl ${panelClass}`} onClick={(e) => e.stopPropagation()}>
        <div className="mb-5 flex items-center justify-center gap-2">
          <button onClick={() => resetAllFields("login")} className={`rounded-full px-4 py-2 text-sm font-semibold transition ${isLogin ? "bg-cyan-500 text-slate-950" : "bg-slate-800 text-slate-300 hover:bg-slate-700"}`}>
            Login
          </button>
          <button onClick={() => resetAllFields("register")} className={`rounded-full px-4 py-2 text-sm font-semibold transition ${!isLogin ? "bg-emerald-500 text-slate-950" : "bg-slate-800 text-slate-300 hover:bg-slate-700"}`}>
            Register
          </button>
        </div>

        <h2 className="mb-1 text-center text-2xl font-semibold text-white">{isLogin ? "Welcome back" : "Create your account"}</h2>
        <p className="mb-5 text-center text-xs uppercase tracking-[0.18em] text-slate-400">{helperBadge}</p>

        {!isLogin && (
          <input
            value={name}
            placeholder="Full name"
            className="mb-3 w-full rounded-xl border border-slate-700 bg-slate-900 p-3 text-white outline-none transition focus:border-emerald-400"
            onChange={handleFieldChange(setName)}
          />
        )}

        <input
          value={email}
          placeholder="Email"
          className={`mb-3 w-full rounded-xl border border-slate-700 bg-slate-900 p-3 text-white outline-none transition ${isLogin ? "focus:border-cyan-400" : "focus:border-emerald-400"}`}
          onChange={handleFieldChange(setEmail)}
        />

        <input
          value={password}
          type="password"
          placeholder="Password"
          className={`mb-3 w-full rounded-xl border border-slate-700 bg-slate-900 p-3 text-white outline-none transition ${isLogin ? "focus:border-cyan-400" : "focus:border-emerald-400"}`}
          onChange={handleFieldChange(setPassword)}
        />

        {!isLogin && (
          <input
            value={confirmPassword}
            type="password"
            placeholder="Confirm password"
            className="mb-3 w-full rounded-xl border border-slate-700 bg-slate-900 p-3 text-white outline-none transition focus:border-emerald-400"
            onChange={handleFieldChange(setConfirmPassword)}
          />
        )}

        <div className={`mb-3 rounded-2xl border px-4 py-3 ${isLogin ? "border-cyan-500/20 bg-cyan-500/10" : "border-emerald-500/20 bg-emerald-500/10"}`}>
          <p className="text-xs uppercase tracking-[0.18em] text-slate-300">Human Check</p>
          <div className="mt-2 flex items-center gap-3">
            <span className="min-w-[88px] rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white">{captcha.prompt} = ?</span>
            <input
              value={captchaAnswer}
              placeholder="Answer"
              className="w-full rounded-xl border border-slate-700 bg-slate-900 p-3 text-white outline-none transition focus:border-slate-400"
              onChange={handleFieldChange(setCaptchaAnswer)}
            />
          </div>
        </div>

        {!isLogin && (
          <p className="mb-3 text-xs text-slate-400">
            Password policy: min 8 chars, 1 uppercase, 1 lowercase, 1 number, 1 special.
          </p>
        )}

        {error && <p className="mb-3 rounded-xl border border-rose-500/25 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">{error}</p>}
        {successMessage && <p className="mb-3 rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">{successMessage}</p>}

        <button disabled={loading} onClick={submit} className={`flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 font-medium transition disabled:opacity-60 ${submitClass}`}>
          {loading && <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-700 border-t-transparent" />}
          {loading ? "Please wait..." : isLogin ? "Login" : "Register"}
        </button>

        <button onClick={() => resetAllFields(isLogin ? "register" : "login")} className={`mt-4 w-full text-sm transition ${accentClass}`}>
          {isLogin ? "Need an account? Register" : "Have an account? Login"}
        </button>
      </div>
    </div>
  );
}

export default AuthModal;

