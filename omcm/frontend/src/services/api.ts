import { requestFeedback } from "./requestFeedback";
const base = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");
let authorization = "";
let browserDemo = import.meta.env.VITE_DEMO_MODE === "true";
export function enableBrowserDemo() {
  browserDemo = true;
  authorization = "";
}
export function isBrowserDemo() {
  return browserDemo;
}
export function setCredentials(username: string, password: string) {
  authorization =
    "Basic " +
    btoa(
      Array.from(new TextEncoder().encode(`${username}:${password}`), (byte) =>
        String.fromCharCode(byte),
      ).join(""),
    );
}
export function clearCredentials() {
  authorization = "";
}
export async function api<T>(
  path: string,
  body?: unknown,
  signal?: AbortSignal,
): Promise<T> {
  if (browserDemo) {
    const { demoApi } = await import("./demoApi");
    const data = await demoApi(path, body);
    signal?.throwIfAborted();
    return data as T;
  }
  const response = await fetch(`${base}/api${path}`, {
    method: body === undefined ? "GET" : "POST",
    signal,
    headers: {
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      ...(authorization ? { Authorization: authorization } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  }).catch((error: Error) => {
    if (signal?.aborted) throw error;
    throw new Error(
      "We could not connect to the planning service. Check your connection and try again.",
    );
  });
  let data;
  try {
    data = await response.json();
  } catch {
    throw new Error(
      "We could not read the planning service’s response. Please try again. If the problem continues, contact your system administrator.",
    );
  }
  if (!response.ok) {
    throw new Error(requestFeedback(path, response.status, data?.detail));
  }
  return data as T;
}
