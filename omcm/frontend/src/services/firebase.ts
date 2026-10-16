/** Optional Firebase web configuration. Storage remains on the existing API.
 * No Firebase connection or SDK initialization is performed by this module.
 */
export interface FirebaseConfiguration {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket?: string;
  messagingSenderId?: string;
  appId: string;
  databaseURL?: string;
}

export function getFirebaseConfiguration(
  env: Record<string, unknown> = import.meta.env,
): FirebaseConfiguration | null {
  const read = (name: string) =>
    typeof env[name] === "string" ? env[name].trim() : "";
  const apiKey = read("VITE_FIREBASE_API_KEY");
  const authDomain = read("VITE_FIREBASE_AUTH_DOMAIN");
  const projectId = read("VITE_FIREBASE_PROJECT_ID");
  const appId = read("VITE_FIREBASE_APP_ID");
  if (!apiKey || !authDomain || !projectId || !appId) return null;
  return {
    apiKey,
    authDomain,
    projectId,
    appId,
    storageBucket: read("VITE_FIREBASE_STORAGE_BUCKET") || undefined,
    messagingSenderId: read("VITE_FIREBASE_MESSAGING_SENDER_ID") || undefined,
    databaseURL: read("VITE_FIREBASE_DATABASE_URL") || undefined,
  };
}
