import { useEffect, useMemo, useRef, useState } from "react";
import Editor, { DiffEditor } from "@monaco-editor/react";
import { Moon, Sun, UserRound, Trash2, ChevronDown, History, LogOut, KeyRound, Star, StarOff, Copy, PencilLine } from "lucide-react";

import { changePassword, clearHistory, deleteHistoryEntry, getHistory, getMe, invalidateApiCache, streamReview, updateProfile } from "../api";
import AuthModal from "../components/AuthModal";
import Logo from "../components/Logo";
import StructuredOutput from "../components/StructuredOutput";

const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{8,}$/;
const FAVORITES_KEY = "logiclens:favorites";
const THEME_KEY = "logiclens:theme";
const WORKSPACE_DRAFT_KEY = "logiclens:workspace-draft";
const STATUS_BY_ACTION = {
  review: "Analyzing code...",
  hint: "Generating hints...",
  complexity: "Calculating complexity...",
  fix: "Generating corrected code...",
};

function normalizeErrorDetail(detail) {
  if (!detail) return "Request failed";
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    return detail.map((item) => (typeof item === "string" ? item : item?.msg || "Validation error")).join(" | ");
  }
  if (typeof detail === "object") return detail?.msg || JSON.stringify(detail);
  return "Request failed";
}

function normalizeResult(result, actionType = "review") {
  if (!result) return null;
  return {
    summary: result.summary || "",
    bugs: Array.isArray(result.bugs) ? result.bugs : result.issues || [],
    improvements: Array.isArray(result.improvements) ? result.improvements : result.suggestions || [],
    corrected_code: actionType === "fix" && typeof result.corrected_code === "string" ? result.corrected_code : "",
  };
}

function sanitizeCodeInput(raw) {
  let text = (raw || "").replace(/\r\n/g, "\n").trim();
  const fenceMatch = text.match(/^```[a-zA-Z0-9+#-]*\n([\s\S]*?)\n```$/);
  if (fenceMatch) text = fenceMatch[1].trim();

  const lines = text.split("\n");
  if (lines.length > 0 && ["py", "python"].includes(lines[0].trim().toLowerCase())) {
    lines.shift();
    text = lines.join("\n").trim();
  }

  return text;
}

