/** Display wording only; scoring and map thresholds remain unchanged. */
export function needLevel(score: number): string {
  if (score >= 70) return "Very high estimated need";
  if (score >= 50) return "High estimated need";
  if (score >= 35) return "Moderate estimated need";
  if (score >= 20) return "Lower estimated need";
  return "Low estimated need";
}

export function ordinal(value: number): string {
  const remainder = value % 100;
  const suffix =
    remainder >= 11 && remainder <= 13
      ? "th"
      : ({ 1: "st", 2: "nd", 3: "rd" }[value % 10] ?? "th");
  return `${value}${suffix}`;
}

export const simulationMetricLabels = {
  hni: "Expected healthcare need",
  uhni: "Healthcare needs not yet covered",
};

export const planningFactorLabels: Record<string, string> = {
  population: "Number of residents",
  disease: "Sample illness rate",
  vulnerability: "Children and older residents",
  accessibility: "Difficulty reaching a hospital",
  poverty: "Poverty",
  flood: "Sample flood exposure",
};
