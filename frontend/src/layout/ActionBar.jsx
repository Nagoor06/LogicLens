function ActionBar({ theme, loadingAction, runAction }) {
  return (
    <div className="fixed inset-x-0 bottom-4 z-20 flex justify-center px-3 pointer-events-none sm:bottom-6 sm:px-4">
      <div className={`logiclens-actionbar pointer-events-auto flex w-full max-w-[720px] flex-wrap items-center justify-center gap-2 rounded-2xl border px-3 py-3 shadow-2xl backdrop-blur sm:gap-3 sm:px-4 ${theme === "light" ? "border-2 border-slate-500 bg-white/94" : "border-slate-700 bg-slate-900/92"}`}>
        <button onClick={() => runAction("review")} disabled={Boolean(loadingAction)} className="min-w-[132px] flex-1 rounded-lg bg-cyan-500 px-4 py-2 text-sm font-medium text-slate-950 transition hover:-translate-y-0.5 hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-50 sm:flex-none">{loadingAction === "review" ? "Reviewing..." : "Review"}</button>
        <button onClick={() => runAction("hint")} disabled={Boolean(loadingAction)} className="min-w-[132px] flex-1 rounded-lg bg-blue-500 px-4 py-2 text-sm font-medium text-white transition hover:-translate-y-0.5 hover:bg-blue-400 disabled:cursor-not-allowed disabled:opacity-50 sm:flex-none">{loadingAction === "hint" ? "Thinking..." : "Hint"}</button>
        <button onClick={() => runAction("complexity")} disabled={Boolean(loadingAction)} className="min-w-[132px] flex-1 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-slate-950 transition hover:-translate-y-0.5 hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50 sm:flex-none">{loadingAction === "complexity" ? "Analyzing..." : "Complexity"}</button>
        <button onClick={() => runAction("fix")} disabled={Boolean(loadingAction)} className="min-w-[132px] flex-1 rounded-lg bg-orange-500 px-4 py-2 text-sm font-medium text-slate-950 transition hover:-translate-y-0.5 hover:bg-orange-400 disabled:cursor-not-allowed disabled:opacity-50 sm:flex-none">{loadingAction === "fix" ? "Fixing..." : "Fix Code"}</button>
      </div>
    </div>
  );
}

export default ActionBar;