function detectLanguageFromCode(code) {
  const src = code || "";
  if (/^\s*#include\s*</m.test(src) || /\bstd::|\bcout\b|\bvector\s*</.test(src)) return "cpp";
  if (/\bconsole\.log\b|\bfunction\b|=>/.test(src)) return "javascript";
  if (/\bpublic\s+static\s+void\s+main\b|\bclass\s+\w+\s*\{/.test(src)) return "java";
  if (/\bdef\s+\w+\s*\(|\bimport\s+\w+/.test(src)) return "python";
  if (/\bfunc\s+\w+\s*\(|\bpackage\s+main\b/.test(src)) return "go";
  if (/\bfn\s+main\s*\(|\blet\s+mut\b/.test(src)) return "rust";
  if (/\busing\s+System\b|\bnamespace\s+\w+/.test(src)) return "csharp";
  if (/interface\s+\w+|type\s+\w+\s*=|:\s*(string|number|boolean)\b/.test(src)) return "typescript";
  return "plaintext";
}

function buildCopyText(result) {
  if (!result) return "";
  return [
    `Summary\n${result.summary}`,
    `Bugs\n${result.bugs.join("\n")}`,
    `Improvements\n${result.improvements.join("\n")}`,
    result.corrected_code ? `Corrected Code\n${result.corrected_code}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");
}

function Dashboard() {
  const [code, setCode] = useState("");
  const [question, setQuestion] = useState("");
  const [language, setLanguage] = useState("auto");
  const [theme, setTheme] = useState(() => localStorage.getItem(THEME_KEY) || "dark");

  const [reviewResult, setReviewResult] = useState(null);
  const [currentAction, setCurrentAction] = useState("review");
  const [statusText, setStatusText] = useState("Ready");
  const [showDiff, setShowDiff] = useState(false);
  const [expanded, setExpanded] = useState({ summary: true, bugs: true, improvements: true, corrected_code: true });

  const [history, setHistory] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [favorites, setFavorites] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(FAVORITES_KEY) || "[]");
    } catch {
      return [];
    }
  });

  const [loadingAction, setLoadingAction] = useState(null);
  const [showMenu, setShowMenu] = useState(false);
  const [showAuth, setShowAuth] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [sessionLoading, setSessionLoading] = useState(false);
  const [user, setUser] = useState(null);

  const [showProfile, setShowProfile] = useState(false);
  const [profileName, setProfileName] = useState("");
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileMessage, setProfileMessage] = useState("");
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [pwdForm, setPwdForm] = useState({ current_password: "", new_password: "", confirm_new_password: "" });
  const [pwdLoading, setPwdLoading] = useState(false);
  const [pwdMessage, setPwdMessage] = useState("");

  const [logoutLoading, setLogoutLoading] = useState(false);
  const [gateMessage, setGateMessage] = useState("");
  const [authMode, setAuthMode] = useState("login");
  const [draftHydrated, setDraftHydrated] = useState(false);
  const [leftPanelWidth, setLeftPanelWidth] = useState(() => Number(localStorage.getItem("logiclens:left-panel-width") || 55));
  const [isResizingPanels, setIsResizingPanels] = useState(false);
  const [isDesktopLayout, setIsDesktopLayout] = useState(() => (typeof window !== "undefined" ? window.innerWidth >= 1024 : true));
  const [isMobileLayout, setIsMobileLayout] = useState(() => (typeof window !== "undefined" ? window.innerWidth < 640 : false));

  const gateTimerRef = useRef(null);
  const workspaceRef = useRef(null);
  const token = localStorage.getItem("token");
  const hasToken = Boolean(token);
  const isSessionPending = hasToken && authLoading && !user;
  const isLoggedIn = Boolean(hasToken && user);
  const detectedLanguage = useMemo(() => detectLanguageFromCode(sanitizeCodeInput(code)), [code]);
  const editorLanguage = language === "auto" ? detectedLanguage : language;

  useEffect(() => {
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites));
  }, [favorites]);

  useEffect(() => {
    try {
      const draft = JSON.parse(localStorage.getItem(WORKSPACE_DRAFT_KEY) || "{}");
      if (typeof draft.code === "string") setCode(draft.code);
      if (typeof draft.question === "string") setQuestion(draft.question);
      if (typeof draft.language === "string") setLanguage(draft.language);
    } catch {
      localStorage.removeItem(WORKSPACE_DRAFT_KEY);
    } finally {
      setDraftHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!draftHydrated) return;
    localStorage.setItem(WORKSPACE_DRAFT_KEY, JSON.stringify({ code, question, language }));
  }, [draftHydrated, code, question, language]);

  useEffect(() => {
    localStorage.setItem(THEME_KEY, theme);
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  useEffect(() => {
    localStorage.setItem("logiclens:left-panel-width", String(leftPanelWidth));
  }, [leftPanelWidth]);

  useEffect(() => {
    const desktopQuery = window.matchMedia("(min-width: 1024px)");
    const mobileQuery = window.matchMedia("(max-width: 639px)");
    const syncDesktop = (event) => setIsDesktopLayout(event.matches);
    const syncMobile = (event) => setIsMobileLayout(event.matches);
    setIsDesktopLayout(desktopQuery.matches);
    setIsMobileLayout(mobileQuery.matches);
    desktopQuery.addEventListener("change", syncDesktop);
    mobileQuery.addEventListener("change", syncMobile);
    return () => {
      desktopQuery.removeEventListener("change", syncDesktop);
      mobileQuery.removeEventListener("change", syncMobile);
    };
  }, []);

  useEffect(() => {
    if (!isResizingPanels || !isDesktopLayout) return;

    const handleMouseMove = (event) => {
      if (!workspaceRef.current) return;
      const bounds = workspaceRef.current.getBoundingClientRect();
      const nextWidth = ((event.clientX - bounds.left) / bounds.width) * 100;
      const clampedWidth = Math.max(38, Math.min(68, nextWidth));
      setLeftPanelWidth(clampedWidth);
    };

    const handleMouseUp = () => setIsResizingPanels(false);

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isDesktopLayout, isResizingPanels]);

  useEffect(() => {
    setProfileName(user?.name || "");
  }, [user]);

  useEffect(() => {
    const fetchCurrentUser = async () => {
      if (!localStorage.getItem("token")) {
        setUser(null);
        setAuthLoading(false);
        return;
      }

      setAuthLoading(true);
      try {
        const res = await getMe();
        setUser(res.data);
      } catch {
        localStorage.removeItem("token");
        invalidateApiCache("all");
        setUser(null);
        setShowAuth(true);
      } finally {
        setAuthLoading(false);
      }
    };

    fetchCurrentUser();
    return () => {
      if (gateTimerRef.current) clearTimeout(gateTimerRef.current);
    };
  }, []);

  const showGate = () => {
    setGateMessage("Login required for all actions");
    if (gateTimerRef.current) clearTimeout(gateTimerRef.current);
    gateTimerRef.current = setTimeout(() => setGateMessage(""), 2200);
  };

  const ensureAuth = () => {
    if (!isLoggedIn) {
      showGate();
      setShowAuth(true);
      return false;
    }
    return true;
  };

  const toggleExpanded = (key) => setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));
  const toggleFavorite = (sessionId) => setFavorites((prev) => (prev.includes(sessionId) ? prev.filter((id) => id !== sessionId) : [...prev, sessionId]));

  const clearVisibleState = () => {
    setReviewResult(null);
    setStatusText("Ready");
    setShowDiff(false);
  };

  const validateBeforeRun = () => {
    const cleanedCode = sanitizeCodeInput(code);
    if (!cleanedCode) {
      setReviewResult({ summary: "Please provide code to analyze.", bugs: [], improvements: [], corrected_code: "" });
      setStatusText("Waiting for code");
      return null;
    }

    const resolvedLanguage = language === "auto" ? detectLanguageFromCode(cleanedCode) : language;
    if (!resolvedLanguage) {
      setReviewResult({ summary: "Unsupported language.", bugs: [], improvements: [], corrected_code: "" });
      setStatusText("Unsupported language");
      return null;
    }

    if (cleanedCode !== code) setCode(cleanedCode);
    return { language: resolvedLanguage, code: cleanedCode, question_text: question };
  };

  const runAction = async (action) => {
    if (!ensureAuth() || loadingAction) return;

    const basePayload = validateBeforeRun();
    if (!basePayload) return;

    setCurrentAction(action);
    setLoadingAction(action);
    setStatusText(STATUS_BY_ACTION[action] || "Generating response...");
    setReviewResult(null);
    setShowDiff(action === "fix");

    try {
      await streamReview(
        { ...basePayload, action_type: action },
        {
          onStatus: (status) => setStatusText(status || STATUS_BY_ACTION[action]),
          onToken: () => {},
          onFinal: (event) => {
            const normalized = normalizeResult(event.result, action);
            setReviewResult(normalized);
            setStatusText("Ready");
            setShowDiff(action === "fix" && Boolean(normalized?.corrected_code));
          },
          onError: (message) => {
            setReviewResult({ summary: message, bugs: [], improvements: [], corrected_code: "" });
            setStatusText("Error");
          },
        }
      );
    } catch (err) {
      const message = normalizeErrorDetail(err?.message || err?.response?.data?.detail);
      setReviewResult({ summary: message, bugs: [], improvements: [], corrected_code: "" });
      setStatusText("Error");
    } finally {
      setLoadingAction(null);
    }
  };

  const openHistory = async () => {
    if (!ensureAuth()) return;

    setShowHistory(true);
    setShowMenu(false);
    setHistoryLoading(true);

    try {
      const res = await getHistory();
      setHistory(res.data || []);
    } catch {
      setHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  };

  const loadHistory = (session) => {
    const review = session.reviews?.[0];
    if (!review) return;

    setCode(session.code || "");
    setQuestion(session.question_text || "");
    if (session.language) setLanguage(session.language);
    setCurrentAction(review.action_type || "review");
    setReviewResult(normalizeResult(review.result, review.action_type));
    setStatusText("Loaded from history");
    setShowHistory(false);
    setShowDiff(review.action_type === "fix" && Boolean(review.result?.corrected_code));
  };

  const handleDeleteHistoryEntry = async (sessionId) => {
    try {
      await deleteHistoryEntry(sessionId);
      setHistory((prev) => prev.filter((session) => session.session_id !== sessionId));
      setFavorites((prev) => prev.filter((id) => id !== sessionId));
    } catch {
      setStatusText("Delete failed");
    }
  };

  const handleClearHistory = async () => {
    try {
      await clearHistory();
      setHistory([]);
      setFavorites([]);
      setCode("");
      setQuestion("");
      localStorage.removeItem(WORKSPACE_DRAFT_KEY);
      clearVisibleState();
      setShowHistory(false);
    } catch {
      setStatusText("Clear history failed");
    }
  };

  const submitPasswordChange = async () => {
    setPwdMessage("");
    if (!pwdForm.current_password.trim() || !pwdForm.new_password.trim() || !pwdForm.confirm_new_password.trim()) {
      setPwdMessage("All password fields are required.");
      return;
    }
    if (!PASSWORD_REGEX.test(pwdForm.new_password)) {
      setPwdMessage("New password must be 8+ chars with uppercase, lowercase, number, and special character.");
      return;
    }
    if (pwdForm.new_password !== pwdForm.confirm_new_password) {
      setPwdMessage("New password and confirm password do not match.");
      return;
    }

    setPwdLoading(true);
    try {
      const res = await changePassword(pwdForm);
      setPwdMessage(res.data.message || "Password changed successfully");
      setPwdForm({ current_password: "", new_password: "", confirm_new_password: "" });
    } catch (err) {
      setPwdMessage(normalizeErrorDetail(err?.response?.data?.detail));
    } finally {
      setPwdLoading(false);
    }
  };

  const updateProfileName = async () => {
    setProfileMessage("");
    if (!profileName.trim()) {
      setProfileMessage("Name is required.");
      return;
    }

    setProfileLoading(true);
    try {
      const res = await updateProfile({ name: profileName.trim() });
      setUser((prev) => ({ ...(prev || {}), name: res.data.name || profileName.trim() }));
      setProfileMessage(res.data.message || "Profile updated successfully");
    } catch (err) {
      setProfileMessage(normalizeErrorDetail(err?.response?.data?.detail));
    } finally {
      setProfileLoading(false);
    }
  };

  const logout = async () => {
    setLogoutLoading(true);
    await new Promise((resolve) => setTimeout(resolve, 500));
    localStorage.removeItem("token");
    localStorage.removeItem(WORKSPACE_DRAFT_KEY);
    invalidateApiCache("all");
    setUser(null);
    setHistory([]);
    setFavorites([]);
    setCode("");
    setQuestion("");
    clearVisibleState();
    setShowHistory(false);
    setShowMenu(false);
    setLogoutLoading(false);
  };

  const shellClass = theme === "light" ? "bg-[#f4f7fb]/95 text-slate-900 border-2 border-slate-500 shadow-[0_10px_30px_rgba(15,23,42,0.08)]" : "bg-slate-900/70 text-slate-100 border-slate-800";
  const panelClass = theme === "light" ? "bg-white/88 border-2 border-slate-400 text-slate-900 shadow-[0_24px_60px_rgba(15,23,42,0.08)]" : "bg-slate-900/70 border-slate-800 text-slate-100";
  const surfaceClass = theme === "light" ? "bg-[#f8fafc] border-2 border-slate-400" : "bg-slate-950 border-slate-800";

  return (
    <div className={`min-h-screen pb-32 ${theme === "light" ? "bg-[#edf4fb] text-slate-900" : "bg-slate-950 text-slate-100"}`}>
      <div className={`pointer-events-none fixed inset-0 ${theme === "light" ? "bg-[radial-gradient(circle_at_12%_14%,rgba(56,189,248,0.18),transparent_36%),radial-gradient(circle_at_82%_10%,rgba(16,185,129,0.12),transparent_38%),linear-gradient(180deg,rgba(248,251,255,0.92),rgba(237,244,251,0.72))]" : "bg-[radial-gradient(circle_at_12%_16%,rgba(34,211,238,0.16),transparent_40%),radial-gradient(circle_at_88%_8%,rgba(59,130,246,0.14),transparent_42%)]"}`} />

      <header className={`fixed inset-x-0 top-0 z-30 border-b backdrop-blur ${shellClass}`}>
        <div className="mx-auto flex max-w-7xl items-start justify-between gap-3 p-3 sm:p-4 md:px-6">
          <div className="min-w-0 flex-1">
            <Logo theme={theme} />
            <div className={`mt-2 inline-flex rounded-lg border px-3 py-1.5 text-center text-[11px] sm:text-xs ${theme === "light" ? "border-slate-300 bg-white text-slate-600" : "border-slate-800 bg-slate-900 text-slate-300"}`}>
              {authLoading || sessionLoading ? "Loading session..." : statusText}
            </div>
          </div>

          <div className="flex shrink-0 items-start gap-2 sm:gap-3">
            <button
              onClick={() => setTheme((prev) => (prev === "dark" ? "light" : "dark"))}
              className={`rounded-lg border px-3 py-2 text-sm ${theme === "light" ? "border-slate-300 bg-white text-slate-700" : "border-slate-700 bg-slate-800 text-slate-200"}`}
            >
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>

            {!isLoggedIn && !isSessionPending ? (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => { setAuthMode("login"); setShowAuth(true); }}
                  className={`rounded-lg border px-3 py-2 text-sm font-medium sm:px-4 ${theme === "light" ? "border-sky-300 bg-white text-sky-900 hover:bg-sky-50" : "border-slate-700 bg-slate-800 text-slate-100"}`}
                >
                  Login
                </button>
                <button
                  onClick={() => { setAuthMode("register"); setShowAuth(true); }}
                  className={`rounded-lg px-3 py-2 text-sm font-medium sm:px-4 ${theme === "light" ? "bg-emerald-500 text-white hover:bg-emerald-400" : "bg-cyan-500 text-slate-950 hover:bg-cyan-400"}`}
                >
                  Register
                </button>
              </div>
            ) : (
              <div className="relative">
                <button
                  onClick={() => setShowMenu((v) => !v)}
                  className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${theme === "light" ? "border-slate-300 bg-white text-slate-800" : "border-slate-700 bg-slate-800 text-slate-100"}`}
                >
                  <UserRound className="h-4 w-4" />
                  Profile
                  <ChevronDown className={`h-4 w-4 transition ${showMenu ? "rotate-180" : ""}`} />
                </button>

                {showMenu && (
                  <div className={`absolute right-0 top-full z-20 mt-2 w-56 origin-top-right rounded-lg border p-1 shadow-xl animate-[fadeIn_0.15s_ease] ${theme === "light" ? "border-slate-300 bg-white" : "border-slate-700 bg-slate-900"}`}>
                    <button className="flex w-full items-center gap-2 rounded px-3 py-2 text-left text-sm hover:bg-slate-200/50 dark:hover:bg-slate-800" onClick={() => { setShowProfile(true); setShowMenu(false); }}>
                      <UserRound className="h-4 w-4" />
                      My Profile
                    </button>
                    <button className="flex w-full items-center gap-2 rounded px-3 py-2 text-left text-sm hover:bg-slate-200/50 dark:hover:bg-slate-800" onClick={() => { setShowPasswordModal(true); setShowMenu(false); }}>
                      <KeyRound className="h-4 w-4" />
                      Change Password
                    </button>
                    <button className="flex w-full items-center gap-2 rounded px-3 py-2 text-left text-sm hover:bg-slate-200/50 dark:hover:bg-slate-800" onClick={openHistory}>
                      <History className="h-4 w-4" />
                      History
                    </button>
                    <button className="flex w-full items-center gap-2 rounded px-3 py-2 text-left text-sm text-rose-400 hover:bg-slate-200/50 dark:hover:bg-slate-800" onClick={logout} disabled={logoutLoading}>
                      {logoutLoading ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-rose-300 border-t-transparent" /> : <LogOut className="h-4 w-4" />}
                      {logoutLoading ? "Logging out..." : "Logout"}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </header>

      {gateMessage && <div className="fixed right-4 top-20 z-40 rounded-lg border border-amber-300/30 bg-amber-200/10 px-4 py-2 text-sm text-amber-200 shadow-lg">{gateMessage}</div>}

      {sessionLoading && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/35 backdrop-blur-[2px]">
          <div className={`rounded-2xl border px-5 py-4 shadow-2xl ${theme === "light" ? "border-stone-300 bg-white text-slate-800" : "border-slate-700 bg-slate-900 text-slate-100"}`}>
            <div className="flex w-full flex-wrap items-center justify-between gap-2 sm:gap-3 lg:w-auto lg:flex-nowrap lg:justify-end">
              <span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-400 border-t-cyan-400" />
              <div>
                <p className="text-sm font-semibold">Signing you in</p>
                <p className="text-xs opacity-70">Loading your workspace...</p>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="relative mx-auto max-w-[1380px] px-3 pb-0 pt-32 sm:px-4 sm:pt-30 md:px-6 md:pt-28 lg:pr-10 xl:pr-14">
        <div className={`mb-3 rounded-2xl border px-3 py-2 text-[11px] leading-5 shadow-[0_0_30px_rgba(34,211,238,0.08)] sm:mb-4 sm:px-4 sm:py-3 sm:text-sm ${theme === "light" ? "border-slate-400 bg-gradient-to-r from-slate-100 via-white to-blue-50 text-slate-800" : "border-cyan-400/25 bg-cyan-400/10 text-cyan-100"}`}>
          {isLoggedIn ? (
            <span>Welcome back, <span className="font-semibold">{user.name}</span>. Review focused on core DSA correctness and algorithm quality.</span>
          ) : isSessionPending ? (
            <span>Restoring your workspace...</span>
          ) : (
            <span>Login to review code, manage history, save favorites, and personalize your profile.</span>
          )}
        </div>

        <main ref={workspaceRef} className="flex flex-col gap-4 lg:flex-row">
          <section style={isDesktopLayout ? { flexBasis: `${leftPanelWidth}%` } : undefined} className={`rounded-2xl border p-3 sm:p-4 backdrop-blur ${panelClass} min-h-[620px] lg:h-[760px] min-w-0 flex flex-col lg:flex-none`}>
            <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="font-medium">Editor</h2>
              <div className="flex items-center gap-3 text-xs opacity-80">
                <select value={language} onChange={(e) => setLanguage(e.target.value)} className={`rounded border px-2 py-1 text-xs ${theme === "light" ? "border-slate-500 bg-white text-slate-800" : "border-slate-700 bg-slate-900 text-slate-200"}`}>
                  <option value="auto">Auto Detect ({detectedLanguage === "plaintext" ? "Plain Text" : detectedLanguage})</option>
                  <option value="plaintext">Plain Text</option>
                  <option value="python">Python</option>
                  <option value="javascript">JavaScript</option>
                  <option value="typescript">TypeScript</option>
                  <option value="java">Java</option>
                  <option value="cpp">C++</option>
                  <option value="csharp">C#</option>
                  <option value="go">Go</option>
                  <option value="rust">Rust</option>
                </select>
              </div>
            </div>

            <div className={`h-[360px] sm:h-[420px] lg:h-auto lg:flex-1 overflow-hidden rounded-xl border ${theme === "light" ? "border-2 border-slate-500" : "border-slate-800"}`}>
              {isMobileLayout ? (
                <textarea
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  spellCheck={false}
                  placeholder="Paste or write code here"
                  className={`h-full w-full resize-none border-0 bg-transparent p-3 font-mono text-[13px] leading-6 outline-none ${theme === "light" ? "text-slate-900 placeholder:text-slate-500" : "text-slate-100 placeholder:text-slate-500"}`}
                />
              ) : (
                <Editor
                  height="100%"
                  theme={theme === "light" ? "vs" : "vs-dark"}
                  language={editorLanguage}
                  value={code}
                  onChange={(v) => setCode(v || "")}
                  options={{ automaticLayout: true, minimap: { enabled: false }, scrollBeyondLastLine: false, fontSize: 14, padding: { top: 14 } }}
                />
              )}
            </div>

            <textarea
              className={`mt-4 min-h-[180px] flex-1 w-full resize-none rounded-xl border p-3 outline-none transition ${theme === "light" ? "border-2 border-slate-500 bg-[#fdfefe] text-slate-900 focus:border-slate-700" : "border-slate-800 bg-slate-950 text-slate-100 focus:border-cyan-400"}`}
              placeholder="Problem description"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
            />

            <div className="mt-3 h-16 sm:h-14" aria-hidden="true" />
          </section>

          <div className="hidden lg:flex lg:w-4 lg:flex-none lg:items-stretch lg:justify-center">
            <button
              type="button"
              aria-label="Resize panels"
              onMouseDown={() => setIsResizingPanels(true)}
              className={`w-1 rounded-full transition ${theme === "light" ? "bg-slate-400 hover:bg-slate-700" : "bg-slate-700 hover:bg-cyan-400"}`}
            />
          </div>

          <section style={isDesktopLayout ? { flexBasis: `${100 - leftPanelWidth}%` } : undefined} className={`rounded-2xl border p-3 sm:p-4 backdrop-blur ${panelClass} min-h-[560px] lg:h-[760px] min-w-0 flex flex-col lg:flex-none`}>
            <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="font-medium">Review Studio</h2>
              <div className="flex flex-wrap gap-2">
                {reviewResult && <button className={`rounded-lg border px-3 py-1 text-xs ${theme === "light" ? "border-slate-500 bg-white text-slate-800" : "border-slate-700 bg-slate-900 text-slate-200"}`} onClick={() => navigator.clipboard.writeText(buildCopyText(reviewResult))}><Copy className="mr-1 inline h-3.5 w-3.5" />Copy All</button>}
                {isLoggedIn && <button className={`rounded-lg border px-3 py-1 text-xs ${theme === "light" ? "border-slate-500 bg-white text-slate-800" : "border-slate-700 bg-slate-900 text-slate-200"}`} onClick={openHistory}>Open History</button>}
              </div>
            </div>

            <div className={`flex-1 overflow-y-auto rounded-xl border p-4 text-sm ${surfaceClass}`}>
              {!isLoggedIn && !isSessionPending ? (
                <div className="flex h-full items-center justify-center text-center text-lg font-semibold opacity-85">Login or register to start a review.</div>
              ) : loadingAction ? (
                <div className="flex h-full flex-col items-center justify-center gap-3 text-center"><span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-500 border-t-cyan-300" /><div><p className="font-medium">{authLoading || sessionLoading ? "Loading session..." : statusText}</p><p className="mt-1 text-xs opacity-70">Thinking through your code now.</p></div></div>
              ) : reviewResult ? (
                <>
                  <StructuredOutput
                    result={reviewResult}
                    expanded={expanded}
                    onToggle={toggleExpanded}
                    showDiff={showDiff}
                    onToggleDiff={() => setShowDiff((prev) => !prev)}
                    originalCode={sanitizeCodeInput(code)}
                    theme={theme}
                    actionType={currentAction}
                  />
                  {showDiff && reviewResult.corrected_code && (
                    <div className={`mt-4 overflow-hidden rounded-xl border ${theme === "light" ? "border-2 border-slate-500" : "border-slate-700"}`}>
                      <div className={`border-b px-4 py-2 text-xs ${theme === "light" ? "border-slate-400 bg-slate-100 text-slate-700" : "border-slate-700 bg-slate-900 text-slate-300"}`}>Toggle code diff view</div>
                      <div className="h-[420px]">
                      <DiffEditor
                        height="100%"
                        theme={theme === "light" ? "vs" : "vs-dark"}
                        language={editorLanguage === "plaintext" ? "javascript" : editorLanguage}
                        original={sanitizeCodeInput(code)}
                        modified={reviewResult.corrected_code}
                        options={{
                          readOnly: true,
                          automaticLayout: true,
                          renderSideBySide: true,
                          enableSplitViewResizing: true,
                          minimap: { enabled: false },
                          ignoreTrimWhitespace: false,
                          renderOverviewRuler: true,
                          wordWrap: "on",
                          diffWordWrap: "on",
                          glyphMargin: true,
                          lineNumbers: "on",
                        }}
                      />
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="flex h-full items-center justify-center opacity-70">Run an action to see results.</div>
              )}
            </div>
          </section>
        </main>
      </div>


      <div className="fixed inset-x-0 bottom-4 z-20 flex justify-center px-3 sm:bottom-6 sm:px-4 pointer-events-none">
        <div className={`pointer-events-auto flex w-full max-w-[720px] flex-wrap items-center justify-center gap-2 rounded-2xl border px-3 py-3 shadow-2xl backdrop-blur sm:gap-3 sm:px-4 ${theme === "light" ? "border-2 border-slate-500 bg-white/94" : "border-slate-700 bg-slate-900/92"}`}>
          <button onClick={() => runAction("review")} disabled={Boolean(loadingAction)} className="min-w-[132px] flex-1 rounded-lg bg-cyan-500 px-4 py-2 text-sm font-medium text-slate-950 transition hover:-translate-y-0.5 hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-50 sm:flex-none">{loadingAction === "review" ? "Reviewing..." : "Review"}</button>
          <button onClick={() => runAction("hint")} disabled={Boolean(loadingAction)} className="min-w-[132px] flex-1 rounded-lg bg-blue-500 px-4 py-2 text-sm font-medium text-white transition hover:-translate-y-0.5 hover:bg-blue-400 disabled:cursor-not-allowed disabled:opacity-50 sm:flex-none">{loadingAction === "hint" ? "Thinking..." : "Hint"}</button>
          <button onClick={() => runAction("complexity")} disabled={Boolean(loadingAction)} className="min-w-[132px] flex-1 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-slate-950 transition hover:-translate-y-0.5 hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50 sm:flex-none">{loadingAction === "complexity" ? "Analyzing..." : "Complexity"}</button>
          <button onClick={() => runAction("fix")} disabled={Boolean(loadingAction)} className="min-w-[132px] flex-1 rounded-lg bg-orange-500 px-4 py-2 text-sm font-medium text-slate-950 transition hover:-translate-y-0.5 hover:bg-orange-400 disabled:cursor-not-allowed disabled:opacity-50 sm:flex-none">{loadingAction === "fix" ? "Fixing..." : "Fix Code"}</button>
        </div>
      </div>
      <div className={`fixed inset-0 z-40 bg-black/45 transition-opacity ${showHistory ? "opacity-100" : "pointer-events-none opacity-0"}`} onClick={() => setShowHistory(false)} />
      <aside className={`fixed inset-y-0 left-0 z-50 w-full max-w-[380px] border-r p-4 backdrop-blur transition-transform duration-300 ${showHistory ? "translate-x-0" : "-translate-x-full"} ${theme === "light" ? "border-2 border-slate-500 bg-white/96 text-slate-900" : "border-slate-800 bg-slate-950/95 text-slate-100"}`}>
        <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h3 className="text-sm font-semibold tracking-wide">History</h3>
          <div className="flex flex-wrap gap-2">
            <button className={`rounded px-2 py-1 text-xs ${theme === "light" ? "bg-slate-100 hover:bg-slate-200" : "bg-slate-800 hover:bg-slate-700"}`} onClick={handleClearHistory}>Clear All</button>
            <button className={`rounded px-2 py-1 text-xs ${theme === "light" ? "bg-slate-100 hover:bg-slate-200" : "bg-slate-800 hover:bg-slate-700"}`} onClick={() => setShowHistory(false)}>Close</button>
          </div>
        </div>

        <div className="max-h-[calc(100vh-70px)] space-y-2 overflow-y-auto pr-1">
          {historyLoading && <div className="flex min-h-[220px] items-center justify-center"><p className="inline-flex items-center gap-2 text-sm opacity-70"><span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-500 border-t-cyan-300" />Loading history...</p></div>}
          {!historyLoading && history.length === 0 && <div className="flex min-h-[220px] items-center justify-center"><p className="text-sm opacity-70">No history yet.</p></div>}
          {!historyLoading && history.map((session, index) => {
            const favorite = favorites.includes(session.session_id);
            return (
              <div key={session.session_id} className={`rounded-lg border px-3 py-2 ${theme === "light" ? "border-slate-500 bg-slate-50" : "border-slate-800 bg-slate-900"}`}>
                <div className="flex items-start justify-between gap-2">
                  <button onClick={() => loadHistory(session)} className="flex-1 text-left text-sm">
                    <p className="font-medium">{session.question_text?.slice(0, 42) || `Session ${index + 1}`}</p>
                    <p className="mt-1 text-xs opacity-70">{session.language || "unknown"}</p>
                  </button>
                  <div className="flex flex-col items-end gap-2">
                    <button onClick={() => toggleFavorite(session.session_id)} className={`inline-flex items-center gap-1 text-xs ${favorite ? "text-amber-400" : "opacity-70"}`}>{favorite ? <Star className="h-3.5 w-3.5 fill-current" /> : <StarOff className="h-3.5 w-3.5" />}{favorite ? "Saved" : "Save"}</button>
                    <button onClick={() => handleDeleteHistoryEntry(session.session_id)} className="text-xs text-rose-400"><Trash2 className="h-4 w-4" /></button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </aside>

      {showProfile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setShowProfile(false)}>
          <div className={`w-full max-w-sm rounded-xl border p-5 ${theme === "light" ? "border-stone-300 bg-white text-slate-900" : "border-slate-700 bg-slate-900 text-slate-100"}`} onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold">My Profile</h3>
              <PencilLine className="h-4 w-4 opacity-60" />
            </div>
            <label className="mb-2 block text-xs uppercase tracking-[0.18em] opacity-70">Display name</label>
            <input value={profileName} onChange={(e) => setProfileName(e.target.value)} className={`mb-3 w-full rounded border p-3 text-sm ${theme === "light" ? "border-stone-300 bg-white" : "border-slate-700 bg-slate-800"}`} />
            <p className="text-sm opacity-80">Email: {user?.email || "-"}</p>
            {profileMessage && <p className="mt-3 text-sm text-cyan-400">{profileMessage}</p>}
            <div className="mt-5 flex gap-2">
              <button className="flex items-center gap-2 rounded bg-cyan-500 px-3 py-2 text-sm font-medium text-slate-950 hover:bg-cyan-400 disabled:opacity-60" onClick={updateProfileName} disabled={profileLoading}>
                {profileLoading && <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-700 border-t-transparent" />}
                Save Name
              </button>
              <button className={`rounded px-3 py-2 text-sm ${theme === "light" ? "bg-stone-100 hover:bg-stone-200" : "bg-slate-800 hover:bg-slate-700"}`} onClick={() => setShowProfile(false)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {showPasswordModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setShowPasswordModal(false)}>
          <div className={`w-full max-w-md rounded-xl border p-5 ${theme === "light" ? "border-slate-300 bg-white text-slate-900" : "border-slate-700 bg-slate-900 text-slate-100"}`} onClick={(e) => e.stopPropagation()}>
            <h3 className="mb-4 text-lg font-semibold">Change Password</h3>
            <input type="password" placeholder="Current password" value={pwdForm.current_password} onChange={(e) => setPwdForm((prev) => ({ ...prev, current_password: e.target.value }))} className={`mb-3 w-full rounded border p-3 text-sm ${theme === "light" ? "border-slate-300 bg-white" : "border-slate-700 bg-slate-800"}`} />
            <input type="password" placeholder="New password" value={pwdForm.new_password} onChange={(e) => setPwdForm((prev) => ({ ...prev, new_password: e.target.value }))} className={`mb-3 w-full rounded border p-3 text-sm ${theme === "light" ? "border-slate-300 bg-white" : "border-slate-700 bg-slate-800"}`} />
            <input type="password" placeholder="Confirm new password" value={pwdForm.confirm_new_password} onChange={(e) => setPwdForm((prev) => ({ ...prev, confirm_new_password: e.target.value }))} className={`mb-3 w-full rounded border p-3 text-sm ${theme === "light" ? "border-slate-300 bg-white" : "border-slate-700 bg-slate-800"}`} />
            {pwdMessage && <p className="mb-3 text-sm text-cyan-400">{pwdMessage}</p>}
            <div className="flex flex-wrap gap-2">
              <button onClick={submitPasswordChange} disabled={pwdLoading} className="flex items-center gap-2 rounded bg-cyan-500 px-3 py-2 text-sm font-medium text-slate-950 hover:bg-cyan-400 disabled:opacity-60">
                {pwdLoading && <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-700 border-t-transparent" />}
                Update
              </button>
              <button className={`rounded px-3 py-2 text-sm ${theme === "light" ? "bg-slate-100 hover:bg-slate-200" : "bg-slate-800 hover:bg-slate-700"}`} onClick={() => setShowPasswordModal(false)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {showAuth && <AuthModal defaultMode={authMode} close={() => setShowAuth(false)} onAuthSuccess={async (authPayload) => {
        setSessionLoading(true);
        setAuthLoading(true);
        try {
          if (authPayload?.user) {
            setUser(authPayload.user);
          } else {
            const res = await getMe();
            setUser(res.data);
          }
        } finally {
          setAuthLoading(false);
          setSessionLoading(false);
        }
      }} />}
    </div>
  );
}

export default Dashboard;



























































