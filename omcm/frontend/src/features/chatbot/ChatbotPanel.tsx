import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAssistantStore } from "../../store/useAssistantStore";
import { ChatMessage } from "./ChatMessage";
import { useAppStore } from "../../store/useAppStore";
import {
  ArrowUp,
  ArrowUpRight,
  MapPin,
  Crosshair,
  ChartNoAxesCombined,
  CircleHelp,
  Square,
} from "lucide-react";

export function ChatbotPanel() {
  const [input, setInput] = useState("");
  const s = useAssistantStore();
  const isAdmin = useAppStore((state) => state.viewMode === "admin");
  const suggestions = isAdmin
    ? [
        {
          icon: ChartNoAxesCombined,
          title: "Find priority communities",
          detail: "See the five highest-need barangays",
          message: "Show the 5 highest-need barangays",
        },
        {
          icon: Crosshair,
          title: "Plan clinic locations",
          detail: "Open fleet and access settings",
          message: "Open clinic planning",
        },
        {
          icon: CircleHelp,
          title: "Understand the need score",
          detail: "Explore the factors behind HNI",
          message: "Explain the need score",
        },
      ]
    : [
        {
          icon: MapPin,
          title: "Find nearby hospitals",
          detail: "Start with Los Baños, or type your town",
          message: "Show Los Baños and its nearest hospitals",
        },
        {
          icon: MapPin,
          title: "Explore your community",
          detail: "Find Bay on the Laguna map",
          message: "Show Bay",
        },
        {
          icon: CircleHelp,
          title: "Find community care",
          detail: "Open published visits and local facilities",
          message: "Show clinic schedules",
        },
      ];
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
    if (inputRef.current) inputRef.current.style.height = "auto";
    void s.send(value, {
      navigate,
      pathname: () => locationRef.current.pathname,
    });
  }
  return (
    <>
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
            <span className="assistant-kicker">YOUR LAGUNA MAP COMPANION</span>
            <h3>Where can we help?</h3>
            <p>
              {isAdmin
                ? "Find a community, explore need or start a clinic plan."
                : "Find your community, nearby hospitals and published clinic visits."}
            </p>
            <div
              className="assistant-task-list"
              aria-label="Suggested questions"
            >
              {suggestions.map(({ icon: Icon, title, detail, message }) => (
                <button
                  type="button"
                  key={title}
                  disabled={s.busy}
                  onClick={() => send(message)}
                >
                  <span className="assistant-task-icon">
                    <Icon size={18} aria-hidden="true" />
                  </span>
                  <span>
                    <strong>{title}</strong>
                    <small>{detail}</small>
                  </span>
                  <ArrowUpRight size={16} aria-hidden="true" />
                </button>
              ))}
            </div>
            <p className="assistant-example">
              Or try:{" "}
              <button type="button" onClick={() => send("Show Pangil")}>
                “Show Pangil”
              </button>
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
      <form
        className="assistant-form"
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
      >
        <div className="assistant-composer">
          <textarea
            ref={inputRef}
            aria-label="Assistant message"
            value={input}
            rows={2}
            maxLength={4000}
            onChange={(e) => {
              setInput(e.target.value);
              e.target.style.height = "auto";
              e.target.style.height = `${Math.min(e.target.scrollHeight, 144)}px`;
            }}
            placeholder="Ask about a place or clinic plan…"
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
          {s.busy ? (
            <button
              type="button"
              className="assistant-send is-stop"
              aria-label="Stop response"
              title="Stop response"
              onClick={s.stop}
            >
              <Square size={16} aria-hidden="true" />
            </button>
          ) : (
            <button
              type="submit"
              className="assistant-send"
              aria-label="Send message"
              title="Send message"
              disabled={!input.trim()}
            >
              <ArrowUp size={20} aria-hidden="true" />
            </button>
          )}
        </div>
        <div className="assistant-composer-hint">
          <span>Sample planning data</span>
          <span>Enter to send · Shift + Enter for a new line</span>
        </div>
      </form>
    </>
  );
}
