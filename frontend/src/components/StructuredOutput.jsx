import { useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";

function Section({ title, content, open, onToggle, copyText, theme }) {
  const hasContent = Array.isArray(content) ? content.length > 0 : Boolean(content);
  if (!hasContent) return null;

  const body = Array.isArray(content) ? content.map((item) => `- ${item}`).join("\n") : content;
  const shellClass = theme === "light" ? "border-2 border-slate-500 bg-white text-slate-900" : "border-slate-800 bg-slate-950/80 text-slate-100";
  const headerClass = theme === "light" ? "border-slate-400" : "border-slate-800";
  const buttonClass = theme === "light" ? "border-slate-400 text-slate-700 hover:border-slate-700 hover:text-slate-900" : "border-slate-700 text-slate-300 hover:border-cyan-400 hover:text-white";
  const proseClass = theme === "light"
    ? "prose max-w-none px-4 py-3 prose-pre:overflow-x-auto prose-pre:rounded-lg prose-pre:bg-slate-100 prose-code:text-slate-800"
    : "prose prose-invert max-w-none px-4 py-3 prose-pre:overflow-x-auto prose-pre:rounded-lg prose-pre:bg-slate-900 prose-code:text-cyan-200";

  return (
    <div className={`rounded-xl ${shellClass}`}>
      <div className={`flex items-center justify-between border-b px-4 py-3 ${headerClass}`}>
        <button className="text-left text-sm font-semibold" onClick={onToggle}>
          {title} {open ? "-" : "+"}
        </button>
        <button className={`rounded border px-2 py-1 text-xs ${buttonClass}`} onClick={() => navigator.clipboard.writeText(copyText || body)}>
          Copy
        </button>
      </div>
      {open && (
        <div className={proseClass}>
          <ReactMarkdown>{body}</ReactMarkdown>
        </div>
      )}
    </div>
  );
}

function splitHints(items) {
  const source = Array.isArray(items) ? items.join("\n\n") : String(items || "");
  const matches = source.match(/Hint\s*\d[\s\S]*?(?=Hint\s*\d|$)/gi);
  if (matches && matches.length > 0) {
    return matches.map((item) => item.trim()).filter(Boolean);
  }
  return Array.isArray(items) ? items.filter(Boolean) : [];
}

function HintStepper({ hints, theme }) {
  const [currentHintIndex, setCurrentHintIndex] = useState(0);
  const [open, setOpen] = useState(true);
  const activeHint = hints[currentHintIndex] || "";
  const shellClass = theme === "light" ? "border-2 border-slate-500 bg-white text-slate-900" : "border-slate-800 bg-slate-950/80 text-slate-100";
  const headerClass = theme === "light" ? "border-slate-400" : "border-slate-800";
  const buttonClass = theme === "light" ? "border-slate-400 text-slate-700 hover:border-slate-700 hover:text-slate-900" : "border-slate-700 text-slate-300 hover:border-cyan-400 hover:text-white";
  const proseClass = theme === "light"
    ? "prose max-w-none px-4 py-3 prose-pre:overflow-x-auto prose-pre:rounded-lg prose-pre:bg-slate-100 prose-code:text-slate-800"
    : "prose prose-invert max-w-none px-4 py-3 prose-pre:overflow-x-auto prose-pre:rounded-lg prose-pre:bg-slate-900 prose-code:text-cyan-200";

  return (
    <div className={`rounded-xl ${shellClass}`}>
      <div className={`flex items-center justify-between gap-3 border-b px-4 py-3 ${headerClass}`}>
        <div>
          <p className="text-sm font-semibold">Hint Path</p>
          <p className="text-xs opacity-70">Hint {currentHintIndex + 1} of {hints.length}</p>
        </div>
        <div className="flex items-center gap-2">
          <button className={`rounded border p-2 ${buttonClass}`} onClick={() => setCurrentHintIndex((prev) => Math.max(0, prev - 1))} disabled={currentHintIndex === 0}>
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button className={`rounded border p-2 ${buttonClass}`} onClick={() => setCurrentHintIndex((prev) => Math.min(hints.length - 1, prev + 1))} disabled={currentHintIndex === hints.length - 1}>
            <ChevronRight className="h-4 w-4" />
          </button>
          <button className={`rounded border p-2 ${buttonClass}`} onClick={() => setOpen((prev) => !prev)}>
            <ChevronDown className={`h-4 w-4 transition ${open ? "rotate-180" : ""}`} />
          </button>
        </div>
      </div>
      {open && (
        <div className={proseClass}>
          <ReactMarkdown>{activeHint}</ReactMarkdown>
        </div>
      )}
    </div>
  );
}

function getTitles(actionType) {
  if (actionType === "hint") {
    return { summary: "Approach Snapshot", bugs: "Core Gaps", improvements: "Hint Path" };
  }
  if (actionType === "complexity") {
    return { summary: "Complexity Snapshot", bugs: "Bottlenecks", improvements: "Optimization Path" };
  }
  return { summary: "Summary", bugs: "Bugs", improvements: "Improvements" };
}

function StructuredOutput({ result, expanded, onToggle, showDiff, onToggleDiff, theme = "dark", actionType = "review" }) {
  if (!result) return null;

  const shellClass = theme === "light" ? "border-2 border-slate-500 bg-white text-slate-900" : "border-slate-800 bg-slate-950/80 text-slate-100";
  const headerClass = theme === "light" ? "border-slate-400" : "border-slate-800";
  const buttonClass = theme === "light" ? "border-slate-400 text-slate-700 hover:border-slate-700 hover:text-slate-900" : "border-slate-700 text-slate-300 hover:border-cyan-400 hover:text-white";
  const codeClass = theme === "light" ? "text-slate-800" : "text-slate-200";
  const titles = getTitles(actionType);
  const hintItems = useMemo(() => (actionType === "hint" ? splitHints(result.improvements) : []), [actionType, result.improvements]);

  return (
    <div className="space-y-3">
      <Section title={titles.summary} content={result.summary} open={expanded.summary} onToggle={() => onToggle("summary")} theme={theme} />
      <Section title={titles.bugs} content={result.bugs} open={expanded.bugs} onToggle={() => onToggle("bugs")} theme={theme} />
      {actionType === "hint" && hintItems.length > 0 ? (
        <HintStepper hints={hintItems} theme={theme} />
      ) : (
        <Section title={titles.improvements} content={result.improvements} open={expanded.improvements} onToggle={() => onToggle("improvements")} theme={theme} />
      )}
      {result.corrected_code && (
        <div className={`rounded-xl ${shellClass}`}>
          <div className={`flex items-center justify-between border-b px-4 py-3 ${headerClass}`}>
            <button className="text-left text-sm font-semibold" onClick={() => onToggle("corrected_code")}>
              Corrected Code {expanded.corrected_code ? "-" : "+"}
            </button>
            <div className="flex gap-2">
              <button className={`rounded border px-2 py-1 text-xs ${buttonClass}`} onClick={() => navigator.clipboard.writeText(result.corrected_code)}>
                Copy
              </button>
              <button className={`rounded border px-2 py-1 text-xs ${buttonClass}`} onClick={onToggleDiff}>
                {showDiff ? "Hide Diff" : "Show Diff"}
              </button>
            </div>
          </div>
          {expanded.corrected_code && !showDiff && (
            <pre className={`overflow-x-auto px-4 py-3 text-sm ${codeClass}`}><code>{result.corrected_code}</code></pre>
          )}
        </div>
      )}
    </div>
  );
}

export default StructuredOutput;


