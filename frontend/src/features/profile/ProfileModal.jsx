import { useEffect, useRef, useState } from "react";

function ProfileModal({ theme, showProfile, setShowProfile, profileName, setProfileName, user, profileMessage, updateProfileName, profileLoading, PencilLine }) {
  const [isEditing, setIsEditing] = useState(false);
  const inputRef = useRef(null);
  const EditIcon = PencilLine;
  const messageClass = profileMessage.toLowerCase().includes("success") || profileMessage.toLowerCase().includes("updated")
    ? "text-emerald-500"
    : "text-rose-400";

  useEffect(() => {
    if (showProfile && isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [showProfile, isEditing]);

  if (!showProfile) return null;

  const openEditor = () => setIsEditing(true);
  const closeModal = () => {
    setIsEditing(false);
    setShowProfile(false);
  };
  const handleSave = async () => {
    const saved = await updateProfileName();
    if (saved) {
      setIsEditing(false);
    }
  };

  return (
    <div className="logiclens-modal fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={closeModal}>
      <div className={`logiclens-modal-card w-full max-w-sm rounded-xl border p-5 ${theme === "light" ? "border-stone-300 bg-white text-slate-900" : "border-slate-700 bg-slate-900 text-slate-100"}`} onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold">My Profile</h3>
          <button
            type="button"
            onClick={openEditor}
            className={`rounded-lg border p-2 transition ${theme === "light" ? "border-stone-300 bg-stone-50 text-slate-700 hover:bg-stone-100" : "border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700"}`}
            aria-label="Edit display name"
          >
            <EditIcon className="h-4 w-4" />
          </button>
        </div>

        <label className="mb-2 block text-xs uppercase tracking-[0.18em] opacity-70">Display name</label>
        <div className="flex gap-2">
          <input
            ref={inputRef}
            value={profileName}
            disabled={!isEditing || profileLoading}
            onChange={(e) => setProfileName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && isEditing && !profileLoading) {
                e.preventDefault();
                handleSave();
              }
            }}
            className={`mb-3 w-full rounded border p-3 text-sm ${theme === "light" ? "border-stone-300 bg-white" : "border-slate-700 bg-slate-800"} ${!isEditing ? "cursor-not-allowed opacity-70" : ""}`}
          />
          {!isEditing ? null : (
            <button
              type="button"
              onClick={handleSave}
              disabled={profileLoading}
              className="mb-3 rounded bg-cyan-500 px-3 py-2 text-sm font-medium text-slate-950 hover:bg-cyan-400 disabled:opacity-60"
            >
              {profileLoading ? "Saving..." : "Save"}
            </button>
          )}
        </div>

        <p className="text-sm opacity-80">Email: {user?.email || "-"}</p>
        <p className="mt-2 text-xs opacity-65">Click the pencil to edit your display name.</p>
        {profileMessage && <p className={`mt-3 text-sm ${messageClass}`}>{profileMessage}</p>}
        <div className="mt-5 flex gap-2">
          <button className={`rounded px-3 py-2 text-sm ${theme === "light" ? "bg-stone-100 hover:bg-stone-200" : "bg-slate-800 hover:bg-slate-700"}`} onClick={closeModal}>Close</button>
        </div>
      </div>
    </div>
  );
}

export default ProfileModal;


