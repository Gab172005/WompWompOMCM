import { useEffect, useState } from "react";
import { Check, ChevronDown, Copy, RotateCcw } from "lucide-react";
import type { AssistantMessage } from "../../types/assistant";

export function ChatMessage({
  message,
  onRetry,
}: {
  message: AssistantMessage;
  onRetry?: () => void;
}) {
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">(
    "idle",
  );
  useEffect(() => {
    if (copyState === "idle") return;
    const timer = window.setTimeout(() => setCopyState("idle"), 2500);
    return () => window.clearTimeout(timer);
  }, [copyState]);
  async function copy() {
    try {
      await navigator.clipboard.writeText(
        [message.text, ...(message.actions ?? [])].filter(Boolean).join("\n"),
      );
      setCopyState("copied");
    } catch {
      setCopyState("failed");
    }
  }
  return (
    <article
      className={`workspace-chat-message ${message.sender}${message.error ? " has-error" : ""}`}
    >
      <span className="assistant-message-author">
        {message.sender === "user" ? "You" : "OMCM assistant"}
      </span>
      {message.text && (
        <p className={message.error ? "assistant-message-error" : undefined}>
          {message.text}
        </p>
      )}
      {Boolean(message.actions?.length) && (
        <details className="assistant-action-disclosure">
          <summary>
            <Check size={13} aria-hidden="true" />
            <span>
              {message.actions!.length} completed{" "}
              {message.actions!.length === 1 ? "action" : "actions"}
            </span>
            <ChevronDown size={14} aria-hidden="true" />
          </summary>
          <ul
            className="assistant-action-list"
            aria-label="Completed app actions"
          >
            {message.actions!.map((action, index) => (
              <li key={index}>{action}</li>
            ))}
          </ul>
        </details>
      )}
      {message.sender === "assistant" && (
        <div className="assistant-message-tools">
          {onRetry && (
            <button type="button" onClick={onRetry}>
              <RotateCcw size={14} aria-hidden="true" />
              Try again
            </button>
          )}
          <button
            type="button"
            aria-label={
              copyState === "copied" ? "Response copied" : "Copy response"
            }
            onClick={() => void copy()}
          >
            {copyState === "copied" ? (
              <Check size={14} aria-hidden="true" />
            ) : (
              <Copy size={14} aria-hidden="true" />
            )}
            {copyState === "copied" ? "Copied" : "Copy"}
          </button>
          <span role="status">
            {copyState === "failed"
              ? "Select the response text to copy it."
              : copyState === "copied"
                ? "Copied to clipboard"
                : ""}
          </span>
        </div>
      )}
    </article>
  );
}
