import { Bot, MessageCircle, RotateCcw, X } from "lucide-react";
import { useAssistantStore } from "../../store/useAssistantStore";
import { ChatbotPanel } from "./ChatbotPanel";
import "../../styles/assistant.css";
export function AssistantWidget() {
  const { open, busy, setOpen, clear } = useAssistantStore();
  return open ? (
    <section className="assistant-widget" aria-label="OMCM assistant">
      <header className="assistant-widget-heading">
        <div>
          <Bot size={22} aria-hidden="true" />
          <div>
            <h2>OMCM assistant</h2>
            <span>Ask, find, and navigate</span>
          </div>
        </div>
        <div>
          <button
            type="button"
            className="icon-button"
            aria-label="New assistant conversation"
            title="New conversation"
            disabled={busy}
            onClick={clear}
          >
            <RotateCcw size={17} />
          </button>
          <button
            type="button"
            className="icon-button"
            aria-label="Close assistant"
            onClick={() => setOpen(false)}
          >
            <X size={20} />
          </button>
        </div>
      </header>
      <ChatbotPanel />
    </section>
  ) : (
    <button
      type="button"
      className="assistant-launcher"
      aria-label="Open OMCM assistant"
      onClick={() => setOpen(true)}
    >
      <MessageCircle size={20} aria-hidden="true" />
      <span>Ask OMCM{busy ? " · Working…" : ""}</span>
    </button>
  );
}
