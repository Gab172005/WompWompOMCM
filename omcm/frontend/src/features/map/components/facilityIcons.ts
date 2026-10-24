/** Shared SVG artwork for both map renderers and their legends. */
export function mobileClinicSvg(
  number?: number,
  variant: "active" | "selected" | "recommended" = "active",
) {
  const color = {
    active: "#059669",
    selected: "#102c43",
    recommended: "#7c3aed",
  }[variant];
  // Only a numeric index enters this HTML; facility names are rendered as text.
  const badge = Number.isInteger(number)
    ? `<circle cx="31" cy="8" r="8" fill="white" stroke="${color}" stroke-width="1.5"/><text x="31" y="11.5" text-anchor="middle" font-family="sans-serif" font-size="10" font-weight="700" fill="${color}">${number}</text>`
    : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="36" viewBox="0 0 40 36"><rect x="2" y="4" width="30" height="30" rx="8" fill="${color}" stroke="white" stroke-width="2"/><g transform="translate(5 7)" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m5 8 2-5h10l2 5M5 8h14l2 3v7H3v-7ZM5 18v3m14-3v3M3 12h18"/><path d="M6 15h2m8 0h2"/></g>${badge}</svg>`;
}

export const clinicMarkerSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" viewBox="0 0 30 30"><rect x="1" y="1" width="28" height="28" rx="6" fill="#7c3aed" stroke="white" stroke-width="2"/><g fill="none" stroke="white" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M7 25V9h16v16ZM11 9V5h8v4M12 25v-6h6v6M13 13h4m-2-2v4M6 25h18"/><path d="M10 17h.01M20 17h.01"/></g></svg>`;

export const hospitalMarkerSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><rect x="1" y="1" width="30" height="30" rx="7" fill="#dc2626" stroke="white" stroke-width="2"/><g fill="none" stroke="white" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M10 26V6h12v20M10 14H5v12h22V14h-5M14 10h4m-2-2v4M14 26v-6h4v6M14 16h4M7.5 18v1m0 3v1m17-5v1m0 3v1"/></g></svg>`;

export function svgDataUrl(svg: string) {
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}
