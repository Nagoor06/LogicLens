function Logo({ theme = "dark" }) {
  const markClass = theme === "light"
    ? "border-sky-300/70 bg-gradient-to-br from-sky-100 via-cyan-50 to-emerald-100 shadow-[0_0_20px_rgba(14,165,233,0.18)]"
    : "border-cyan-300/40 bg-gradient-to-br from-cyan-400/25 to-blue-500/20 shadow-[0_0_20px_rgba(34,211,238,0.25)]";
  const ringClass = theme === "light" ? "border-sky-500/60" : "border-cyan-300/60";
  const dotClass = theme === "light" ? "bg-sky-600" : "bg-cyan-300";
  const wordmarkClass = theme === "light"
    ? "bg-gradient-to-r from-sky-700 via-cyan-700 to-emerald-700"
    : "bg-gradient-to-r from-cyan-300 via-sky-300 to-blue-400";
  const metaClass = theme === "light" ? "text-slate-500" : "text-slate-400";

  return (
    <div className="flex items-center gap-3">
      <div className={`relative h-9 w-9 rounded-xl border ${markClass}`}>
        <div className={`absolute inset-2 rounded-full border ${ringClass}`} />
        <div className={`absolute inset-[14px] rounded-full ${dotClass}`} />
      </div>
      <div>
        <p className={`bg-clip-text text-lg font-extrabold tracking-tight text-transparent ${wordmarkClass}`}>
          LogicLens
        </p>
        <p className={`text-[10px] uppercase tracking-[0.2em] ${metaClass}`}>Code Intelligence</p>
      </div>
    </div>
  );
}

export default Logo;
