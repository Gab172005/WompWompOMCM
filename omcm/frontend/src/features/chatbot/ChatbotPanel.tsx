import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAssistantStore } from "../../store/useAssistantStore";
import { ChatMessage } from "./ChatMessage";
import { Button } from "../../components/ui/Button";
import { MessageCircle, Send, Square } from "lucide-react";

export function ChatbotPanel() {
  const [input, setInput] = useState("");
  const s = useAssistantStore();
  const navigate = useNavigate(),
    location = useLocation();
  const locationRef = useRef(location);
  locationRef.current = location;
  const history = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    inputRef.current?.focus();
  }, []);
  useEffect(() => {
    if (history.current)
      history.current.scrollTop = history.current.scrollHeight;
  }, [s.messages, s.status]);
  function send(value: string) {
    if (!value.trim() || s.busy) return;
    setInput("");
    void s.send(value, {
      navigate,
      pathname: () => locationRef.current.pathname,
    });
  }
  return (
    <>
      <p className="assistant-intro">
        Ask a question, find a place, or tell me what to open. I can navigate
        and update the map for you.
      </p>
      <div
        ref={history}
        className="workspace-chat-log assistant-chat-log"
        role="log"
        aria-label="Planning conversation"
        aria-live="polite"
        aria-busy={s.busy}
      >
        {!s.messages.length && (
          <div className="assistant-empty">
            <span className="assistant-welcome-icon">
              <MessageCircle size={24} aria-hidden="true" />
            </span>
            <strong>What would you like to find?</strong>
            <p>
              Try “Show Los Baños and its nearest hospitals” or “Open the 30-day
              simulation.”
            </p>
          </div>
        )}
        {s.messages.map((m) => (
          <ChatMessage key={m.id} message={m} />
        ))}
        {s.busy && (
          <p role="status" className="assistant-progress">
            {s.status}
          </p>
        )}
      </div>
      {!s.messages.length && (
        <div className="workspace-prompt-list assistant-prompts">
          {[
            "Show the 5 highest-need barangays",
            "Open clinic planning",
            "Explain the need score",
          ].map((text) => (
            <Button
              key={text}
              variant="secondary"
              disabled={s.busy}
              onClick={() => send(text)}
            >
              {text}
            </Button>
          ))}
        </div>
      )}
      <form
        className="assistant-form"
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
      >
        <label className="workspace-field">
          Message
          <textarea
            ref={inputRef}
            aria-label="Assistant message"
            value={input}
            rows={2}
            maxLength={4000}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask OMCM or tell me what to show…"
            onKeyDown={(e) => {
              if (
                e.key === "Enter" &&
                !e.shiftKey &&
                !e.nativeEvent.isComposing
              ) {
                e.preventDefault();
                send(input);
              }
            }}
          />
        </label>
        <div className="assistant-form-actions">
          <span>
            {s.model
              ? s.model.replace(/^gemini-/, "Gemini ")
              : "OMCM assistant"}
          </span>
          {s.busy ? (
            <Button type="button" variant="secondary" onClick={s.stop}>
              <Square size={14} aria-hidden="true" /> Stop
            </Button>
          ) : (
            <Button type="submit" disabled={!input.trim()}>
              <Send size={15} aria-hidden="true" /> Send message
            </Button>
          )}
        </div>
      </form>
    </>
  );
}
