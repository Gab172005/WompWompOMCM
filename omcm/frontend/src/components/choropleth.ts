
export const riskScale = [
  { label: "Very Low", min: 0, color: "#FEE5E5", range: "0–<15" },
  { label: "Low", min: 15, color: "#FCBABA", range: "15–<30" },
  { label: "Moderate", min: 30, color: "#F87171", range: "30–<50" },
  { label: "High", min: 50, color: "#DC2626", range: "50–<70" },
  { label: "Critical", min: 70, color: "#7F1D1D", range: "70–100" },
];
export function riskColor(value: number | undefined) {
  if (value == null || !Number.isFinite(value)) return "#D1D5DB";
  return [...riskScale].reverse().find((step) => value >= step.min)?.color ?? riskScale[0].color;
}
