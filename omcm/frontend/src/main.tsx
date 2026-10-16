import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Provider } from "./services/store";
import { LagunaWorkspace } from "./components/LagunaWorkspace";
import "leaflet/dist/leaflet.css";
import "./styles/app.css";

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: boolean }
> {
  state = { error: false };
  static getDerivedStateFromError() {
    return { error: true };
  }
  render() {
    return this.state.error ? (
      <div className="empty-state">
        <h1>Unable to display this page</h1>
        <p>
          An unexpected interface error occurred. Reload to reconnect with the
          backend.
        </p>
        <button className="primary" onClick={() => window.location.reload()}>
          Reload application
        </button>
      </div>
    ) : (
      this.props.children
    );
  }
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <ErrorBoundary>
    <BrowserRouter>
      <Provider>
        <Routes>
          <Route path="/" element={<LagunaWorkspace />} />
          <Route path="/simulator" element={<LagunaWorkspace />} />
          <Route path="/optimization" element={<LagunaWorkspace />} />
          <Route path="/risk" element={<LagunaWorkspace />} />
          <Route path="*" element={<LagunaWorkspace />} />
        </Routes>
      </Provider>
    </BrowserRouter>
  </ErrorBoundary>,
);
