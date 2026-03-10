export const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{8,}$/;
export const FAVORITES_KEY = "logiclens:favorites";
export const THEME_KEY = "logiclens:theme";
export const WORKSPACE_DRAFT_KEY = "logiclens:workspace-draft";
export const PANEL_WIDTH_KEY = "logiclens:left-panel-width";

export const STATUS_BY_ACTION = {
  review: "Analyzing code...",
  hint: "Generating hints...",
  complexity: "Calculating complexity...",
  fix: "Generating corrected code...",
};

export function normalizeErrorDetail(detail) {
  if (!detail) return "Request failed";
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    return detail.map((item) => (typeof item === "string" ? item : item?.msg || "Validation error")).join(" | ");
  }
  if (typeof detail === "object") return detail?.msg || JSON.stringify(detail);
  return "Request failed";
}

export function normalizeResult(result, actionType = "review") {
  if (!result) return null;
  return {
    summary: result.summary || "",
    bugs: Array.isArray(result.bugs) ? result.bugs : result.issues || [],
    improvements: Array.isArray(result.improvements) ? result.improvements : result.suggestions || [],
    corrected_code: actionType === "fix" && typeof result.corrected_code === "string" ? result.corrected_code : "",
  };
}

export function sanitizeCodeInput(raw) {
  let text = (raw || "").replace(/\r\n/g, "\n").trim();
  const fenceMatch = text.match(/^```[a-zA-Z0-9+#-]*\n([\s\S]*?)\n```$/);
  if (fenceMatch) text = fenceMatch[1].trim();

  const lines = text.split("\n");
  if (lines.length > 0 && ["py", "python"].includes(lines[0].trim().toLowerCase())) {
    lines.shift();
    text = lines.join("\n").trim();
  }

  return text;
}

export function detectLanguageFromCode(code) {
  const src = code || "";
  if (/^\s*#include\s*</m.test(src) || /\bstd::|\bcout\b|\bvector\s*</.test(src)) return "cpp";
  if (/\bconsole\.log\b|\bfunction\b|=>/.test(src)) return "javascript";
  if (/\bpublic\s+static\s+void\s+main\b|\bclass\s+\w+\s*\{/.test(src)) return "java";
  if (/\bdef\s+\w+\s*\(|\bimport\s+\w+/.test(src)) return "python";
  if (/\bfunc\s+\w+\s*\(|\bpackage\s+main\b/.test(src)) return "go";
  if (/\bfn\s+main\s*\(|\blet\s+mut\b/.test(src)) return "rust";
  if (/\busing\s+System\b|\bnamespace\s+\w+/.test(src)) return "csharp";
  if (/interface\s+\w+|type\s+\w+\s*=|:\s*(string|number|boolean)\b/.test(src)) return "typescript";
  return "plaintext";
}

export function buildCopyText(result) {
  if (!result) return "";
  return [
    `Summary\n${result.summary}`,
    `Bugs\n${result.bugs.join("\n")}`,
    `Improvements\n${result.improvements.join("\n")}`,
    result.corrected_code ? `Corrected Code\n${result.corrected_code}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");
}
