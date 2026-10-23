import type { LocatedOsmClinic, OsmClinic } from "../../../types/osmClinic";

/** Defensive map-layer gate; provenance retains records that fail this test. */
export function isDrawableOsmClinic(
  clinic: OsmClinic,
): clinic is LocatedOsmClinic {
  return (
    clinic.active &&
    clinic.inProvince &&
    (clinic.assignmentStatus === "assigned" ||
      clinic.assignmentStatus === "ambiguous") &&
    typeof clinic.lat === "number" &&
    Number.isFinite(clinic.lat) &&
    clinic.lat >= -90 &&
    clinic.lat <= 90 &&
    typeof clinic.lng === "number" &&
    Number.isFinite(clinic.lng) &&
    clinic.lng >= -180 &&
    clinic.lng <= 180
  );
}

/**
 * A plain-text description of a fixed OSM clinic for DOM (Google) popups.
 * Every value is returned as a string for `textContent`; nothing here is HTML.
 */
export interface OsmClinicPopupText {
  title: string;
  rows: string[];
  warnings: string[];
}

/** Numeric OSM id in its canonical link; constructed from validated numbers only. */
export function osmClinicLink(clinic: Pick<OsmClinic, "osmType" | "osmId">) {
  return `https://www.openstreetmap.org/${clinic.osmType}/${clinic.osmId}`;
}

/** `node/123` style reference for the given element. */
export function osmClinicReference(
  clinic: Pick<OsmClinic, "osmType" | "osmId">,
) {
  return `${clinic.osmType}/${clinic.osmId}`;
}

const ASSIGNMENT_NOTES: Record<OsmClinic["assignmentStatus"], string | null> =
  {
    assigned: null,
    ambiguous:
      "Barangay assignment is ambiguous; this record is not counted in any barangay total.",
    outside: null,
    unlocated: "No supplied location; this record is not drawn on the map.",
  };

export function osmClinicAssignmentNote(
  status: OsmClinic["assignmentStatus"],
) {
  return ASSIGNMENT_NOTES[status];
}

/**
 * Text pieces for a clinic popup. Coordinates are the Overpass center for ways
 * and relations, never the building entrance, so this never claims an entrance.
 */
export function osmClinicPopupText(
  clinic: LocatedOsmClinic,
  snapshot?: { retrievedAt?: string | null } | null,
): OsmClinicPopupText {
  const rows = [
    `OpenStreetMap ${osmClinicReference(clinic)} · ${clinic.active ? "active clinic record" : "inactive lifecycle record (not counted)"}`,
    clinic.inProvince
      ? "Inside the Laguna study boundary"
      : "Outside the Laguna study boundary",
    clinic.locationMethod === "node"
      ? "Placed at the mapped node"
      : "Placed at the Overpass bounding-box center of the element, not its entrance",
  ];
  // Supplied OSM tags, shown as text only. No name matching or inferred values.
  const operator = clinic.tags.operator ?? clinic.tags["operator:short"];
  if (operator) rows.push(`Operator (OSM tag): ${operator}`);
  const speciality = clinic.tags["healthcare:speciality"];
  if (speciality) rows.push(`Healthcare speciality (OSM tag): ${speciality}`);
  if (clinic.tags.healthcare)
    rows.push(`Healthcare type (OSM tag): ${clinic.tags.healthcare}`);
  const lifecycle = Object.entries(clinic.tags)
    .filter(
      ([key, value]) =>
        /^(disused|abandoned|demolished|construction|proposed|was):(amenity|healthcare)$/.test(
          key,
        ) && value === "clinic",
    )
    .map(([key]) => key);
  if (lifecycle.length)
    rows.push(`Inactive OSM lifecycle tags: ${lifecycle.join(", ")}`);
  rows.push(
    "Reference only; no deployment, route, approved schedule, or publication is implied.",
  );
  const assignment = osmClinicAssignmentNote(clinic.assignmentStatus);
  if (assignment) rows.push(assignment);
  rows.push(
    snapshot?.retrievedAt
      ? `Offline snapshot retrieved ${snapshot.retrievedAt}; not a live query.`
      : "Offline snapshot; not a live query.",
  );
  const warnings = [...clinic.warnings];
  if (clinic.assignmentStatus === "ambiguous")
    warnings.push("Excluded from barangay clinic counts.");
  return {
    title: clinic.name || "Unnamed clinic",
    rows,
    warnings: warnings.filter(
      (warning, index) => warnings.indexOf(warning) === index,
    ),
  };
}
