import { Copy } from "lucide-react";
import { DiffEditor } from "@monaco-editor/react";

import StructuredOutput from "./StructuredOutput";

function ReviewWorkspace({
  theme,
  panelClass,
  surfaceClass,
  isDesktopLayout,
  leftPanelWidth,
  reviewResult,
  buildCopyText,
  isLoggedIn,
  openHistory,
  isSessionPending,
  loadingAction,
  authLoading,
  sessionLoading,
  statusText,
  expanded,
  toggleExpanded,
  showDiff,
  setShowDiff,
  code,
  sanitizeCodeInput,
  editorLanguage,
  currentAction,
}) {
  return (
    <section style={isDesktopLayout ? { flexBasis: `${100 - leftPanelWidth}%` } : undefined} className={`logiclens-panel rounded-2xl border p-3 sm:p-4 backdrop-blur ${panelClass} min-h-[560px] lg:h-[760px] min-w-0 flex flex-col lg:flex-none`}>
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="font-medium">Review Studio</h2>
        <div className="flex flex-wrap gap-2">
          {reviewResult && <button className={`rounded-lg border px-3 py-1 text-xs ${theme === "light" ? "border-slate-500 bg-white text-slate-800" : "border-slate-700 bg-slate-900 text-slate-200"}`} onClick={() => navigator.clipboard.writeText(buildCopyText(reviewResult))}><Copy className="mr-1 inline h-3.5 w-3.5" />Copy All</button>}
          {isLoggedIn && <button className={`rounded-lg border px-3 py-1 text-xs ${theme === "light" ? "border-slate-500 bg-white text-slate-800" : "border-slate-700 bg-slate-900 text-slate-200"}`} onClick={openHistory}>Open History</button>}
        </div>
      </div>

      <div className={`flex-1 overflow-y-auto rounded-xl border p-4 text-sm ${surfaceClass}`}>
        {isSessionPending ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-center"><span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-500 border-t-cyan-300" /><div><p className="font-medium">Restoring your workspace...</p><p className="mt-1 text-xs opacity-70">Checking your session.</p></div></div>
        ) : !isLoggedIn ? (
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
  );
}

export default ReviewWorkspace;

