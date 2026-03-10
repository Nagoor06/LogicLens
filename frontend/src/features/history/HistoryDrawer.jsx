function HistoryDrawer({ theme, showHistory, setShowHistory, handleClearHistory, historyLoading, history, favorites, toggleFavorite, loadHistory, handleDeleteHistoryEntry, icons }) {
  const { Star, StarOff, Trash2 } = icons;

  return (
    <>
      <div className={`fixed inset-0 z-40 bg-black/45 transition-opacity ${showHistory ? "opacity-100" : "pointer-events-none opacity-0"}`} onClick={() => setShowHistory(false)} />
      <aside className={`logiclens-drawer fixed inset-y-0 left-0 z-50 w-full max-w-[380px] border-r p-4 backdrop-blur transition-transform duration-300 ${showHistory ? "translate-x-0" : "-translate-x-full"} ${theme === "light" ? "border-2 border-slate-500 bg-white/96 text-slate-900" : "border-slate-800 bg-slate-950/95 text-slate-100"}`}>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold tracking-wide">History</h3>
          <div className="flex gap-2">
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
    </>
  );
}

export default HistoryDrawer;
