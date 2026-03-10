function Logo() {
  return (
    <div className="flex items-center gap-3 sm:gap-4">
      <div className="relative h-11 w-11 rounded-2xl border border-cyan-300/45 bg-[linear-gradient(135deg,rgba(8,47,73,0.96),rgba(6,78,117,0.84))] shadow-[0_0_24px_rgba(34,211,238,0.22)] sm:h-12 sm:w-12">
        <div className="absolute inset-[9px] rounded-full border border-cyan-200/70" />
        <div className="absolute inset-[18px] rounded-full bg-cyan-200 shadow-[0_0_10px_rgba(103,232,249,0.9)]" />
      </div>
      <div className="min-w-0">
        <p className="logiclens-wordmark bg-gradient-to-r from-cyan-200 via-sky-300 to-blue-300 bg-clip-text text-[1.65rem] font-black leading-none text-transparent">
          LogicLens
        </p>
        <p className="logiclens-submark mt-1 text-[10px] uppercase text-slate-400 sm:text-[11px]">
          Code Intelligence
        </p>
      </div>
    </div>
  );
}

export default Logo;
