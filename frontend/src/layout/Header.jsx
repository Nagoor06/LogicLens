import Logo from "./Logo";

function Header({
  theme,
  shellClass,
  statusText,
  authLoading,
  sessionLoading,
  isLoggedIn,
  isSessionPending,
  showMenu,
  setShowMenu,
  setTheme,
  setAuthMode,
  setShowAuth,
  logout,
  logoutLoading,
  openHistory,
  setShowProfile,
  setShowPasswordModal,
  icons,
}) {
  const { Sun, Moon, UserRound, ChevronDown, History, KeyRound, LogOut } = icons;

  return (
    <header className={`fixed inset-x-0 top-0 z-30 border-b backdrop-blur ${shellClass}`}>
      <div className="mx-auto flex max-w-7xl items-start justify-between gap-3 p-3 sm:p-4 md:px-6">
        <div className="min-w-0 flex-1">
          <Logo />
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
                onClick={() => {
                  setAuthMode("login");
                  setShowAuth(true);
                }}
                className={`rounded-lg border px-3 py-2 text-sm font-medium sm:px-4 ${theme === "light" ? "border-sky-300 bg-white text-sky-900 hover:bg-sky-50" : "border-slate-700 bg-slate-800 text-slate-100"}`}
              >
                Login
              </button>
              <button
                onClick={() => {
                  setAuthMode("register");
                  setShowAuth(true);
                }}
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

              {showMenu && isLoggedIn && (
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
  );
}

export default Header;
