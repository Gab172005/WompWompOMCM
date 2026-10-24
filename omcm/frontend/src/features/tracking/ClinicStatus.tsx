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
          ? "Arrived at clinic location (simulated)"
          : progress === 0
            ? "At starting point (simulated)"
            : "On the way (simulated)"}
    </span>
  );
}
