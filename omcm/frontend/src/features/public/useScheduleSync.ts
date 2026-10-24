import { useEffect } from "react";
import { isBrowserDemo } from "../../services/api";
import { useAppStore } from "../../store/useAppStore";
import { usePublicScheduleStore } from "../../store/usePublicScheduleStore";

export const PUBLIC_REFRESH_MS = 30000;

export function useScheduleSync() {
  const viewMode = useAppStore((s) => s.viewMode);
  const { error, lastSynced, refresh, cancel } = usePublicScheduleStore();
  useEffect(() => {
    if (isBrowserDemo() || viewMode !== "public") return;
    const update = () => {
      if (!document.hidden) void refresh();
    };
    update();
    const timer = window.setInterval(update, PUBLIC_REFRESH_MS);
    window.addEventListener("focus", update);
    window.addEventListener("online", update);
    document.addEventListener("visibilitychange", update);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", update);
      window.removeEventListener("online", update);
      document.removeEventListener("visibilitychange", update);
      cancel();
    };
  }, [viewMode, refresh, cancel]);
  return error
    ? `${error}${lastSynced ? " Showing the last confirmed published schedule." : " Please retry when connected."}`
    : "";
}
