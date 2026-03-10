import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { continueWithGoogle, loginWithEmail, registerWithEmail } from "./auth.api";
import { validateLoginInput, validateRegisterInput } from "./auth.validators";

const GOOGLE_CLIENT_ID = (import.meta.env.VITE_GOOGLE_CLIENT_ID || "").trim();
const GOOGLE_ALLOWED_ORIGINS = (import.meta.env.VITE_GOOGLE_ALLOWED_ORIGINS || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
const GOOGLE_SCOPES = "openid email profile";

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
  const [validationError, setValidationError] = useState("");
  const [serverError, setServerError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [liveValidation, setLiveValidation] = useState(false);
  const [googleReady, setGoogleReady] = useState(false);
  const tokenClientRef = useRef(null);
  const googleRequestInFlightRef = useRef(false);

  const isLogin = mode === "login";
  const panelClass = isLogin ? "border-cyan-500/30 bg-slate-950" : "border-emerald-500/30 bg-slate-950";
  const submitClass = isLogin ? "bg-cyan-500 text-slate-950 hover:bg-cyan-400" : "bg-emerald-500 text-slate-950 hover:bg-emerald-400";
  const accentClass = isLogin ? "text-cyan-300 hover:text-cyan-200" : "text-emerald-300 hover:text-emerald-200";
  const helperBadge = useMemo(() => (isLogin ? "Secure sign in" : "Create your workspace access"), [isLogin]);
  const errorMessage = validationError || serverError;
  const hasGoogleConfig = Boolean(GOOGLE_CLIENT_ID);
  const isOriginAllowed = typeof window !== "undefined" && (GOOGLE_ALLOWED_ORIGINS.length === 0 || GOOGLE_ALLOWED_ORIGINS.includes(window.location.origin));
  const canUseGoogle = hasGoogleConfig && googleReady && isOriginAllowed && !googleLoading;

  const validateLogin = useCallback(() => validateLoginInput({ email, password }), [email, password]);
  const validateRegister = useCallback(() => validateRegisterInput({ name, email, password, confirmPassword }), [name, email, password, confirmPassword]);

  const resetAllFields = useCallback((nextMode) => {
    setMode(nextMode);
    setEmail("");
    setPassword("");
    setConfirmPassword("");
    setName("");
    setCaptcha(createCaptcha());
    setCaptchaAnswer("");
    setValidationError("");
    setServerError("");
    setSuccessMessage("");
    setLiveValidation(false);
    setGoogleLoading(false);
    googleRequestInFlightRef.current = false;
  }, []);

  const refreshCaptcha = useCallback(() => {
    setCaptcha(createCaptcha());
    setCaptchaAnswer("");
  }, []);

  const clearPasswords = useCallback(() => {
    setPassword("");
    setConfirmPassword("");
  }, []);

  useEffect(() => {
    resetAllFields(defaultMode);
  }, [defaultMode, resetAllFields]);

  useEffect(() => {
    if (!liveValidation) return;
    const nextValidationError = isLogin ? validateLogin() : validateRegister();
    setValidationError(nextValidationError);
  }, [liveValidation, isLogin, validateLogin, validateRegister]);

  const handleGoogleToken = useCallback(async (tokenResponse) => {
    googleRequestInFlightRef.current = false;

    if (!tokenResponse?.access_token) {
      setServerError("Google sign-in did not return an access token.");
      setGoogleLoading(false);
      return;
    }

    setServerError("");
    setSuccessMessage("");
    try {
      const res = await continueWithGoogle({ access_token: tokenResponse.access_token, intent: isLogin ? "login" : "register" });
      localStorage.setItem("token", res.data.access_token);
      close();
      onAuthSuccess?.(res.data);
    } catch (err) {
      setServerError(normalizeError(err, "Google sign-in failed."));
    } finally {
      setGoogleLoading(false);
    }
  }, [close, isLogin, onAuthSuccess]);

  useEffect(() => {
    if (!hasGoogleConfig) {
      setGoogleReady(false);
      tokenClientRef.current = null;
      return undefined;
    }

    const initializeGoogle = () => {
      if (!window.google?.accounts?.oauth2) return false;
      tokenClientRef.current = window.google.accounts.oauth2.initTokenClient({
        client_id: GOOGLE_CLIENT_ID,
        scope: GOOGLE_SCOPES,
        callback: handleGoogleToken,
        error_callback: () => {
          googleRequestInFlightRef.current = false;
          setGoogleLoading(false);
          setServerError("Google sign-in could not be completed. Please try again.");
        },
      });
      setGoogleReady(true);
      return true;
    };

    if (initializeGoogle()) {
      return undefined;
    }

    const intervalId = window.setInterval(() => {
      if (initializeGoogle()) {
        window.clearInterval(intervalId);
      }
    }, 250);

    const timeoutId = window.setTimeout(() => {
      window.clearInterval(intervalId);
      setGoogleReady(Boolean(window.google?.accounts?.oauth2));
    }, 8000);

    return () => {
      window.clearInterval(intervalId);
      window.clearTimeout(timeoutId);
      tokenClientRef.current = null;
      googleRequestInFlightRef.current = false;
    };
  }, [handleGoogleToken, hasGoogleConfig]);

  const handleGoogleClick = () => {
    if (googleRequestInFlightRef.current || googleLoading) return;
    if (!hasGoogleConfig) {
      setServerError("Google sign-in is disabled. Add VITE_GOOGLE_CLIENT_ID to enable it.");
      return;
    }
    if (!isOriginAllowed) {
      setServerError(`Google sign-in is not enabled for ${window.location.origin}. Add this origin in Google Cloud and VITE_GOOGLE_ALLOWED_ORIGINS.`);
      return;
    }
    if (!googleReady || !tokenClientRef.current) {
      setServerError("Google sign-in is still loading. Please try again in a moment.");
      return;
    }

    googleRequestInFlightRef.current = true;
    setGoogleLoading(true);
    setServerError("");
    setSuccessMessage("");

    try {
      tokenClientRef.current.requestAccessToken({ prompt: "select_account" });
    } catch {
      googleRequestInFlightRef.current = false;
      setGoogleLoading(false);
      setServerError("Google sign-in is unavailable for this browser or origin. Check your Google client origins.");
    }
  };

  const validateHumanCheck = () => {
    if (Number(captchaAnswer) !== captcha.answer) {
      setValidationError("Human verification failed. Solve the math question correctly.");
      setServerError("");
      clearPasswords();
      return false;
    }
    return true;
  };

  const handleFieldChange = (setter) => (event) => {
    setter(event.target.value);
    if (!liveValidation) setLiveValidation(true);
    if (successMessage) setSuccessMessage("");
    if (serverError) setServerError("");
  };

  const login = async () => {
    setLiveValidation(true);
    setSuccessMessage("");
    setServerError("");

    const nextValidationError = validateLogin();
    setValidationError(nextValidationError);
    if (nextValidationError) {
      refreshCaptcha();
      return;
    }
    if (!validateHumanCheck()) {
      refreshCaptcha();
      return;
    }

    setValidationError("");
    setLoading(true);
    try {
      const res = await loginWithEmail({ email: email.trim(), password });
      localStorage.setItem("token", res.data.access_token);
      close();
      onAuthSuccess?.(res.data);
    } catch (err) {
      setServerError(normalizeError(err, "Invalid login credentials."));
    } finally {
      refreshCaptcha();
      setLoading(false);
    }
  };

  const register = async () => {
    setLiveValidation(true);
    setSuccessMessage("");
    setServerError("");

    const nextValidationError = validateRegister();
    setValidationError(nextValidationError);
    if (nextValidationError) {
      refreshCaptcha();
      return;
    }
    if (!validateHumanCheck()) {
      refreshCaptcha();
      return;
    }

    setValidationError("");
    setLoading(true);
    try {
      await registerWithEmail({
        name: name.trim(),
        email: email.trim(),
        password,
        confirm_password: confirmPassword,
      });
      resetAllFields("login");
      setSuccessMessage("Account created. Please login.");
    } catch (err) {
      setServerError(normalizeError(err, "Registration failed."));
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

        <div className="mb-4">
          <button
            type="button"
            onClick={handleGoogleClick}
            disabled={!canUseGoogle}
            className="flex w-full items-center justify-center gap-3 rounded-2xl border border-slate-700 bg-white px-4 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {googleLoading ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-500 border-t-transparent" /> : <span className="text-base font-bold text-rose-500">G</span>}
            {googleLoading ? "Signing in with Google..." : isLogin ? "Continue with Google Login" : "Continue with Google Register"}
          </button>
          {!hasGoogleConfig && (
            <p className="mt-2 text-center text-xs text-slate-400">Google sign-in is disabled. Add VITE_GOOGLE_CLIENT_ID to enable it.</p>
          )}
          {hasGoogleConfig && !googleReady && (
            <p className="mt-2 text-center text-xs text-slate-400">Loading Google sign-in...</p>
          )}
          {hasGoogleConfig && googleReady && !isOriginAllowed && (
            <p className="mt-2 text-center text-xs text-amber-300">Google sign-in is blocked for this origin. Add {typeof window !== "undefined" ? window.location.origin : "this origin"} to your Google OAuth origins and VITE_GOOGLE_ALLOWED_ORIGINS.</p>
          )}
        </div>

        <div className="mb-4 flex items-center gap-3 text-xs uppercase tracking-[0.2em] text-slate-500">
          <span className="h-px flex-1 bg-slate-800" />
          <span>or continue with email</span>
          <span className="h-px flex-1 bg-slate-800" />
        </div>

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

        {errorMessage && <p className="mb-3 rounded-xl border border-rose-500/25 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">{errorMessage}</p>}
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
