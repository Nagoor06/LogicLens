import { clearHistory, deleteHistoryEntry, getHistory } from "../api";

export function createHistoryActions({ ensureAuth, setShowHistory, setShowMenu, setHistoryLoading, setHistory, setFavorites, setCode, setQuestion, clearVisibleState, draftKey, normalizeResult, setLanguage, setCurrentAction, setReviewResult, setStatusText, setShowDiff }) {
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
      localStorage.removeItem(draftKey);
      clearVisibleState();
      setShowHistory(false);
    } catch {
      setStatusText("Clear history failed");
    }
  };

  return { openHistory, loadHistory, handleDeleteHistoryEntry, handleClearHistory };
}
