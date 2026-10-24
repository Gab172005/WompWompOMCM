import { useEffect, useState } from "react";
import { backendApi, isBrowserDemo } from "../../services/api";
import { publicSchedules } from "../../services/optimization";
import { useAppStore } from "../../store/useAppStore";
import type { PublicData } from "../../types";

export async function refreshPublishedSchedules(signal?: AbortSignal) {
  const data = await backendApi<PublicData>("/schedules", undefined, signal);
  signal?.throwIfAborted();
  useAppStore.setState({ publishedSchedules: publicSchedules(data) });
}

export function useScheduleSync() {
  const viewMode = useAppStore((s) => s.viewMode);
  const selectedDate = useAppStore((s) => s.selectedScheduleDate);
  const [error, setError] = useState("");
  useEffect(() => {
    if (isBrowserDemo() || viewMode !== "public") return;
    const controller = new AbortController();
    refreshPublishedSchedules(
      AbortSignal.any([controller.signal, AbortSignal.timeout(10000)]),
    )
      .then(() => setError(""))
      .catch(() => {
        if (controller.signal.aborted) return;
        useAppStore.setState({ publishedSchedules: {} });
        setError(
          "Published schedules are unavailable. Check the backend connection and try again.",
        );
      });
    return () => controller.abort();
  }, [viewMode, selectedDate]);
  return error;
}
