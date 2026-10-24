import { useEffect, useId, useRef, useState } from "react";
import { ArrowUpRight, Building2, MapPin, Search, X } from "lucide-react";
import { LAGUNA_BASE_DATA } from "../../services/lagunaData";
import { useAppStore } from "../../store/useAppStore";
import { LAGUNA_BARANGAYS } from "../../services/providedData";
const towns = [...LAGUNA_BASE_DATA].sort((a, b) =>
  a.name.localeCompare(b.name),
);
const communities = LAGUNA_BARANGAYS.map((b) => ({
  ...b,
  displayName: b.name,
  name: `${b.name}, ${b.municipality}`,
}));
const normalize = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

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
  const normalizedQuery = normalize(query.trim());
  const choices = normalizedQuery ? [...towns, ...communities] : towns;
  const matches = choices
    .filter((town) => normalize(town.name).includes(normalizedQuery))
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
    <form
      className="workspace-search"
      role="search"
      onSubmit={(event) => {
        event.preventDefault();
        if (normalizedQuery && matches.length)
          select(matches[Math.max(0, active)].psgc);
        else setOpen(true);
      }}
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
            event.preventDefault();
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
        }}
      />
      {query ? (
        <button
          type="button"
          className="map-icon-button"
          aria-label="Clear municipality search"
          title="Clear search"
          onClick={() => {
            setQuery("");
            useAppStore.setState((state) => ({
              selectedPsgc: null,
              selectedBarangayPsgc: null,
              sidePanelOpen: false,
              recenterTrigger: state.recenterTrigger + 1,
            }));
            input.current?.focus();
            setOpen(true);
          }}
        >
          <X size={19} aria-hidden="true" />
        </button>
      ) : (
        <button
          type="submit"
          className="map-icon-button"
          aria-label="Search Laguna"
        >
          <Search size={20} aria-hidden="true" />
        </button>
      )}
      {open && (
        <div
          className="map-search-results"
          id={listId}
          role="listbox"
          aria-label="Laguna municipalities and barangays"
        >
          <div className="map-search-caption" role="presentation">
            <span>Explore Laguna</span>
            <span>
              {matches.length === 60
                ? "Up to 60 places"
                : `${matches.length} ${matches.length === 1 ? "place" : "places"}`}
            </span>
          </div>
          <div
            className="map-search-options"
            role="group"
            aria-label="Matching places"
          >
            {matches.map((town, index) => {
              const isBarangay = "municipalityPsgc" in town;
              const kind = isBarangay
                ? "Barangay"
                : town.level === "City"
                  ? "City"
                  : "Municipality";
              return (
                <button
                  type="button"
                  key={town.psgc}
                  id={`${listId}-${index}`}
                  role="option"
                  aria-label={`${town.name} ${kind} · Laguna, Philippines`}
                  aria-selected={active === index}
                  tabIndex={-1}
                  onPointerDown={(event) => event.preventDefault()}
                  onClick={() => select(town.psgc)}
                >
                  <span
                    className={`map-result-icon ${isBarangay ? "is-barangay" : ""}`}
                  >
                    {isBarangay ? (
                      <MapPin size={18} aria-hidden="true" />
                    ) : (
                      <Building2 size={18} aria-hidden="true" />
                    )}
                  </span>
                  <span className="map-result-copy">
                    <span className="map-result-title">
                      <strong>
                        {isBarangay ? town.displayName : town.name}
                      </strong>
                      <span className="map-result-kind">{kind}</span>
                    </span>
                    <small>
                      {isBarangay
                        ? `${town.municipality} · ${town.population.toLocaleString()} residents`
                        : `${town.barangayCount} barangays · ${town.population.toLocaleString()} residents`}
                    </small>
                  </span>
                  <ArrowUpRight
                    className="map-result-arrow"
                    size={16}
                    aria-hidden="true"
                  />
                </button>
              );
            })}
            {!matches.length && (
              <div className="map-search-empty" role="status">
                <Search size={24} aria-hidden="true" />
                <strong>No matching municipalities or barangays</strong>
                <p>
                  Try a shorter name, such as Pangil, or include the
                  municipality with a barangay name.
                </p>
              </div>
            )}
          </div>
          {matches.length > 0 && (
            <div className="map-search-help">
              <span>
                <kbd>↑</kbd>
                <kbd>↓</kbd> move
              </span>
              <span>
                <kbd>Enter</kbd> focus place
              </span>
              <span>
                <kbd>Esc</kbd> close
              </span>
            </div>
          )}
        </div>
      )}
    </form>
  );
}
