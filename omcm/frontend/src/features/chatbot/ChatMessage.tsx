export interface Message {
  id: number;
  sender: "assistant" | "user";
  text: string;
}
export function ChatMessage({ message }: { message: Message }) {
  return (
    <div className={`workspace-chat-message ${message.sender}`}>
      <strong>{message.sender === "user" ? "You" : "OMCM assistant"}</strong>
      <p>{message.text}</p>
    </div>
  );
}
