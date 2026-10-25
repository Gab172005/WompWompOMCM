import { useState } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RoadExclusions } from "./RoadExclusions";
import type { Road } from "../../types";

const roads: Road[] = [
  {
    id: "link-1",
    source: "a",
    target: "b",
    name: "Model link: Anos, Los Baños / Bitin, Bay",
    minutes: 5,
  },
  {
    id: "link-2",
    source: "c",
    target: "d",
    name: "Model link: Dambo, Pangil / San Jose, Pangil",
    minutes: 6,
  },
];
afterEach(cleanup);
function Harness({
  onChange = () => {},
}: {
  onChange?: (ids: string[]) => void;
}) {
  const [selected, setSelected] = useState(["link-1"]);
  return (
    <RoadExclusions
      roads={roads}
      selected={selected}
      onChange={(ids) => {
        setSelected(ids);
        onChange(ids);
      }}
    />
  );
}
describe("Modeled access restrictions", () => {
  it("finds accented municipalities and retains the selected connection", () => {
    render(<Harness />);
    fireEvent.click(screen.getByText("Access restrictions"));
    fireEvent.change(screen.getByRole("searchbox"), {
      target: { value: "Los Banos" },
    });
    expect(screen.getAllByRole("checkbox")).toHaveLength(1);
    expect(screen.getByRole("checkbox")).toBeChecked();
    fireEvent.change(screen.getByRole("searchbox"), {
      target: { value: "Pangil" },
    });
    expect(screen.getByRole("checkbox")).not.toBeChecked();
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "" } });
    expect(screen.getByRole("checkbox", { name: /Anos/ })).toBeChecked();
  });
  it("filters excluded links and clears both their IDs and the active filter", () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    fireEvent.click(screen.getByText("Access restrictions"));
    fireEvent.click(screen.getByRole("button", { name: /^Excluded/ }));
    expect(screen.getAllByRole("checkbox")).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "Clear exclusions" }));
    expect(onChange).toHaveBeenLastCalledWith([]);
    expect(
      screen.getByRole("button", { name: "All connections" }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(screen.getAllByRole("checkbox")).toHaveLength(2);
    expect(
      screen
        .getAllByRole("checkbox")
        .every((input) => !(input as HTMLInputElement).checked),
    ).toBe(true);
  });
});
