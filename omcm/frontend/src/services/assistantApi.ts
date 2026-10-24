import type { AssistantContent } from "../types/assistant";
const base = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");

/** Always use the backend, including browser planning demos. */
export async function requestAssistant(
  contents: AssistantContent[],
  context: unknown,
  signal: AbortSignal,
): Promise<{ content: AssistantContent; provider: string; model: string }> {
  let response: Response;
  try {
    response = await fetch(`${base}/api/assistant`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents, context }),
      signal: AbortSignal.any([signal, AbortSignal.timeout(110000)]),
    });
  } catch (error) {
    if (signal.aborted) throw error;
    throw new Error(
      "The assistant service could not be reached. Make sure the Python backend is running and try again.",
      { cause: error },
    );
  }
  const result = await response.json().catch(() => null);
  if (!response.ok)
    throw new Error(
      typeof result?.detail === "string"
        ? result.detail
        : "The assistant could not answer. Please try again.",
    );
  if (result?.content?.role !== "model" || !Array.isArray(result.content.parts))
    throw new Error(
      "The assistant returned an unreadable answer. Please try again.",
    );
  return result;
}
