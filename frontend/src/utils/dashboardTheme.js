export function getDashboardThemeClasses(theme) {
  if (theme === "light") {
    return {
      appClass: "bg-[#edf4fb] text-slate-900",
      backdropClass: "bg-[radial-gradient(circle_at_12%_14%,rgba(56,189,248,0.18),transparent_36%),radial-gradient(circle_at_82%_10%,rgba(16,185,129,0.12),transparent_38%),linear-gradient(180deg,rgba(248,251,255,0.92),rgba(237,244,251,0.72))]",
      shellClass: "bg-[#f4f7fb]/95 text-slate-900 border-2 border-slate-500 shadow-[0_10px_30px_rgba(15,23,42,0.08)]",
      panelClass: "bg-white/88 border-2 border-slate-400 text-slate-900 shadow-[0_24px_60px_rgba(15,23,42,0.08)]",
      surfaceClass: "bg-[#f8fafc] border-2 border-slate-400",
      bannerClass: "border-slate-400 bg-gradient-to-r from-slate-100 via-white to-blue-50 text-slate-800",
    };
  }

  return {
    appClass: "bg-slate-950 text-slate-100",
    backdropClass: "bg-[radial-gradient(circle_at_12%_16%,rgba(34,211,238,0.16),transparent_40%),radial-gradient(circle_at_88%_8%,rgba(59,130,246,0.14),transparent_42%)]",
    shellClass: "bg-slate-900/70 text-slate-100 border-slate-800",
    panelClass: "bg-slate-900/70 border-slate-800 text-slate-100",
    surfaceClass: "bg-slate-950 border-slate-800",
    bannerClass: "border-cyan-400/25 bg-cyan-400/10 text-cyan-100",
  };
}
