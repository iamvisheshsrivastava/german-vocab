import { storage } from "@/src/utils/storage";

// The API key is a secret — always secureGet/secureSet (Keychain / Encrypted
// SharedPreferences on native, localStorage on web), never the plain KV
// helpers. It never leaves the device except in the Authorization header of
// requests to OpenRouter itself.
const API_KEY_STORAGE_KEY = "gv.openrouter.apikey.v1";
// Set once a key has been explicitly removed via clearApiKey(), so getApiKey()
// stops re-seeding DEFAULT_API_KEY on every call — an explicit "Remove" in
// Settings should stick until the user saves a new key themselves.
const CLEARED_BY_USER_KEY = "gv.openrouter.apikey.clearedByUser.v1";

// Baked in at build time from frontend/.env (EXPO_PUBLIC_* vars are inlined
// into the JS bundle by Expo — see frontend/.env, which is gitignored and
// never committed). This is a single-user personal build: the key ends up
// inside the compiled app bundle itself, so it's only appropriate because
// this APK isn't published or shared — it never touches the git repo.
const DEFAULT_API_KEY = process.env.EXPO_PUBLIC_OPENROUTER_API_KEY;

// Free-tier models only — never swap these for a paid model without an
// explicit ask. OpenRouter's free catalog turns over quickly (models get
// deprecated, and the popular ones get upstream-rate-limited under shared
// load), so requests fall back to the second model on a retryable failure
// instead of hard-failing the whole app when the primary is momentarily
// saturated.
export const OPENROUTER_MODEL = "nvidia/nemotron-3-super-120b-a12b:free";
const FALLBACK_MODEL = "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free";
const API_URL = "https://openrouter.ai/api/v1/chat/completions";

export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type OpenRouterErrorCode =
  | "no_key"
  | "unauthorized"
  | "rate_limited"
  | "network"
  | "unknown";

export class OpenRouterError extends Error {
  code: OpenRouterErrorCode;
  constructor(message: string, code: OpenRouterErrorCode) {
    super(message);
    this.code = code;
  }
}

export async function getApiKey(): Promise<string | null> {
  const key = await storage.secureGet<string | null>(API_KEY_STORAGE_KEY, null);
  if (key && key.trim().length > 0) return key;

  if (DEFAULT_API_KEY && DEFAULT_API_KEY.trim().length > 0) {
    const clearedByUser = await storage.getItem<boolean>(CLEARED_BY_USER_KEY, false);
    if (!clearedByUser) {
      const seeded = DEFAULT_API_KEY.trim();
      await storage.secureSet(API_KEY_STORAGE_KEY, seeded);
      return seeded;
    }
  }
  return null;
}

export async function hasApiKey(): Promise<boolean> {
  return (await getApiKey()) !== null;
}

export async function setApiKey(key: string): Promise<boolean> {
  // An explicit save un-does a previous "Remove", so the built-in default
  // (if any) can seed again later if this key is ever removed too.
  await storage.setItem(CLEARED_BY_USER_KEY, false);
  return storage.secureSet(API_KEY_STORAGE_KEY, key.trim());
}

export async function clearApiKey(): Promise<boolean> {
  await storage.setItem(CLEARED_BY_USER_KEY, true);
  return storage.secureRemove(API_KEY_STORAGE_KEY);
}

async function requestCompletion(key: string, model: string, messages: ChatMessage[]): Promise<Response> {
  return fetch(API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.4,
    }),
  });
}

// A model being deprecated (404) or upstream-saturated (429) is retried once
// against FALLBACK_MODEL; anything else (bad key, network failure) fails
// immediately since a different model won't fix it.
const RETRYABLE_STATUS = new Set([404, 429]);

export async function chatComplete(messages: ChatMessage[]): Promise<string> {
  const key = await getApiKey();
  if (!key) {
    throw new OpenRouterError("No OpenRouter API key configured.", "no_key");
  }

  const modelsToTry = [OPENROUTER_MODEL, FALLBACK_MODEL];
  let lastError: OpenRouterError | null = null;

  for (let i = 0; i < modelsToTry.length; i++) {
    let response: Response;
    try {
      response = await requestCompletion(key, modelsToTry[i], messages);
    } catch {
      throw new OpenRouterError("Couldn't reach OpenRouter — check your connection.", "network");
    }

    if (response.status === 401 || response.status === 403) {
      throw new OpenRouterError("That API key was rejected by OpenRouter.", "unauthorized");
    }

    if (RETRYABLE_STATUS.has(response.status)) {
      lastError = new OpenRouterError(
        response.status === 429
          ? "Rate limited by the free model — try again in a moment."
          : "That free model is no longer available.",
        response.status === 429 ? "rate_limited" : "unknown",
      );
      continue; // try the next model in modelsToTry, if any remain
    }

    if (!response.ok) {
      throw new OpenRouterError(`OpenRouter returned an error (${response.status}).`, "unknown");
    }

    const data = await response.json().catch(() => null);
    const content = data?.choices?.[0]?.message?.content;
    if (typeof content !== "string" || content.trim().length === 0) {
      throw new OpenRouterError("The model returned an empty response.", "unknown");
    }
    return content.trim();
  }

  throw lastError ?? new OpenRouterError("All free models are currently unavailable.", "unknown");
}
