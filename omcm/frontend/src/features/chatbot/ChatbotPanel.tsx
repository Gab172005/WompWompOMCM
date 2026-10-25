import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAssistantStore } from "../../store/useAssistantStore";
import { ChatMessage } from "./ChatMessage";
import { BARANGAYS_BY_PSGC } from "../../services/providedData";
import { LAGUNA_BASE_DATA } from "../../services/lagunaData";
import { useAppStore } from "../../store/useAppStore";
import {
  ArrowUp,
  ArrowUpRight,
  MapPin,
  Crosshair,
  ChartNoAxesCombined,
  CircleHelp,
  Square,
  ArrowDown,
  LoaderCircle,
} from "lucide-react";

export function ChatbotPanel({
  draft,
  onDraftChange,
}: { draft?: string; onDraftChange?: (value: string) => void } = {}) {
  const [localInput, setLocalInput] = useState("");
  const input = draft ?? localInput;
  const setInput = onDraftChange ?? setLocalInput;
  const s = useAssistantStore();
  const selectedPsgc = useAppStore((state) => state.selectedPsgc);
  const selectedBarangayPsgc = useAppStore(
    (state) => state.selectedBarangayPsgc,
  );
  const selectedBarangay = selectedBarangayPsgc
    ? BARANGAYS_BY_PSGC.get(selectedBarangayPsgc)
    : undefined;
  const selectedTown = LAGUNA_BASE_DATA.find(
    (town) => town.psgc === selectedPsgc,
  );
  const placeName = selectedBarangay
    ? `${selectedBarangay.name}, ${selectedBarangay.municipality}`
    : selectedTown?.name;
  const placeQuery = placeName?.replace(/,/g, "") ?? "Los Baños";
  const followLatest = useRef(true);
  const [hasNewReply, setHasNewReply] = useState(false);
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
          detail: placeName
            ? `Around ${placeName}`
            : "Start with Los Baños, or type your town",
          message: `Show ${placeQuery} and the nearest hospitals`,
        },
        {
          icon: MapPin,
          title: "Explore your community",
          detail: placeName
            ? `Learn about ${placeName}`
            : "Find Bay on the Laguna map",
          message: `Show ${placeName ? placeQuery : "Bay"}`,
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
  useLayoutEffect(() => {
    const field = inputRef.current;
    if (!field) return;
    field.style.height = "auto";
    field.style.height = `${Math.min(field.scrollHeight, 144)}px`;
  }, [input]);
  useEffect(() => {
    if (window.matchMedia?.("(max-width: 760px), (pointer: coarse)").matches)
      inputRef.current
        ?.closest<HTMLElement>(".assistant-widget")
        ?.focus({ preventScroll: true });
    else inputRef.current?.focus({ preventScroll: true });
  }, []);
  useLayoutEffect(() => {
    if (!history.current) return;
    if (!s.messages.length) {
      history.current.scrollTop = 0;
      followLatest.current = true;
      setHasNewReply(false);
      return;
    }
    if (followLatest.current)
      history.current.scrollTop = history.current.scrollHeight;
    else setHasNewReply(true);
  }, [s.messages, s.status]);
  const latestQuestion = [...s.messages]
    .reverse()
    .find((message) => message.sender === "user")?.text;
  function jumpToLatest() {
    followLatest.current = true;
    setHasNewReply(false);
    if (history.current)
      history.current.scrollTop = history.current.scrollHeight;
  }
  function send(value: string) {
    if (!value.trim() || s.busy) return;
    followLatest.current = true;
    setHasNewReply(false);
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
        onScroll={(event) => {
          const element = event.currentTarget;
          followLatest.current =
            element.scrollHeight - element.scrollTop - element.clientHeight <
            64;
          if (followLatest.current) setHasNewReply(false);
        }}
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
        {s.messages
          .filter((message) => message.text || message.actions?.length)
          .map((message) => (
            <ChatMessage
              key={message.id}
              message={message}
              onRetry={
                !s.busy &&
                message.error &&
                !message.actions?.length &&
                message.id === s.messages.at(-1)?.id &&
                latestQuestion
                  ? () => send(latestQuestion)
                  : undefined
              }
            />
          ))}
        {s.busy && (
          <p role="status" className="assistant-progress">
            <LoaderCircle size={15} aria-hidden="true" />
            {s.status || "Finding an answer…"}
          </p>
        )}
      </div>
      {hasNewReply && (
        <div className="assistant-jump-row">
          <button type="button" onClick={jumpToLatest}>
            <ArrowDown size={14} aria-hidden="true" />
            Jump to latest message
          </button>
        </div>
      )}
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
            }}
            placeholder={
              isAdmin
                ? "Ask about a place or clinic plan…"
                : "Ask about your community or clinic visits…"
            }
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
          <span>
            {input.length >= 3600
              ? `${4000 - input.length} characters left`
              : "Sample planning data"}
          </span>
          <span>Enter to send · Shift + Enter for a new line</span>
        </div>
      </form>
    </>
  );
}
