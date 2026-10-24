import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, useLocation } from "react-router-dom";
import { AppRoutes } from "../../frontend/src/app/routes";

vi.mock("../../frontend/src/components/layout/AppLayout", () => ({
  AppLayout: function MapWorkspace() {
    const location = useLocation();
    return <output aria-label="Map entry">{location.pathname}:{location.state?.panel ?? "overview"}</output>;
  },
}));
afterEach(cleanup);

describe("single map compatibility links", () => {
  it.each([
    ["/driver", "/admin:simulation"],
    ["/simulator", "/admin:simulation"],
    ["/analytics", "/admin:optimization"],
    ["/settings", "/admin:optimization"],
    ["/workspace", "/admin:optimization"],
    ["/admin/legacy", "/admin:optimization"],
    ["/public/legacy", "/public:overview"],
  ])("opens %s in the shared map", (path, entry) => {
    render(<MemoryRouter initialEntries={[path]}><AppRoutes /></MemoryRouter>);
    expect(screen.getByLabelText("Map entry")).toHaveTextContent(entry);
  });
});
