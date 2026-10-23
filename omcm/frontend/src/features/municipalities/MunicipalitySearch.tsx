import { useEffect, useId, useRef, useState } from "react";
import { MapPin, Search, X } from "lucide-react";
import { LAGUNA_BASE_DATA } from "../../services/lagunaData";
import { useAppStore } from "../../store/useAppStore";
import { LAGUNA_BARANGAYS } from "../../services/providedData";
const towns = [...LAGUNA_BASE_DATA].sort((a, b) =>
  a.name.localeCompare(b.name),
);
const communities = LAGUNA_BARANGAYS.map((b) => ({
  ...b,
  name: `${b.name}, ${b.municipality}`,
}));
const normalize = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

export function MunicipalitySearch() {
  const {
    selectedPsgc,
    selectedBarangayPsgc,
    selectMunicipality,
    selectBarangay,
  } = useAppStore();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const input = useRef<HTMLInputElement>(null);
  const listId = useId();
  const choices = query.trim() ? [...towns, ...communities] : towns;
  const matches = choices
    .filter((town) => normalize(town.name).includes(normalize(query.trim())))
    .slice(0, 60);

  useEffect(() => {
    setQuery(
      communities.find((b) => b.psgc === selectedBarangayPsgc)?.name ??
        towns.find((town) => town.psgc === selectedPsgc)?.name ??
        "",
    );
    setOpen(false);
    setActive(-1);
  }, [selectedPsgc, selectedBarangayPsgc]);

  useEffect(() => {
    if (open && active >= 0)
      document
        .getElementById(`${listId}-${active}`)
        ?.scrollIntoView({ block: "nearest" });
  }, [active, open, listId]);

  function select(psgc: string) {
    const barangay = communities.find((b) => b.psgc === psgc);
    if (barangay) selectBarangay(psgc, barangay.municipalityPsgc);
    else selectMunicipality(psgc);
    setQuery(
      barangay?.name ?? towns.find((town) => town.psgc === psgc)?.name ?? "",
    );
    setOpen(false);
    setActive(-1);
    input.current?.focus();
  }

  return (
    <div
      className="workspace-search"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
    >
      <input
        ref={input}
        role="combobox"
        aria-label="Find municipality or barangay"
        aria-autocomplete="list"
        aria-expanded={open}
        aria-controls={listId}
        aria-activedescendant={
          open && active >= 0 ? `${listId}-${active}` : undefined
        }
        placeholder="Search Laguna"
        autoComplete="off"
        value={query}
        onFocus={() => setOpen(true)}
        onChange={(event) => {
          setQuery(event.target.value);
          setOpen(true);
          setActive(-1);
        }}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            setOpen(false);
            return;
          }
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            setOpen(true);
            if (matches.length)
              setActive((index) =>
                event.key === "ArrowDown"
                  ? (index + 1) % matches.length
                  : (index <= 0 ? matches.length : index) - 1,
              );
          }
          if (event.key === "Enter" && open && matches.length) {
            event.preventDefault();
            select(matches[Math.max(0, active)].psgc);
          }
        }}
      />
      {query ? (
        <button
          className="map-icon-button"
          aria-label="Clear municipality search"
          title="Clear search"
          onClick={() => {
            setQuery("");
            useAppStore.setState({
              selectedPsgc: null,
              selectedBarangayPsgc: null,
              sidePanelOpen: false,
            });
            input.current?.focus();
            setOpen(true);
          }}
        >
          <X size={19} aria-hidden="true" />
        </button>
      ) : (
        <Search className="map-search-icon" size={20} aria-hidden="true" />
      )}
      {open && (
        <div
          className="map-search-results"
          id={listId}
          role="listbox"
          aria-label="Laguna municipalities and barangays"
        >
          <div className="map-search-caption" role="presentation">
            Municipalities and barangays in Laguna
          </div>
          {matches.map((town, index) => (
            <button
              key={town.psgc}
              id={`${listId}-${index}`}
              role="option"
              aria-selected={active === index}
              tabIndex={-1}
              onPointerDown={(event) => event.preventDefault()}
              onClick={() => select(town.psgc)}
            >
              <MapPin size={17} aria-hidden="true" />
              <span>
                {town.name}
                <small>
                  {"municipalityPsgc" in town ? "Barangay" : "Municipality"} ·
                  Laguna, Philippines
                </small>
              </span>
            </button>
          ))}
          {!matches.length && (
            <p role="presentation">No matching municipalities or barangays</p>
          )}
        </div>
      )}
    </div>
  );
}
