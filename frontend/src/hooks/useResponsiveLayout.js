import { useEffect } from "react";

export function useResponsiveLayout({ leftPanelWidth, isResizingPanels, setIsDesktopLayout, setIsMobileLayout, setLeftPanelWidth, setIsResizingPanels, workspaceRef, storageKey }) {
  useEffect(() => {
    const desktopQuery = window.matchMedia("(min-width: 1024px)");
    const mobileQuery = window.matchMedia("(max-width: 639px)");
    const syncDesktop = (event) => setIsDesktopLayout(event.matches);
    const syncMobile = (event) => setIsMobileLayout(event.matches);
    setIsDesktopLayout(desktopQuery.matches);
    setIsMobileLayout(mobileQuery.matches);
    desktopQuery.addEventListener("change", syncDesktop);
    mobileQuery.addEventListener("change", syncMobile);
    return () => {
      desktopQuery.removeEventListener("change", syncDesktop);
      mobileQuery.removeEventListener("change", syncMobile);
    };
  }, [setIsDesktopLayout, setIsMobileLayout]);

  useEffect(() => {
    localStorage.setItem(storageKey, String(leftPanelWidth));
  }, [leftPanelWidth, storageKey]);

  useEffect(() => {
    if (!isResizingPanels) return;

    const handleMouseMove = (event) => {
      if (!workspaceRef.current) return;
      const bounds = workspaceRef.current.getBoundingClientRect();
      const nextWidth = ((event.clientX - bounds.left) / bounds.width) * 100;
      const clampedWidth = Math.max(38, Math.min(68, nextWidth));
      setLeftPanelWidth(clampedWidth);
    };

    const handleMouseUp = () => {
      setIsResizingPanels(false);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp, { once: true });
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isResizingPanels, setIsResizingPanels, setLeftPanelWidth, workspaceRef]);
}

