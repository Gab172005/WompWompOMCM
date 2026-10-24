import { useState } from "react";
import { useAppStore } from "../../store/useAppStore";
import { usePlanningResults } from "../optimization/usePlanningResults";
import { ChatMessage, type Message } from "./ChatMessage";
import { Button } from "../../components/ui/Button";
export function ChatbotPanel() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const { selectedPsgc, scenario } = useAppStore();
  const { municipalities, plan } = usePlanningResults();
  const selected = municipalities.find((m) => m.psgc === selectedPsgc);
  function send(text: string) {
    if (!text.trim()) return;
    const lower = text.toLowerCase();
    let answer =
      "Select a municipality to view its healthcare needs. Open Plan clinics to review suggested locations, or 30-day simulation to compare estimated results.";
    if (/score|rank|why|need/.test(lower))
      answer = selected
        ? `${selected.name}: clinic planning score ${selected.needScore}/100, rank ${selected.rank}. ${selected.explanation} This separate score helps recommend locations. The community details panel shows the average barangay Healthcare Need Score used by the main map colors.`
        : "The Healthcare Need Score compares estimated planning priorities, not numbers of sick residents. Higher scores suggest greater need. Sample illness rates, hospital and clinic access, disaster risk, population concentration and municipal resources contribute. Missing factors are left out. Clinic location recommendations use a separate municipal score; select a municipality to compare the two.";
    else if (/clinic|recommend|placement/.test(lower))
      answer = `The current plan suggests ${plan.clinics.length} clinics: ${plan.clinics.map((c) => c.clinicId + " at " + c.siteName).join("; ")}. Total capacity: ${plan.metrics.totalCapacity} appointments/day. These are demonstration locations and appointment estimates, not confirmed service delivery.`;
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
