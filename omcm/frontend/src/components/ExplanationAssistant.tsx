import { useEffect, useRef, useState } from "react";
import { api } from "../services/api";
import { useOMCM } from "../services/store";
import type { Config, Plan } from "../types";

type Message = { role: "user" | "assistant"; content: string };
export function ExplanationAssistant({
  plan,
  original,
  stale = false,
}: {
  plan: Plan | null;
  original?: Config;
  stale?: boolean;
}) {
  const { browserDemo, username, config, barangays } = useOMCM();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [provider, setProvider] = useState("template");
  const [error, setError] = useState("");
  const history = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (history.current)
      history.current.scrollTop = history.current.scrollHeight;
  }, [messages, open]);
  function localReply(question: string) {
    const rows = plan?.barangays ?? barangays;
    const top = rows
      .slice(0, 3)
      .map(
        (row) =>
          `${row.name}: ${Object.entries(row.contributions)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3)
            .map(([key, value]) => `${key} ${value.toFixed(1)} need points`)
            .join(", ")}`,
      )
      .join(". ");
    const m = plan?.optimized.metrics;
    const clinics = plan?.optimized.clinics
      .map((c) => `${c.name}: ${c.served}/${c.daily_capacity} appointments`)
      .join("; ");
    return `Local template for “${question}”. ${top}. ${m ? `Coverage: ${m.residents_served} daily appointments, ${m.unserved_demand} unserved; average modeled travel ${m.average_travel_minutes} minutes. ${clinics}. Blocked roads: ${plan?.inputs.closed_roads.length}; excluded sites: ${plan?.inputs.flooded_sites.length}.` : "Generate a recommendation to discuss coverage, capacity and modeled travel."} Connect and sign in to the Python API for server-grounded scenario differences and optional AI responses. These are synthetic inputs and simulated tracking. Final deployment decisions belong to LGU health officers.`;
  }
  async function send() {
    const content = input.trim();
    if (!content || busy || stale) return;
    const next: Message[] = [...messages, { role: "user" as const, content }]
      .slice(-38)
      .map((message) => ({
        ...message,
        content: message.content.slice(0, 4000),
      }));
    setMessages(next);
    setInput("");
    setBusy(true);
    setError("");
    try {
      const result =
        browserDemo || !username
          ? { text: localReply(content), provider: "local template" }
          : await api<{ text: string; provider: string }>("/chat", {
              messages: next,
              original: original ?? plan?.inputs ?? config,
              scenario: plan?.inputs ?? config,
            });
      setMessages([...next, { role: "assistant", content: result.text }]);
      setProvider(result.provider);
    } catch (e) {
      setError((e as Error).message);
      setMessages([
        ...next,
        { role: "assistant", content: localReply(content) },
      ]);
      setProvider("local template · server unavailable");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="explanation-assistant">
      <button
        className="secondary"
        aria-expanded={open}
        aria-controls="assistant-explanation"
        onClick={() => setOpen(!open)}
      >
        AI chatbot: {open ? "Open" : "Closed"}
      </button>
      {open && (
        <section id="assistant-explanation" aria-label="AI chatbot">
          <button className="text-link" onClick={() => setOpen(false)}>
            Collapse chatbot
          </button>
          <h2>OMCM assistant</h2>
          <p className="tiny">
            {provider} · Explains the currently displayed plan or scenario.
          </p>
          <div
            ref={history}
            className="chat-history"
            role="log"
            aria-live="polite"
          >
            {!messages.length && (
              <p>
                Ask about need factors, clinic capacity, coverage, travel, flood
                exclusions, or scenario changes.
              </p>
            )}
            {messages.map((message, i) => (
              <article className={`chat-message ${message.role}`} key={i}>
                <strong>{message.role === "user" ? "You" : "OMCM"}</strong>
                <p>{message.content}</p>
              </article>
            ))}
          </div>
          {stale && (
            <p role="status">Waiting for the current scenario to recompute.</p>
          )}
          {error && (
            <p role="alert">
              Server reply unavailable; a local template is shown. {error}
            </p>
          )}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void send();
            }}
          >
            <label>
              Message
              <textarea
                aria-label="Chat message"
                maxLength={4000}
                value={input}
                onChange={(e) => setInput(e.target.value)}
              />
            </label>
            <button
              className="primary"
              disabled={busy || stale || !input.trim()}
            >
              {busy ? "Explaining…" : "Send message"}
            </button>
          </form>
          <footer>
            Explain only, never decide. Final deployment decisions belong to LGU
            health officers.
          </footer>
        </section>
      )}
    </div>
  );
}
