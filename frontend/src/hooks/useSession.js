import { useEffect, useRef } from "react";

import { getMe, invalidateApiCache } from "../api";

export function useSession({ setUser, setAuthLoading, setShowAuth }) {
  const gateTimerRef = useRef(null);

  useEffect(() => {
    const fetchCurrentUser = async () => {
      if (!localStorage.getItem("token")) {
        setUser(null);
        setAuthLoading(false);
        return;
      }

      setAuthLoading(true);
      try {
        const res = await getMe();
        setUser(res.data);
      } catch {
        localStorage.removeItem("token");
        invalidateApiCache("all");
        setUser(null);
        setShowAuth(true);
      } finally {
        setAuthLoading(false);
      }
    };

    fetchCurrentUser();
  }, [setAuthLoading, setShowAuth, setUser]);

  return gateTimerRef;
}

