export interface FunctionCall {
  name: string;
  args?: Record<string, unknown>;
  id?: string;
}
export interface AssistantPart {
  text?: string;
  thought?: boolean;
  thoughtSignature?: string;
  functionCall?: FunctionCall;
  functionResponse?: {
    name: string;
    id?: string;
    response: ToolResult;
  };
}
export interface AssistantContent {
  role: "user" | "model";
  parts: AssistantPart[];
}
export interface ToolResult {
  ok: boolean;
  data?: unknown;
  summary?: string;
  error?: string;
}
export interface AssistantMessage {
  id: number;
  sender: "user" | "assistant";
  text: string;
  actions?: string[];
  error?: boolean;
}
