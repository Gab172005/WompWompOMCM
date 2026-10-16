export function ClinicStatus({
  progress,
  simulation,
}: {
  progress: number;
  simulation: boolean;
}) {
  return (
    <span className="badge">
      {!simulation
        ? "Proposed placement"
        : progress >= 1
          ? "Arrived at staging site"
          : progress === 0
            ? "Staged at depot"
            : "En route · simulated"}
    </span>
  );
}
