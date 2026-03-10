import { useEffect } from "react";

export function useWorkspaceDraft({ draftKey, draftHydrated, code, question, language, setCode, setQuestion, setLanguage, setDraftHydrated }) {
  useEffect(() => {
    try {
      const draft = JSON.parse(localStorage.getItem(draftKey) || "{}");
      if (typeof draft.code === "string") setCode(draft.code);
      if (typeof draft.question === "string") setQuestion(draft.question);
      if (typeof draft.language === "string") setLanguage(draft.language);
    } catch {
      localStorage.removeItem(draftKey);
    } finally {
      setDraftHydrated(true);
    }
  }, [draftKey, setCode, setDraftHydrated, setLanguage, setQuestion]);

  useEffect(() => {
    if (!draftHydrated) return;
    localStorage.setItem(draftKey, JSON.stringify({ code, question, language }));
  }, [draftHydrated, draftKey, code, question, language]);
}
