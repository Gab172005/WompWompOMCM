import { create } from "zustand";
import type { NavigateFunction } from "react-router-dom";
import type {
  AssistantContent,
  AssistantMessage,
  AssistantPart,
  ToolResult,
} from "../types/assistant";
import { requestAssistant } from "../services/assistantApi";
import {
  assistantContext,
  executeAssistantTool,
} from "../services/assistantTools";
import { actionConfirmation, fastAssistant } from "../services/assistantFast";

interface Environment {
  navigate: NavigateFunction;
  pathname: () => string;
}
interface AssistantState {
  open: boolean;
  busy: boolean;
  status: string;
  model: string;
  messages: AssistantMessage[];
  contents: AssistantContent[];
  setOpen: (open: boolean) => void;
  clear: () => void;
  stop: () => void;
  send: (text: string, environment: Environment) => Promise<void>;
}
let activeRequest: AbortController | null = null;
let nextId = 0;
// Trim at complete conversational turns, preserving tool pairs and signatures.
function recentTurns(contents: AssistantContent[]) {
  const starts = contents.flatMap((c, i) =>
    c.role === "user" && c.parts.some((p) => p.text) ? [i] : [],
  );
  let start = starts.length > 6 ? starts[starts.length - 6] : 0;
  while (contents.length - start > 60) {
    const next = starts.find((i) => i > start);
    if (next === undefined) break;
    start = next;
  }
  return contents.slice(start);
}
// Completed turns only need their question and final answer. Do not resend old
// tool payloads, simulation timelines or signatures on every new question.
function compactHistory(contents: AssistantContent[]): AssistantContent[] {
  const turns: { question: string; answer: string }[] = [];
  for (const content of contents) {
    const text = content.parts
      .filter((p) => !p.thought)
      .map((p) => p.text ?? "")
      .join("\n")
      .trim();
    if (content.role === "user" && text)
      turns.push({ question: text, answer: "" });
    else if (content.role === "model" && text && turns.length)
      turns[turns.length - 1].answer = text;
  }
  const selected = turns.filter((t) => t.answer).slice(-4);
  while (selected.length > 1 && JSON.stringify(selected).length > 12000)
    selected.shift();
  return selected.flatMap((t): AssistantContent[] => [
    { role: "user", parts: [{ text: t.question }] },
    { role: "model", parts: [{ text: t.answer }] },
  ]);
}
export const useAssistantStore = create<AssistantState>((set, get) => ({
  open: false,
  busy: false,
  status: "",
  model: "",
  messages: [],
  contents: [],
  setOpen: (open) => set({ open }),
  stop: () => activeRequest?.abort(),
  clear: () => {
    activeRequest?.abort();
    activeRequest = null;
    set({ messages: [], contents: [], busy: false, status: "" });
  },
  send: async (value, environment) => {
    const text = value.trim();
    if (!text || text.length > 4000 || get().busy) return;
    const controller = new AbortController();
    activeRequest = controller;
    const id = nextId++,
      actions: string[] = [];
    const contents: AssistantContent[] = [
      ...compactHistory(get().contents),
      { role: "user", parts: [{ text }] },
    ];
    set((s) => ({
      open: true,
      busy: true,
      status: "Thinking…",
      messages: [
        ...s.messages,
        { id: nextId++, sender: "user", text },
        { id, sender: "assistant", text: "", actions: [] },
      ],
    }));
    const update = (text: string, error = false) =>
      set((s) => ({
        messages: s.messages.map((m) =>
          m.id === id ? { ...m, text, error, actions: [...actions] } : m,
        ),
      }));
    try {
      const quick = fastAssistant(text, (call) =>
        executeAssistantTool(
          call,
          environment.navigate,
          environment.pathname(),
        ),
      );
      if (quick) {
        actions.push(
          ...quick.results.flatMap((r) => (r.summary ? [r.summary] : [])),
        );
        update(
          quick.text,
          quick.results.some((r) => !r.ok),
        );
        contents.push({ role: "model", parts: [{ text: quick.text }] });
        set({ contents, model: "App data · instant" });
        return;
      }
      for (let step = 0; step < 8; step++) {
        controller.signal.throwIfAborted();
        const waiting = setTimeout(() => {
          if (activeRequest === controller)
            set({
              status:
                "Gemini is taking a little longer. You can keep waiting or stop this request.",
            });
        }, 12000);
        let result: Awaited<ReturnType<typeof requestAssistant>>;
        try {
          result = await requestAssistant(
            contents,
            assistantContext(environment.pathname()),
            controller.signal,
          );
        } finally {
          clearTimeout(waiting);
        }
        controller.signal.throwIfAborted();
        set({ model: result.model });
        contents.push(result.content);
        const calls = result.content.parts.flatMap((part) =>
          part.functionCall ? [part.functionCall] : [],
        );
        if (!calls.length) {
          const answer = result.content.parts
            .filter((part) => !part.thought)
            .map((part) => part.text ?? "")
            .join("\n")
            .trim();
          if (!answer)
            throw new Error(
              "The assistant returned no answer. Please try again.",
            );
          update(answer);
          set({ contents: recentTurns(contents) });
          return;
        }
        if (calls.length > 12)
          throw new Error(
            "That request has too many actions. Try one task at a time.",
          );
        const responses: AssistantPart[] = [];
        const toolResults: ToolResult[] = [];
        for (const call of calls) {
          controller.signal.throwIfAborted();
          set({ status: `Working: ${call.name.replaceAll("_", " ")}…` });
          const response = executeAssistantTool(
            call,
            environment.navigate,
            environment.pathname(),
          );
          toolResults.push(response);
          if (response.summary) {
            actions.push(response.summary);
            update("");
          }
          responses.push({
            functionResponse: {
              name: call.name,
              ...(call.id ? { id: call.id } : {}),
              response,
            },
          });
          // Flush route effects before the next tool inspects the screen.
          await new Promise((resolve) => setTimeout(resolve, 0));
        }
        contents.push({ role: "user", parts: responses });
        const confirmation = actionConfirmation(text, calls, toolResults);
        if (confirmation) {
          update(
            confirmation,
            toolResults.some((r) => !r.ok),
          );
          contents.push({ role: "model", parts: [{ text: confirmation }] });
          set({ contents: recentTurns(contents) });
          return;
        }
        set({ status: "Preparing your answer…" });
      }
      throw new Error(
        "The assistant reached its action limit. The completed actions are listed above; ask a follow-up to continue.",
      );
    } catch (error) {
      if (activeRequest !== controller) return;
      update(
        controller.signal.aborted
          ? `Stopped.${actions.length ? " The actions listed above were already completed." : ""}`
          : error instanceof Error
            ? error.message
            : "The assistant could not answer. Try again.",
        true,
      );
      // Do not replay an interrupted tool chain on the next request.
      set((s) => ({
        contents: recentTurns([
          ...s.contents,
          { role: "user", parts: [{ text }] },
          {
            role: "model",
            parts: [
              {
                text: actions.length
                  ? `Completed app actions: ${actions.join(" ")} The remaining answer was interrupted.`
                  : "The previous request did not complete.",
              },
            ],
          },
        ]),
      }));
    } finally {
      if (activeRequest === controller) {
        activeRequest = null;
        set({ busy: false, status: "" });
      }
    }
  },
}));
