function PasswordModal({ theme, showPasswordModal, setShowPasswordModal, pwdForm, setPwdForm, pwdMessage, submitPasswordChange, pwdLoading }) {
  if (!showPasswordModal) return null;

  return (
    <div className="logiclens-modal fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setShowPasswordModal(false)}>
      <div className={`logiclens-modal-card w-full max-w-md rounded-xl border p-5 ${theme === "light" ? "border-slate-300 bg-white text-slate-900" : "border-slate-700 bg-slate-900 text-slate-100"}`} onClick={(e) => e.stopPropagation()}>
        <h3 className="mb-4 text-lg font-semibold">Change Password</h3>
        <input type="password" placeholder="Current password" value={pwdForm.current_password} onChange={(e) => setPwdForm((prev) => ({ ...prev, current_password: e.target.value }))} className={`mb-3 w-full rounded border p-3 text-sm ${theme === "light" ? "border-slate-300 bg-white" : "border-slate-700 bg-slate-800"}`} />
        <input type="password" placeholder="New password" value={pwdForm.new_password} onChange={(e) => setPwdForm((prev) => ({ ...prev, new_password: e.target.value }))} className={`mb-3 w-full rounded border p-3 text-sm ${theme === "light" ? "border-slate-300 bg-white" : "border-slate-700 bg-slate-800"}`} />
        <input type="password" placeholder="Confirm new password" value={pwdForm.confirm_new_password} onChange={(e) => setPwdForm((prev) => ({ ...prev, confirm_new_password: e.target.value }))} className={`mb-3 w-full rounded border p-3 text-sm ${theme === "light" ? "border-slate-300 bg-white" : "border-slate-700 bg-slate-800"}`} />
        {pwdMessage && <p className="mb-3 text-sm text-cyan-400">{pwdMessage}</p>}
        <div className="flex gap-2">
          <button onClick={submitPasswordChange} disabled={pwdLoading} className="flex items-center gap-2 rounded bg-cyan-500 px-3 py-2 text-sm font-medium text-slate-950 hover:bg-cyan-400 disabled:opacity-60">
            {pwdLoading && <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-700 border-t-transparent" />}
            Update
          </button>
          <button className={`rounded px-3 py-2 text-sm ${theme === "light" ? "bg-slate-100 hover:bg-slate-200" : "bg-slate-800 hover:bg-slate-700"}`} onClick={() => setShowPasswordModal(false)}>Close</button>
        </div>
      </div>
    </div>
  );
}

export default PasswordModal;
