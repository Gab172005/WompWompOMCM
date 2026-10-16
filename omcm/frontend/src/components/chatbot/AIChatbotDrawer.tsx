import { useState, useRef, useEffect } from "react";
import { Bot, X, Send, ChevronRight } from "lucide-react";
import type { ComputedMunicipality, SimulationScenario } from "../../services/lagunaData";

interface AIChatbotDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  selectedMunicipality?: ComputedMunicipality;
  activeMetric: "score" | "density" | "flood" | "morbidity";
  simulationActive: boolean;
  scenario: SimulationScenario;
  proposedClinics: Array<{
    clinicId: string;
    siteName: string;
    municipality: string;
  }>;
}

interface Message {
  id: string;
  sender: "bot" | "user";
  text: string;
}

export function AIChatbotDrawer({
  isOpen,
  onClose,
  selectedMunicipality,
  activeMetric,
  simulationActive,
  scenario,
  proposedClinics,
}: AIChatbotDrawerProps) {
  if (!isOpen) return null;

  const [messages, setMessages] = useState<Message[]>([
    {
      id: "m0",
      sender: "bot",
      text: "Kumusta! I am your OMCM Laguna Operations Assistant. I can explain municipality need scores, evaluate clinic placement recommendations, or analyze disaster simulation scenarios across Laguna Province.",
    },
  ]);
  const [inputText, setInputText] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const presetQuestions = [
    selectedMunicipality
      ? `Why is ${selectedMunicipality.name} ranked #${selectedMunicipality.rank}?`
      : "Why is Santa Cruz or Biñan high priority?",
    "Explain current clinic placement recommendations",
    simulationActive
      ? "What is the impact of the simulated disaster scenario?"
      : "How is the healthcare need score calculated?",
  ];

  const handleSend = (text: string) => {
    if (!text.trim()) return;
    const userMsg: Message = { id: `u-${Date.now()}`, sender: "user", text };
    setMessages((prev) => [...prev, userMsg]);
    setInputText("");

    // Generate intelligent response based on current live context
    setTimeout(() => {
      let botResponse = "";
      const lower = text.toLowerCase();

      if (lower.includes("why is") || lower.includes("rank") || lower.includes("score")) {
        if (selectedMunicipality) {
          botResponse = `${selectedMunicipality.name} has an Overall Need Score of ${selectedMunicipality.needScore}/100 (Rank #${selectedMunicipality.rank}). ${selectedMunicipality.explanation} Its demographic vulnerability is ${selectedMunicipality.vulnerability}% with an estimated hospital access time of ~${selectedMunicipality.hospital_minutes} minutes.`;
        } else {
          botResponse = `Across Laguna's 30 municipalities, municipalities along the Laguna de Bay shoreline (like Santa Cruz, Bay, and Biñan) show higher composite need due to concurrent flood inundation hazard and high population density. Upland municipalities (like Majayjay and Cavinti) have lower flood risk but may face longer travel times to tertiary medical centers.`;
        }
      } else if (lower.includes("clinic") || lower.includes("recommend") || lower.includes("placement")) {
        const sites = proposedClinics.map((c) => `${c.clinicId} at ${c.siteName} (${c.municipality})`).join("; ");
        botResponse = `Currently, ${proposedClinics.length} mobile clinics are allocated using greedy priority demand coverage: ${sites}. The algorithm prioritizes areas with high need scores and high vulnerable populations while verifying road network feasibility.`;
      } else if (lower.includes("simulation") || lower.includes("scenario") || lower.includes("flood") || lower.includes("disaster")) {
        if (simulationActive) {
          const overrides = Object.keys(scenario.floodOverrides).length;
          const spikes = Object.keys(scenario.morbiditySpikes).length;
          const closures = scenario.closedRoadIds.length;
          botResponse = `In this simulation: ${overrides} municipalities have flood severity overrides, ${spikes} have morbidity spikes, and ${closures} road corridors are disrupted. Notice how the need scores and clinic deployment routes dynamically adapt to avoid hazardous corridors.`;
        } else {
          botResponse = `Simulation mode is currently off. When enabled via the header toggle, you can inject localized flood severity, surge morbidity rates up to +200%, and trigger arterial road closures to test LGU contingency responses.`;
        }
      } else if (lower.includes("calculate") || lower.includes("formula") || lower.includes("weights")) {
        botResponse = `The Healthcare Need Score (0–100) is calculated from four transparent weighted indicators: Disease Morbidity (35%), Demographic Vulnerability (25%), Flood Inundation Exposure (20%), and Population Density (20%). It is derived from PSA 2020 census population and official PSGC boundaries.`;
      } else {
        botResponse = `Understood. Currently inspecting Laguna Province (${activeMetric.toUpperCase()} layer active). You can select any of Laguna's 30 municipalities to view its rank, population, and nearby healthcare facilities, or run clinic optimization to plan mobile clinic routes.`;
      }

      setMessages((prev) => [
        ...prev,
        { id: `b-${Date.now()}`, sender: "bot", text: botResponse },
      ]);
    }, 400);
  };

  return (
    <div className="absolute bottom-4 right-4 z-40 w-88 md:w-96 h-96 max-h-[calc(100vh-6rem)] bg-slate-900/95 backdrop-blur-xl border border-sky-500/50 rounded-2xl shadow-2xl flex flex-col overflow-hidden text-slate-100 pointer-events-auto">
      {/* Header */}
      <div className="p-3.5 bg-slate-950/70 border-b border-slate-800 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-sky-500/20 text-sky-400 flex items-center justify-center border border-sky-500/30">
            <Bot size={16} />
          </div>
          <div>
            <h3 className="font-bold text-xs text-white">OMCM AI Operations Assistant</h3>
            <span className="text-[10px] text-sky-400 font-medium">Context-Aware Laguna Planner</span>
          </div>
        </div>
        <button
          onClick={onClose}
          className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
        >
          <X size={15} />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2.5 text-xs">
        {messages.map((m) => (
          <div
            key={m.id}
            className={`flex ${m.sender === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[85%] p-2.5 rounded-xl leading-relaxed ${
                m.sender === "user"
                  ? "bg-sky-600 text-white rounded-br-none shadow"
                  : "bg-slate-800/80 text-slate-200 border border-slate-700/60 rounded-bl-none"
              }`}
            >
              {m.text}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Suggested Prompts */}
      <div className="px-3 pb-2 pt-1 border-t border-slate-800/80 shrink-0 space-y-1">
        <span className="text-[10px] text-slate-400 block font-semibold">Suggested Questions:</span>
        <div className="flex flex-col gap-1 max-h-20 overflow-y-auto">
          {presetQuestions.map((q, idx) => (
            <button
              key={idx}
              onClick={() => handleSend(q)}
              className="text-left text-[11px] p-1.5 rounded-lg bg-slate-800/60 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700/50 truncate transition-colors flex items-center justify-between"
            >
              <span className="truncate">{q}</span>
              <ChevronRight size={12} className="text-slate-500 shrink-0" />
            </button>
          ))}
        </div>
      </div>

      {/* Input Box */}
      <div className="p-2.5 bg-slate-950/60 border-t border-slate-800 flex items-center gap-2 shrink-0">
        <input
          type="text"
          placeholder="Ask about Laguna healthcare operations..."
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSend(inputText)}
          className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-slate-100 placeholder-slate-400 focus:outline-none focus:border-sky-500"
        />
        <button
          onClick={() => handleSend(inputText)}
          className="p-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white shadow-md transition-colors"
          title="Send Message"
        >
          <Send size={14} />
        </button>
      </div>
    </div>
  );
}
