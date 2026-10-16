import { useEffect } from "react";
import { useAppStore } from "../../store/useAppStore";
export function useClinicAnimation() {
  const { isPlaying, playbackSpeed, panel } = useAppStore();
  useEffect(() => {
    if (!isPlaying || panel !== "simulation") return;
    let frame: number, previous: number | undefined;
    function tick(now: number) {
      const elapsed =
        previous === undefined ? 0 : Math.min((now - previous) / 1000, 0.25);
      previous = now;
      const progress = Math.min(
        1,
        useAppStore.getState().progress + (elapsed / 12) * playbackSpeed,
      );
      useAppStore.setState({ progress, isPlaying: progress < 1 });
      if (progress < 1) frame = requestAnimationFrame(tick);
    }
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [isPlaying, playbackSpeed, panel]);
}
