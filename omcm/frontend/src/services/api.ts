const base = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");
let authorization = "";
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
  const response = await fetch(`${base}/api${path}`, {
    method: body === undefined ? "GET" : "POST",
    signal,
    headers: {
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      ...(authorization ? { Authorization: authorization } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  let data;
  try {
    data = await response.json();
  } catch {
    throw new Error(
      `API returned an unreadable response (${response.status}). Check the backend URL.`,
    );
  }
  if (!response.ok) {
    const detail = data.detail;
    throw new Error(
      typeof detail === "string"
        ? detail
        : Array.isArray(detail)
          ? detail
              .map(
                (e: { loc: string[]; msg: string }) =>
                  `${e.loc.join(".")}: ${e.msg}`,
              )
              .join("; ")
          : `Request failed (${response.status})`,
    );
  }
  return data as T;
}
