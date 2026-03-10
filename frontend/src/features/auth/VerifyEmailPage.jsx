import { useEffect, useMemo, useState } from "react";

import { resendVerificationEmail, verifyEmailToken } from "../../api";

function normalizeError(err, fallback) {
  const detail = err?.response?.data?.detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) return detail.map((item) => item?.msg || "Validation error").join(" | ");
  return fallback;
}

function VerifyEmailPage() {
  const params = useMemo(() => new URLSearchParams(window.location.search), []);
  const token = params.get("token") || "";
  const [status, setStatus] = useState(token ? "verifying" : "idle");
  const [message, setMessage] = useState(token ? "Verifying your email..." : "Open the verification link from your email to activate your account.");
  const [email, setEmail] = useState("");
  const [resending, setResending] = useState(false);
  const [resendMessage, setResendMessage] = useState("");

  useEffect(() => {
    if (!token) return;

    let active = true;
    verifyEmailToken({ token })
      .then((res) => {
        if (!active) return;
        setStatus("success");
        setMessage(res.data.message || "Email verified successfully. You can now log in.");
      })
      .catch((err) => {
        if (!active) return;
        setStatus("error");
        setMessage(normalizeError(err, "Verification failed."));
      });

    return () => {
      active = false;
    };
  }, [token]);

  const handleResend = async () => {
    setResendMessage("");
    if (!email.trim()) {
      setResendMessage("Enter your email to resend the verification link.");
      return;
    }

    setResending(true);
    try {
      const res = await resendVerificationEmail({ email: email.trim() });
      const fallback = res.data?.verification_token ? ` Verification token for local/dev: ${res.data.verification_token}` : "";
      setResendMessage((res.data?.message || "Verification email sent.") + fallback);
    } catch (err) {
      setResendMessage(normalizeError(err, "Unable to resend verification email."));
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 px-4 py-10 text-slate-100">
      <div className="mx-auto max-w-xl rounded-3xl border border-cyan-500/20 bg-slate-900/90 p-8 shadow-2xl">
        <p className="text-xs uppercase tracking-[0.24em] text-cyan-300">LogicLens Account</p>
        <h1 className="mt-3 text-3xl font-semibold text-white">Email Verification</h1>
        <p className={`mt-4 rounded-2xl border px-4 py-3 text-sm ${status === "success" ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-200" : status === "error" ? "border-rose-500/25 bg-rose-500/10 text-rose-200" : "border-slate-700 bg-slate-800/80 text-slate-200"}`}>
          {message}
        </p>

        {status !== "success" && (
          <div className="mt-6 rounded-2xl border border-slate-800 bg-slate-950/60 p-5">
            <p className="text-sm text-slate-300">Need another verification email?</p>
            <div className="mt-3 flex flex-col gap-3 sm:flex-row">
              <input
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="Enter your email"
                className="w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-white outline-none transition focus:border-cyan-400"
              />
              <button
                type="button"
                onClick={handleResend}
                disabled={resending}
                className="rounded-xl bg-cyan-500 px-4 py-3 font-medium text-slate-950 transition hover:bg-cyan-400 disabled:opacity-60"
              >
                {resending ? "Sending..." : "Resend email"}
              </button>
            </div>
            {resendMessage && <p className="mt-3 text-sm text-slate-300">{resendMessage}</p>}
          </div>
        )}

        <div className="mt-6 flex flex-wrap gap-3">
          <a href="/" className="rounded-xl border border-slate-700 px-4 py-3 text-sm text-slate-200 transition hover:border-cyan-400 hover:text-white">
            Back to app
          </a>
        </div>
      </div>
    </div>
  );
}

export default VerifyEmailPage;
