import { useEffect, useRef, useState } from "react";
import { RotateCcw } from "lucide-react";
import { Modal } from "../../components/ui/Modal";
import { useAppStore } from "../../store/useAppStore";
import { useForecastStore } from "../../store/useForecastStore";

type Runs = ReturnType<typeof useForecastStore.getState>["runs"];

export function SimulationResetControl() {
  const simulation = useForecastStore();
  const [reviewing, setReviewing] = useState(false);
  const [resetRuns, setResetRuns] = useState<Runs | null>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const reached = Math.max(
    ...Object.values(simulation.runs).map((run) => run.reached),
  );

  useEffect(() => {
    if (!resetRuns) return;
    const body = trigger.current?.closest<HTMLElement>(".workspace-panel-body");
    body
      ?.querySelector<HTMLButtonElement>(
        ".simulation-scenario-card[aria-pressed='true']",
      )
      ?.focus({ preventScroll: true });
    if (body) body.scrollTop = 0;
  }, [resetRuns]);

  return (
    <>
      <div className="simulation-reset-entry">
        <div>
          <strong>Start a fresh comparison</strong>
          <p>Clear simulation clinics and history.</p>
        </div>
        <button
          ref={trigger}
          type="button"
          className="simulation-reset-button"
          aria-label="Reset 30-day simulation"
          aria-haspopup="dialog"
          onClick={() => {
            useForecastStore.setState({ playing: false });
            setResetRuns(null);
            setReviewing(true);
          }}
        >
          <RotateCcw size={15} aria-hidden="true" />
          Reset simulation
        </button>
      </div>
      {resetRuns === simulation.runs && (
        <p className="simulation-reset-feedback" role="status">
          Simulation reset. All three scenarios are back at Day 1 with no
          clinics deployed.
        </p>
      )}
      {reviewing && (
        <Modal
          title="Reset 30-day simulation?"
          onClose={() => setReviewing(false)}
        >
          <div className="simulation-reset-review">
            <div className="simulation-reset-review-heading">
              <span>
                <RotateCcw size={21} aria-hidden="true" />
              </span>
              <div>
                <h3>Restart all three scenarios</h3>
                <p>Playback is paused while you review this.</p>
              </div>
            </div>
            <p>
              This clears clinic placements, draft locations, recommendations
              and activity history through Day {reached}. Every scenario returns
              to Day 1.
            </p>
            <div className="simulation-reset-kept">
              <strong>Your settings are kept</strong>
              <p>
                {simulation.k} {simulation.k === 1 ? "clinic" : "clinics"} ·
                Current planning conditions · Selected scenario and map colors ·{" "}
                {simulation.speed}× playback
              </p>
            </div>
            <p className="workspace-note">
              Reset affects this simulation only. Published visits and
              clinic-planning drafts stay as they are.
            </p>
            <div className="simulation-reset-actions">
              <button
                type="button"
                className="secondary"
                onClick={() => setReviewing(false)}
              >
                Keep this run
              </button>
              <button
                type="button"
                className="primary simulation-reset-confirm"
                onClick={() => {
                  useForecastStore.getState().reset();
                  useAppStore.setState({ isPlaying: false });
                  setResetRuns(useForecastStore.getState().runs);
                  setReviewing(false);
                }}
              >
                <RotateCcw size={16} aria-hidden="true" />
                Reset all scenarios
              </button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
