import Editor from "@monaco-editor/react";

function EditorWorkspace({ theme, panelClass, isDesktopLayout, leftPanelWidth, language, setLanguage, detectedLanguage, editorLanguage, isMobileLayout, code, setCode, question, setQuestion }) {
  return (
    <section style={isDesktopLayout ? { flexBasis: `${leftPanelWidth}%` } : undefined} className={`logiclens-panel rounded-2xl border p-3 sm:p-4 backdrop-blur ${panelClass} min-h-[680px] lg:h-[820px] min-w-0 flex flex-col lg:flex-none`}>
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

      <div className={`h-[420px] sm:h-[500px] lg:h-auto lg:flex-1 overflow-hidden rounded-xl border ${theme === "light" ? "border-2 border-slate-500" : "border-slate-800"}`}>
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
  );
}

export default EditorWorkspace;

