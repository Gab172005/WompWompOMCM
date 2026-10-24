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
      "Select a municipality to inspect its need score, or open Optimize and Simulate to explore clinic recommendations and scenario effects.";
    if (/score|rank|why|need/.test(lower))
      answer = selected
        ? `${selected.name}: municipal allocation estimate ${selected.needScore}/100, allocation rank #${selected.rank}. ${selected.explanation} This separate heuristic is not the barangay HNI shown on the heatmap; the municipality panel shows its HNI rollup.`
        : "The municipal allocation estimate combines supplied synthetic morbidity (35%), illustrative vulnerability (25%), supplied disaster risk index (20%) and population density (20%). It is separate from the seven-factor barangay HNI heatmap. Select a municipality to compare its HNI rollup and allocation estimate.";
    else if (/clinic|recommend|placement/.test(lower))
      answer = `The priority heuristic proposes ${plan.clinics.length} clinics: ${plan.clinics.map((c) => c.clinicId + " at " + c.siteName).join("; ")}. Total capacity: ${plan.metrics.totalCapacity} appointments/day. This is an illustrative local proposal.`;
    else if (/scenario|flood|disaster|simulation/.test(lower))
      answer = `Configured scenario: ${Object.keys(scenario.floodOverrides).length} flood overrides, ${Object.keys(scenario.morbiditySpikes).length} morbidity overrides, ${scenario.closedRoadIds.length} closed corridors. Open Simulate to apply and compare these conditions.`;
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
        Local, rule-based planning assistant. Answers use the current demo data.
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
