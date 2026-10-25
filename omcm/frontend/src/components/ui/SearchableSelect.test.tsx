import { useState } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SearchableSelect, type SelectOption } from "./SearchableSelect";

const options: SelectOption[] = [
  {
    value: "unavailable",
    label: "San Antonio",
    description: "Bay",
    disabled: true,
  },
  { value: "maahas", label: "Maahas", description: "Los Baños" },
  { value: "dambo", label: "Dambo", description: "Pangil" },
];
afterEach(cleanup);

function Harness({
  onChange = () => {},
  initialValue = "",
}: {
  onChange?: (value: string) => void;
  initialValue?: string;
}) {
  const [value, setValue] = useState(initialValue);
  return (
    <>
      <SearchableSelect
        label="Clinic location"
        options={options}
        value={value}
        onChange={(next) => {
          setValue(next);
          onChange(next);
        }}
      />
      <button>Outside</button>
    </>
  );
}

describe("searchable clinic location picker", () => {
  it("replaces a preselected location without sending a duplicate selection", () => {
    const change = vi.fn();
    render(<Harness initialValue="maahas" onChange={change} />);
    const input = screen.getByRole("combobox");
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "dambo" } });
    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(change).toHaveBeenCalledWith("dambo");
    expect(input).toHaveValue("Dambo · Pangil");
    fireEvent.focus(input);
    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(change).toHaveBeenCalledTimes(1);
  });
  it("searches municipality names without accents and selects with the keyboard", () => {
    const change = vi.fn();
    render(<Harness onChange={change} />);
    const input = screen.getByRole("combobox", { name: "Clinic location" });
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "los banos" } });
    expect(screen.getByRole("option", { name: /Maahas/ })).toBeInTheDocument();
    expect(
      screen.queryByRole("option", { name: /Dambo/ }),
    ).not.toBeInTheDocument();
    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(change).toHaveBeenCalledWith("maahas");
    expect(input).toHaveValue("Maahas · Los Baños");
    expect(input).toHaveAttribute("aria-expanded", "false");
  });
  it("skips unavailable sites and never commits arbitrary typed text", () => {
    const change = vi.fn();
    render(<Harness onChange={change} />);
    const input = screen.getByRole("combobox");
    fireEvent.focus(input);
    fireEvent.click(screen.getByRole("option", { name: /San Antonio/ }));
    expect(change).not.toHaveBeenCalled();
    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(change).toHaveBeenCalledWith("maahas");
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "not a planning point" } });
    expect(screen.getByText("No matching locations")).toBeInTheDocument();
    fireEvent.keyDown(input, { key: "Enter" });
    fireEvent.keyDown(input, { key: "Escape" });
    expect(change).toHaveBeenCalledTimes(1);
    expect(input).toHaveValue("Maahas · Los Baños");
  });
  it("dismisses its portal on outside interaction and retains the current selection", () => {
    render(<Harness />);
    const input = screen.getByRole("combobox");
    fireEvent.focus(input);
    fireEvent.keyDown(input, { key: "End" });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(input).toHaveValue("Dambo · Pangil");
    fireEvent.focus(input);
    expect(screen.getByRole("listbox")).toBeInTheDocument();
    fireEvent.pointerDown(screen.getByRole("button", { name: "Outside" }));
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(input).toHaveValue("Dambo · Pangil");
  });
  it("disables editing while evaluation is pending", () => {
    const change = vi.fn();
    render(
      <SearchableSelect
        label="Clinic location"
        options={options}
        value="maahas"
        onChange={change}
        disabled
      />,
    );
    expect(screen.getByRole("combobox")).toBeDisabled();
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(change).not.toHaveBeenCalled();
  });
});
