"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  // Hidden reasoning ("Thinking…"), shown as a collapsible dropdown.
  reasoning?: string | null;
};

type Meta = { id: string; title: string; createdAt: number; updatedAt: number };

const LEGACY_KEY = "cocore.conversations.v1";
const JSON_HEADERS = { "Content-Type": "application/json" };

function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function titleFrom(messages: ChatMessage[]): string {
  const firstUser = messages.find((m) => m.role === "user");
  if (!firstUser) return "New chat";
  const t = firstUser.content.trim().replace(/\s+/g, " ");
  if (!t) return "New chat";
  if (t.length <= 44) return t;
  const cut = t.slice(0, 44);
  const lastSpace = cut.lastIndexOf(" ");
  return (lastSpace > 24 ? cut.slice(0, lastSpace) : cut).trimEnd() + "…";
}

async function fetchList(): Promise<Meta[]> {
  try {
    const r = await fetch("/api/conversations", { cache: "no-store" });
    if (!r.ok) return [];
    const d = await r.json();
    return Array.isArray(d?.conversations) ? d.conversations : [];
  } catch {
    return [];
  }
}

/**
 * Server-backed conversation history (synced across devices). Keeps the same
 * public surface as the old localStorage version so the UI is unchanged. Empty
 * draft chats stay client-only until they get a message, then they're persisted.
 */
export function useConversations() {
  const [metas, setMetas] = useState<Meta[]>([]);
  const [msgs, setMsgs] = useState<Record<string, ChatMessage[]>>({});
  const [activeId, setActiveId] = useState<string>("");
  const [loaded, setLoaded] = useState(false);

  // Mirrors for use inside stable callbacks without stale closures.
  const msgsRef = useRef(msgs);
  msgsRef.current = msgs;
  const metasRef = useRef(metas);
  metasRef.current = metas;
  const activeIdRef = useRef(activeId);
  activeIdRef.current = activeId;
  const loadedIds = useRef<Set<string>>(new Set());
  const saveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const startDraft = useCallback(() => {
    const id = uid();
    setMsgs((prev) => ({ ...prev, [id]: [] }));
    loadedIds.current.add(id);
    setActiveId(id);
    return id;
  }, []);

  // Load the conversation list once, migrate any legacy localStorage chats,
  // then open a fresh draft.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      let list = await fetchList();

      // One-time migration: if the server is empty but this browser has old
      // localStorage chats, push them up, then forget the local copy.
      if (list.length === 0) {
        let legacy: { id: string; title: string; messages: ChatMessage[] }[] = [];
        try {
          const raw = localStorage.getItem(LEGACY_KEY);
          if (raw) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed))
              legacy = parsed.filter((c) => c?.messages?.length);
          }
        } catch {
          /* ignore */
        }
        if (legacy.length > 0) {
          for (const c of legacy) {
            try {
              await fetch(`/api/conversations/${c.id}`, {
                method: "PUT",
                headers: JSON_HEADERS,
                body: JSON.stringify({ title: c.title, messages: c.messages }),
              });
            } catch {
              /* best-effort */
            }
          }
          list = await fetchList();
        }
      }
      try {
        localStorage.removeItem(LEGACY_KEY);
      } catch {
        /* ignore */
      }

      if (cancelled) return;
      setMetas(list);
      startDraft();
      setLoaded(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [startDraft]);

  const ensureLoaded = useCallback(async (id: string) => {
    if (loadedIds.current.has(id)) return;
    loadedIds.current.add(id);
    try {
      const r = await fetch(`/api/conversations/${id}`, { cache: "no-store" });
      const list: ChatMessage[] = r.ok
        ? (await r.json())?.conversation?.messages ?? []
        : [];
      setMsgs((prev) => ({ ...prev, [id]: list }));
    } catch {
      setMsgs((prev) => ({ ...prev, [id]: [] }));
    }
  }, []);

  const newChat = useCallback(() => {
    const curr = activeIdRef.current;
    const currMsgs = msgsRef.current[curr] ?? [];
    const inMetas = metasRef.current.some((m) => m.id === curr);
    if (!inMetas && currMsgs.length === 0) return; // already on an empty draft
    startDraft();
  }, [startDraft]);

  const selectChat = useCallback(
    (id: string) => {
      setActiveId(id);
      void ensureLoaded(id);
    },
    [ensureLoaded]
  );

  const scheduleSave = useCallback((id: string) => {
    if (saveTimers.current[id]) clearTimeout(saveTimers.current[id]);
    saveTimers.current[id] = setTimeout(() => {
      const messages = msgsRef.current[id] ?? [];
      if (messages.length === 0) return; // never persist an empty draft
      const meta = metasRef.current.find((m) => m.id === id);
      const title = meta?.title ?? titleFrom(messages);
      fetch(`/api/conversations/${id}`, {
        method: "PUT",
        headers: JSON_HEADERS,
        body: JSON.stringify({ title, messages }),
      }).catch(() => {});
    }, 400);
  }, []);

  const setActiveMessages = useCallback(
    (messages: ChatMessage[]) => {
      const id = activeIdRef.current;
      if (!id) return;
      setMsgs((prev) => ({ ...prev, [id]: messages }));
      loadedIds.current.add(id);

      setMetas((prev) => {
        const existing = prev.find((m) => m.id === id);
        const now = Date.now();
        if (messages.length === 0) {
          return existing ? prev.filter((m) => m.id !== id) : prev;
        }
        const title =
          existing && existing.title !== "New chat"
            ? existing.title
            : titleFrom(messages);
        const rest = prev.filter((m) => m.id !== id);
        const createdAt = existing?.createdAt ?? now;
        return [{ id, title, createdAt, updatedAt: now }, ...rest];
      });

      scheduleSave(id);
    },
    [scheduleSave]
  );

  const deleteChat = useCallback((id: string) => {
    if (saveTimers.current[id]) clearTimeout(saveTimers.current[id]);
    setMetas((prev) => prev.filter((m) => m.id !== id));
    setMsgs((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    loadedIds.current.delete(id);
    fetch(`/api/conversations/${id}`, { method: "DELETE" }).catch(() => {});

    if (activeIdRef.current === id) {
      const fallback = metasRef.current.find((m) => m.id !== id);
      if (fallback) {
        setActiveId(fallback.id);
        void ensureLoaded(fallback.id);
      } else {
        startDraft();
      }
    }
  }, [ensureLoaded, startDraft]);

  const renameChat = useCallback((id: string, title: string) => {
    const clean = title.trim();
    if (!clean) return;
    setMetas((prev) =>
      prev.map((m) => (m.id === id ? { ...m, title: clean } : m))
    );
    fetch(`/api/conversations/${id}`, {
      method: "PUT",
      headers: JSON_HEADERS,
      body: JSON.stringify({ title: clean }),
    }).catch(() => {});
  }, []);

  const active = useMemo(
    () => (activeId ? { id: activeId, messages: msgs[activeId] ?? [] } : null),
    [activeId, msgs]
  );

  // Whether the active conversation's messages are loaded (drafts are instant).
  const activeReady = activeId in msgs;

  const history = useMemo(
    () => [...metas].sort((a, b) => b.updatedAt - a.updatedAt),
    [metas]
  );

  return {
    loaded,
    activeId,
    active,
    activeReady,
    history,
    newChat,
    selectChat,
    deleteChat,
    renameChat,
    setActiveMessages,
  };
}
