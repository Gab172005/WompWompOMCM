const fieldLabels: Record<string, string> = {
  clinic_count: "Number of clinics",
  capacity: "Appointments per clinic per day",
  max_travel_minutes: "Maximum travel time",
  weights: "Planning factor weights",
  manual_sites: "Clinic locations",
  eligible_sites: "Available clinic locations",
  flooded_sites: "Locations affected by flooding",
  closed_roads: "Road closures",
  outbreak_multiplier: "Sample illness increase",
  municipality_outbreak_multipliers: "Municipality illness increase",
  municipality_flood_levels: "Municipality flood levels",
  start_time: "Opening time",
  end_time: "Closing time",
  deployment_date: "Schedule date",
  services: "Services offered",
  notice: "Public emergency notice",
  confirmed: "Emergency change confirmation",
  geojson: "Boundary file",
  messages: "Your message",
};

/** Keep actionable business rules, while replacing internal request details. */
export function requestFeedback(
  path: string,
  status: number,
  detail: unknown,
): string {
  if (status === 401)
    return "We could not verify your sign-in. Check your username and password, then sign in again.";
  if (status === 403)
    return "You do not have permission to make this change. Contact your system administrator if you need access.";
  if (Array.isArray(detail)) {
    const fields = [
      ...new Set(
        detail.flatMap((issue: unknown) => {
          if (
            !issue ||
            typeof issue !== "object" ||
            !("loc" in issue) ||
            !Array.isArray(issue.loc)
          )
            return [];
          return issue.loc.flatMap((part: unknown) =>
            typeof part === "string" && fieldLabels[part]
              ? [fieldLabels[part]]
              : [],
          );
        }),
      ),
    ];
    return fields.length
      ? `Please check: ${fields.join(", ")}. Review the allowed values shown beside these fields, then try again.`
      : "Some information is missing or outside the allowed range. Review your entries and try again.";
  }
  if (typeof detail === "string") {
    if (
      /no feasible allocation|insufficient candidate|infeasible allocation/i.test(
        detail,
      )
    )
      return "We could not find locations for this plan. Try fewer clinics, review the available sites, or increase the allowed travel time.";
    if (/manual sites must/i.test(detail))
      return "Choose available locations outside the sample flood restrictions, up to the number of clinics you have.";
    if (/end time must/i.test(detail))
      return "Choose a closing time later than the opening time.";
    if (/at least one.*weight.*positive/i.test(detail))
      return "Give at least one planning factor a weight above zero.";
    if (/Google Routes/i.test(detail))
      return "Driving directions are unavailable. Ask your system administrator to check the route service, then try again.";
    if (/administrator access is disabled/i.test(detail))
      return "Administrator access is unavailable. Ask your system administrator to enable sign-in.";
    // Preserve specific schedule safeguards instead of hiding why approval failed.
    if (
      /schedule|approval|publish|draft plan|emergency/i.test(detail) &&
      !/Traceback|Error:|\bAPI\b/.test(detail)
    )
      return detail;
  }
  if (status === 422)
    return "We could not use these settings. Check your selections and available locations, then try again.";
  if (path === "/simulate")
    return "We could not calculate this practice scenario. Please try again. If the problem continues, contact your system administrator.";
  if (path === "/optimize" || path === "/planning/optimize")
    return "We could not calculate clinic suggestions. Please try again. If the problem continues, contact your system administrator.";
  if (path === "/chat")
    return "Planning help is unavailable right now. Please try again.";
  return "We could not complete this request. Please try again. If the problem continues, contact your system administrator.";
}
