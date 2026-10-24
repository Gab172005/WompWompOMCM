import { AppProviders } from "./AppProviders";
import { AppRoutes } from "./routes";
import { AssistantWidget } from "../features/chatbot/AssistantWidget";
export function App() {
  return (
    <AppProviders>
      <AppRoutes />
      <AssistantWidget />
    </AppProviders>
  );
}
