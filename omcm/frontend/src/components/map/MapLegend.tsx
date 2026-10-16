interface MapLegendProps {
  activeMetric: "score" | "density" | "flood" | "morbidity";
}

export function MapLegend({ activeMetric }: MapLegendProps) {
  const legendConfig = {
    score: {
      title: "Healthcare Need Score",
      unit: "Index (0–100)",
      steps: [
        { label: "Critical (70+)", color: "#7f1d1d" },
        { label: "High (50–69)", color: "#b91c1c" },
        { label: "Moderate (35–49)", color: "#ef4444" },
        { label: "Low (20–34)", color: "#f87171" },
        { label: "Minimal (<20)", color: "#fee2e2" },
      ],
    },
    density: {
      title: "Population Density",
      unit: "Residents / km²",
      steps: [
        { label: "Very High (8,000+)", color: "#4c1d95" },
        { label: "Dense (4,000–7,999)", color: "#6d28d9" },
        { label: "Moderate (1,500–3,999)", color: "#8b5cf6" },
        { label: "Low (500–1,499)", color: "#c4b5fd" },
        { label: "Rural (<500)", color: "#ede9fe" },
      ],
    },
    flood: {
      title: "Flood Hazard Exposure",
      unit: "Vulnerability Index (0–100)",
      steps: [
        { label: "Severe (70+)", color: "#075985" },
        { label: "High (50–69)", color: "#0284c7" },
        { label: "Moderate (35–49)", color: "#38bdf8" },
        { label: "Low (20–34)", color: "#7dd3fc" },
        { label: "Minimal (<20)", color: "#e0f2fe" },
      ],
    },
    morbidity: {
      title: "Disease Morbidity Rate",
      unit: "Cases per 1,000 Residents",
      steps: [
        { label: "Outbreak (70+)", color: "#78350f" },
        { label: "Severe (50–69)", color: "#b45309" },
        { label: "High (35–49)", color: "#d97706" },
        { label: "Moderate (25–34)", color: "#f59e0b" },
        { label: "Baseline (<25)", color: "#fef3c7" },
      ],
    },
  };

  const current = legendConfig[activeMetric];

  return (
    <div className="absolute bottom-4 left-4 z-20 bg-slate-900/95 backdrop-blur-xl border border-slate-700/80 rounded-2xl p-3 shadow-2xl pointer-events-auto text-slate-100 max-w-xs">
      <div className="flex items-center justify-between gap-3 mb-1.5">
        <span className="text-[11px] font-bold tracking-tight text-white">{current.title}</span>
        <span className="text-[10px] text-slate-400 font-mono">{current.unit}</span>
      </div>

      {/* Color Bar Gradient */}
      <div className="flex h-2.5 w-full rounded-md overflow-hidden border border-slate-700/80 my-2">
        {[...current.steps].reverse().map((step, idx) => (
          <div key={idx} className="flex-1 h-full" style={{ backgroundColor: step.color }} />
        ))}
      </div>

      {/* Threshold Labels */}
      <div className="space-y-1">
        {current.steps.map((step, idx) => (
          <div key={idx} className="flex items-center gap-2 text-[10px] text-slate-300">
            <span
              className="w-2.5 h-2.5 rounded-full shrink-0 border border-slate-600"
              style={{ backgroundColor: step.color }}
            />
            <span className="truncate">{step.label}</span>
          </div>
        ))}
      </div>

      <div className="mt-2 pt-1.5 border-t border-slate-800 text-[10px] text-slate-400 font-medium">
        Geographic Scope: Laguna Province Only
      </div>
    </div>
  );
}
