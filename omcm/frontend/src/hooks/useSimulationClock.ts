import { useEffect, useState } from "react";
export function useSimulationClock(duration: number) {
  const [elapsed, setElapsed] = useState(0),
    [playing, setPlaying] = useState(false),
    [speed, setSpeed] = useState(20);
  useEffect(() => {
    if (!playing || duration <= 0) return;
    let frame = 0,
      previous = performance.now();
    const tick = (now: number) => {
      const delta = Math.min((now - previous) / 1000, 0.25);
      previous = now;
      setElapsed((t) => Math.min(duration, t + delta * speed));
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing, speed, duration]);
  useEffect(() => {
    if (elapsed >= duration && playing) setPlaying(false);
  }, [elapsed, duration, playing]);
  return {
    elapsed,
    playing,
    speed,
    setSpeed,
    play: () => {
      if (duration > 0) {
        setElapsed((t) => (t >= duration ? 0 : t));
        setPlaying(true);
      }
    },
    pause: () => setPlaying(false),
    reset: () => {
      setPlaying(false);
      setElapsed(0);
    },
    seek: (seconds: number) =>
      setElapsed(Math.max(0, Math.min(duration, seconds))),
  };
}
