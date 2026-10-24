import type { AssistantMessage } from "../../types/assistant";
export function ChatMessage({ message }: { message: AssistantMessage }) {
  return (
    <div className={`workspace-chat-message ${message.sender}`}>
      <strong>{message.sender === "user" ? "You" : "OMCM assistant"}</strong>
      {Boolean(message.actions?.length) && (
        <ul
          className="assistant-action-list"
          aria-label="Completed app actions"
        >
          {message.actions!.map((action, i) => (
            <li key={i}>{action}</li>
          ))}
        </ul>
      )}
      {message.text && (
        <p className={message.error ? "assistant-message-error" : undefined}>
          {message.text}
        </p>
      )}
    </div>
  );
}
