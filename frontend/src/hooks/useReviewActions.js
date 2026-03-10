import { streamReview } from "../api";
import {
  STATUS_BY_ACTION,
  detectLanguageFromCode,
  normalizeErrorDetail,
  normalizeResult,
  sanitizeCodeInput,
} from "../utils/dashboardHelpers";

export function useReviewActions({
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
}) {
  const runAction = async (action) => {
    if (!ensureAuth() || loadingAction) return;

    const cleanedCode = sanitizeCodeInput(code);
    if (!cleanedCode) {
      setReviewResult({ summary: "Please provide code to analyze.", bugs: [], improvements: [], corrected_code: "" });
      setStatusText("Waiting for code");
      return;
    }

    const resolvedLanguage = language === "auto" ? detectLanguageFromCode(cleanedCode) : language;
    if (!resolvedLanguage) {
      setReviewResult({ summary: "Unsupported language.", bugs: [], improvements: [], corrected_code: "" });
      setStatusText("Unsupported language");
      return;
    }

    if (cleanedCode !== code) setCode(cleanedCode);

    setCurrentAction(action);
    setLoadingAction(action);
    setStatusText(STATUS_BY_ACTION[action] || "Generating response...");
    setReviewResult(null);
    setShowDiff(action === "fix");

    try {
      await streamReview(
        { language: resolvedLanguage, code: cleanedCode, question_text: question, action_type: action },
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

  return { runAction };
}
