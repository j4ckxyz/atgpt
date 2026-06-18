/**
 * Server-side helpers for talking to the co/core API.
 *
 * co/core is an OpenAI-compatible exchange. The user's `cocore-…` API key is
 * the only credential — it resolves to their DID server-side. We never expose
 * the key to the browser: it lives in an httpOnly cookie and is attached here.
 */
import { cookies } from "next/headers";

export const COCORE_BASE =
  process.env.COCORE_BASE_URL ?? "https://console.cocore.dev";

export const SESSION_COOKIE = "cocore_key";

/** Read the API key from the session cookie (server only). */
export async function getApiKey(): Promise<string | null> {
  const store = await cookies();
  return store.get(SESSION_COOKIE)?.value ?? null;
}

export type AgentStatus = {
  did: string;
  currency: string;
  balance: number | null;
  earned24h: number;
  trustLevel: string | null;
  agentVersion: string | null;
};

export type ModelSummary = {
  modelId: string;
  machineCount: number;
  inputPricePerMTok: number | null;
  outputPricePerMTok: number | null;
  currency: string | null;
};

export type ModelDirectorySummary = {
  models: ModelSummary[];
  generatedAt: string;
  appviewUnreachable: boolean;
};

export type ActivityCount = { requests: number; tokens: number };

export type ActivityWindows = {
  hour?: ActivityCount;
  day?: ActivityCount;
  week?: ActivityCount;
  month?: ActivityCount;
};

export type ModelMachine = {
  did: string;
  machineLabel: string | null;
  chip: string | null;
  ramGB: number | null;
  lastSeen: string | null;
  activity?: ActivityWindows;
};

export type ModelDirectoryEntry = ModelSummary & {
  freshestAt: string | null;
  machines: ModelMachine[];
  activity?: ActivityWindows;
};

export type ModelDirectory = {
  models: ModelDirectoryEntry[];
  generatedAt: string;
  appviewUnreachable: boolean;
};

/** GET /api/agent/status — credit balance, 24h earnings, trust, version. */
export async function fetchAgentStatus(
  key: string
): Promise<{ ok: true; data: AgentStatus } | { ok: false; status: number; message: string }> {
  const res = await fetch(`${COCORE_BASE}/api/agent/status`, {
    headers: { Authorization: `Bearer ${key}` },
    cache: "no-store",
  });
  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      message = body?.error ?? body?.error?.message ?? message;
    } catch {
      /* non-JSON body */
    }
    return { ok: false, status: res.status, message };
  }
  return { ok: true, data: (await res.json()) as AgentStatus };
}

/** GET /agent/version — latest released agent/app version (plain text). */
export async function fetchLatestVersion(): Promise<string | null> {
  try {
    const res = await fetch(`${COCORE_BASE}/agent/version`, {
      next: { revalidate: 300 },
    });
    if (!res.ok) return null;
    return (await res.text()).trim();
  } catch {
    return null;
  }
}

/** GET /v1/models?view=summary — public directory of served models. */
export async function fetchModels(): Promise<ModelDirectorySummary | null> {
  try {
    const res = await fetch(`${COCORE_BASE}/api/v1/models?view=summary`, {
      next: { revalidate: 30 },
    });
    if (!res.ok) return null;
    return (await res.json()) as ModelDirectorySummary;
  } catch {
    return null;
  }
}

/** GET /v1/models?view=directory — full per-machine detail + activity windows. */
export async function fetchDirectory(): Promise<ModelDirectory | null> {
  try {
    const res = await fetch(`${COCORE_BASE}/api/v1/models?view=directory`, {
      next: { revalidate: 30 },
    });
    if (!res.ok) return null;
    return (await res.json()) as ModelDirectory;
  } catch {
    return null;
  }
}
