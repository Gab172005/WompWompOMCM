import { useState } from "react";
import { useAppStore } from "../../store/useAppStore";
import { usePlanningResults } from "../optimization/usePlanningResults";
import { ChatMessage, type Message } from "./ChatMessage";
import { Button } from "../../components/ui/Button";
import { MUNICIPALITY_HEALTHCARE_NEED } from "../../services/providedData";
export function ChatbotPanel() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const { selectedPsgc, scenario } = useAppStore();
  const { municipalities, plan } = usePlanningResults();
  const selected = municipalities.find((m) => m.psgc === selectedPsgc);
  const selectedNeed =
    selectedPsgc && MUNICIPALITY_HEALTHCARE_NEED.get(selectedPsgc);
  function send(text: string) {
    if (!text.trim()) return;
    const lower = text.toLowerCase();
    let answer =
      "Select a municipality to view its healthcare needs. Open Plan clinics to review suggested locations, or 30-day simulation to compare estimated results.";
    if (/score|rank|why|need/.test(lower))
      answer =
        selected && selectedNeed
          ? `${selected.name}: estimated Healthcare Need Score ${selectedNeed.needScore.toFixed(1)}/100, municipality rank ${selectedNeed.needRank}. This is the population-weighted barangay score shown in community details. ${selectedNeed.provisionalBarangays ? "Some barangay inputs are missing, so the estimate is provisional. " : ""}Clinic suggestions use the separate Los Baños–Bay pilot priority score and sample appointment demand.`
          : "The Healthcare Need Score uses the agreed Balanced profile: illness rate 35%, hospital distance 30%, population density 15%, municipal income class 10%, clinic distance 5% and clinic provision 5%. Disaster risk is separate context. Missing factors are left out and available weights are rescaled. Clinic suggestions use separate pilot priority scores and estimated appointment demand.";
    else if (/clinic|recommend|placement/.test(lower))
      answer = plan.clinics.length
        ? `The current saved draft suggests ${plan.clinics.length} clinics: ${plan.clinics.map((c) => c.clinicId + " at " + c.siteName).join("; ")}. Total capacity: ${plan.metrics.totalCapacity} appointments/day. These demonstration estimates cover the Los Baños–Bay road pilot and do not confirm service delivery.`
        : "Open Plan clinics and generate recommendations to review suggested locations. No allocation has been generated.";
    else if (/scenario|flood|disaster|simulation/.test(lower))
      answer = `Practice conditions: ${Object.keys(scenario.floodOverrides).length} flood changes, ${Object.keys(scenario.morbiditySpikes).length} sample illness increases, ${scenario.closedRoadIds.length} roads marked closed. Open 30-day simulation to compare estimated results. Road marks are for reference and do not change the 30-day clinic reach estimates.`;
    setMessages((prev) => [
      ...prev,
      { id: prev.length, sender: "user", text },
      { id: prev.length + 1, sender: "assistant", text: answer },
    ]);
    setInput("");
  }
  return (
    <>
      <p>
        Get help understanding scores, clinic suggestions and practice
        scenarios. Answers use the current demonstration data.
      </p>
      <div
        className="workspace-chat-log"
        role="log"
        aria-label="Planning conversation"
      >
        {messages.map((m) => (
          <ChatMessage key={m.id} message={m} />
        ))}
      </div>
      <div className="workspace-prompt-list">
        {[
          "Explain the need score",
          "Explain clinic placement recommendations",
          "Explain the scenario",
        ].map((text) => (
          <Button key={text} variant="secondary" onClick={() => send(text)}>
            {text}
          </Button>
        ))}
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
      >
        <label className="workspace-field">
          Message
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about Laguna planning…"
          />
        </label>
        <Button type="submit" disabled={!input.trim()}>
          Send message
        </Button>
      </form>
    </>
  );
}
