import { useEffect, useMemo, useRef, useState } from "react";
import { Moon, Sun, UserRound, Trash2, ChevronDown, History, LogOut, KeyRound, Star, StarOff, PencilLine } from "lucide-react";

import { changePassword, getMe, invalidateApiCache, updateProfile } from "../api";
import AuthModal from "../features/auth/AuthModal";
import EditorWorkspace from "../features/editor/EditorWorkspace";
import HistoryDrawer from "../features/history/HistoryDrawer";
import PasswordModal from "../features/profile/PasswordModal";
import ProfileModal from "../features/profile/ProfileModal";
import ReviewWorkspace from "../features/review/ReviewWorkspace";
import { createHistoryActions } from "../hooks/useHistoryActions";
import { useResponsiveLayout } from "../hooks/useResponsiveLayout";
import { useReviewActions } from "../hooks/useReviewActions";
import { useSession } from "../hooks/useSession";
import { useWorkspaceDraft } from "../hooks/useWorkspaceDraft";
import ActionBar from "../layout/ActionBar";
import Header from "../layout/Header";
import {
  FAVORITES_KEY,
  PANEL_WIDTH_KEY,
  PASSWORD_REGEX,
  THEME_KEY,
  WORKSPACE_DRAFT_KEY,
  buildCopyText,
  detectLanguageFromCode,
  normalizeErrorDetail,
  normalizeResult,
  sanitizeCodeInput,
} from "../utils/dashboardHelpers";
import { getDashboardThemeClasses } from "../utils/dashboardTheme";

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
  const [leftPanelWidth, setLeftPanelWidth] = useState(() => Number(localStorage.getItem(PANEL_WIDTH_KEY) || 55));
  const [isResizingPanels, setIsResizingPanels] = useState(false);
  const [isDesktopLayout, setIsDesktopLayout] = useState(() => (typeof window !== "undefined" ? window.innerWidth >= 1024 : true));
  const [isMobileLayout, setIsMobileLayout] = useState(() => (typeof window !== "undefined" ? window.innerWidth < 640 : false));

  const workspaceRef = useRef(null);
  const gateTimerRef = useSession({ setUser, setAuthLoading, setShowAuth });
  const token = localStorage.getItem("token");
  const hasToken = Boolean(token);
  const isSessionPending = hasToken && authLoading && !user;
  const isLoggedIn = Boolean(hasToken && user);
  const detectedLanguage = useMemo(() => detectLanguageFromCode(sanitizeCodeInput(code)), [code]);
  const editorLanguage = language === "auto" ? detectedLanguage : language;
  const { appClass, backdropClass, shellClass, panelClass, surfaceClass, bannerClass } = getDashboardThemeClasses(theme);

  useWorkspaceDraft({
    draftKey: WORKSPACE_DRAFT_KEY,
    draftHydrated,
    code,
    question,
    language,
    setCode,
    setQuestion,
    setLanguage,
    setDraftHydrated,
  });

  useResponsiveLayout({
    leftPanelWidth,
    isResizingPanels,
    setIsDesktopLayout,
    setIsMobileLayout,
    setLeftPanelWidth,
    setIsResizingPanels,
    workspaceRef,
    storageKey: PANEL_WIDTH_KEY,
  });

  useEffect(() => {
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites));
  }, [favorites]);

  useEffect(() => {
    localStorage.setItem(THEME_KEY, theme);
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  useEffect(() => {
    setProfileName(user?.name || "");
  }, [user]);

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
  const toggleFavorite = (sessionId) => {
    setFavorites((prev) => (prev.includes(sessionId) ? prev.filter((id) => id !== sessionId) : [...prev, sessionId]));
  };

  const clearVisibleState = () => {
    setReviewResult(null);
    setStatusText("Ready");
    setShowDiff(false);
  };

  const { runAction } = useReviewActions({
    code,
    language,
    question,
    loadingAction,
    ensureAuth,
    setCode,
    setCurrentAction,
    setLoadingAction,
    setReviewResult,
    setShowDiff,
    setStatusText,
  });

  const { openHistory, loadHistory, handleDeleteHistoryEntry, handleClearHistory } = createHistoryActions({
    ensureAuth,
    setShowHistory,
    setShowMenu,
    setHistoryLoading,
    setHistory,
    setFavorites,
    setCode,
    setQuestion,
    clearVisibleState,
    draftKey: WORKSPACE_DRAFT_KEY,
    normalizeResult,
    setLanguage,
    setCurrentAction,
    setReviewResult,
    setStatusText,
    setShowDiff,
  });

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
      return false;
    }

    setProfileLoading(true);
    try {
      const res = await updateProfile({ name: profileName.trim() });
      setUser((prev) => ({ ...(prev || {}), name: res.data.name || profileName.trim() }));
      setProfileMessage(res.data.message || "Profile updated successfully");
      return true;
    } catch (err) {
      setProfileMessage(normalizeErrorDetail(err?.response?.data?.detail));
      return false;
    } finally {
      setProfileLoading(false);
    }
  };

  const logout = async () => {
    setLogoutLoading(true);
    setShowMenu(false);
    setShowProfile(false);
    setShowPasswordModal(false);
    setShowAuth(false);
    setSessionLoading(false);
    setAuthLoading(false);
    localStorage.removeItem("token");
    localStorage.removeItem(WORKSPACE_DRAFT_KEY);
    invalidateApiCache("all");
    setUser(null);
    setHistory([]);
    setFavorites([]);
    setCode("");
    setQuestion("");
    setLanguage("auto");
    setGateMessage("");
    clearVisibleState();
    setShowHistory(false);
    setLogoutLoading(false);
  };

  return (
    <div className={`min-h-screen pb-32 ${appClass}`}>
      <div className={`pointer-events-none fixed inset-0 ${backdropClass}`} />

      <Header
        theme={theme}
        shellClass={shellClass}
        statusText={statusText}
        authLoading={authLoading}
        sessionLoading={sessionLoading}
        isLoggedIn={isLoggedIn}
        isSessionPending={isSessionPending}
        showMenu={showMenu}
        setShowMenu={setShowMenu}
        setTheme={setTheme}
        setAuthMode={setAuthMode}
        setShowAuth={setShowAuth}
        logout={logout}
        logoutLoading={logoutLoading}
        openHistory={openHistory}
        setShowProfile={setShowProfile}
        setShowPasswordModal={setShowPasswordModal}
        icons={{ Sun, Moon, UserRound, ChevronDown, History, KeyRound, LogOut }}
      />

      {gateMessage && <div className="fixed right-4 top-20 z-40 rounded-lg border border-amber-300/30 bg-amber-200/10 px-4 py-2 text-sm text-amber-200 shadow-lg">{gateMessage}</div>}

      {sessionLoading && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/35 backdrop-blur-[2px]">
          <div className={`logiclens-modal-card rounded-2xl border px-5 py-4 ${theme === "light" ? "border-stone-300 bg-white text-slate-800" : "border-slate-700 bg-slate-900 text-slate-100"}`}>
            <div className="flex items-center gap-3">
              <span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-400 border-t-cyan-400" />
              <div>
                <p className="text-sm font-semibold">Signing you in</p>
                <p className="text-xs opacity-70">Loading your workspace...</p>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="relative mx-auto max-w-[1380px] px-3 pb-0 pt-[8.5rem] sm:px-4 sm:pt-[9rem] md:px-6 lg:pt-[8rem] lg:pr-10 xl:pr-14">
        <div className={`mb-3 rounded-2xl border px-3 py-2 text-[11px] leading-5 shadow-[0_0_30px_rgba(34,211,238,0.08)] sm:mb-4 sm:px-4 sm:py-3 sm:text-sm ${bannerClass}`}>
          {isLoggedIn ? (
            <span>Welcome back, <span className="font-semibold">{user.name}</span>. Review focused on core DSA correctness and algorithm quality.</span>
          ) : isSessionPending ? (
            <span>Restoring your workspace...</span>
          ) : (
            <span>Login to review code, manage history, save favorites, and personalize your profile.</span>
          )}
        </div>

        <main ref={workspaceRef} className="flex flex-col gap-4 lg:flex-row">
          <EditorWorkspace
            theme={theme}
            panelClass={panelClass}
            isDesktopLayout={isDesktopLayout}
            leftPanelWidth={leftPanelWidth}
            language={language}
            setLanguage={setLanguage}
            detectedLanguage={detectedLanguage}
            editorLanguage={editorLanguage}
            isMobileLayout={isMobileLayout}
            code={code}
            setCode={setCode}
            question={question}
            setQuestion={setQuestion}
          />

          <div className="hidden lg:flex lg:w-4 lg:flex-none lg:items-stretch lg:justify-center">
            <button
              type="button"
              aria-label="Resize panels"
              onMouseDown={() => setIsResizingPanels(true)}
              className={`w-1 rounded-full transition ${theme === "light" ? "bg-slate-400 hover:bg-slate-700" : "bg-slate-700 hover:bg-cyan-400"}`}
            />
          </div>

          <ReviewWorkspace
            theme={theme}
            panelClass={panelClass}
            surfaceClass={surfaceClass}
            isDesktopLayout={isDesktopLayout}
            leftPanelWidth={leftPanelWidth}
            reviewResult={reviewResult}
            buildCopyText={buildCopyText}
            isLoggedIn={isLoggedIn}
            openHistory={openHistory}
            isSessionPending={isSessionPending}
            loadingAction={loadingAction}
            authLoading={authLoading}
            sessionLoading={sessionLoading}
            statusText={statusText}
            expanded={expanded}
            toggleExpanded={toggleExpanded}
            showDiff={showDiff}
            setShowDiff={setShowDiff}
            code={code}
            sanitizeCodeInput={sanitizeCodeInput}
            editorLanguage={editorLanguage}
            currentAction={currentAction}
          />
        </main>
      </div>

      <ActionBar theme={theme} loadingAction={loadingAction} runAction={runAction} />

      <HistoryDrawer
        theme={theme}
        showHistory={showHistory}
        setShowHistory={setShowHistory}
        handleClearHistory={handleClearHistory}
        historyLoading={historyLoading}
        history={history}
        favorites={favorites}
        toggleFavorite={toggleFavorite}
        loadHistory={loadHistory}
        handleDeleteHistoryEntry={handleDeleteHistoryEntry}
        icons={{ Star, StarOff, Trash2 }}
      />

      <ProfileModal
        theme={theme}
        showProfile={showProfile}
        setShowProfile={setShowProfile}
        profileName={profileName}
        setProfileName={setProfileName}
        user={user}
        profileMessage={profileMessage}
        updateProfileName={updateProfileName}
        profileLoading={profileLoading}
        PencilLine={PencilLine}
      />

      <PasswordModal
        theme={theme}
        showPasswordModal={showPasswordModal}
        setShowPasswordModal={setShowPasswordModal}
        pwdForm={pwdForm}
        setPwdForm={setPwdForm}
        pwdMessage={pwdMessage}
        submitPasswordChange={submitPasswordChange}
        pwdLoading={pwdLoading}
      />

      {showAuth && (
        <AuthModal
          defaultMode={authMode}
          close={() => setShowAuth(false)}
          onAuthSuccess={async (authPayload) => {
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
          }}
        />
      )}
    </div>
  );
}

export default Dashboard;





