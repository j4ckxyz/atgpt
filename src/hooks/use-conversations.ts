"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type ChatMessage = { role: "user" | "assistant"; content: string };

export type Conversation = {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
};

const STORAGE_KEY = "cocore.conversations.v1";

function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function titleFrom(messages: ChatMessage[]): string {
  const firstUser = messages.find((m) => m.role === "user");
  if (!firstUser) return "New chat";
  const t = firstUser.content.trim().replace(/\s+/g, " ");
  if (!t) return "New chat";
  if (t.length <= 44) return t;
  // Cut at the last word boundary before the limit so titles read cleanly.
  const cut = t.slice(0, 44);
  const lastSpace = cut.lastIndexOf(" ");
  return (lastSpace > 24 ? cut.slice(0, lastSpace) : cut).trimEnd() + "…";
}

function newConversation(): Conversation {
  const now = Date.now();
  return { id: uid(), title: "New chat", messages: [], createdAt: now, updatedAt: now };
}

/**
 * Per-browser conversation history backed by localStorage. Empty draft chats
 * are never persisted or shown in history until they have a message.
 */
export function useConversations() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string>("");
  const [loaded, setLoaded] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load once on mount, then open a fresh draft.
  useEffect(() => {
    let saved: Conversation[] = [];
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) saved = parsed.filter((c) => c?.messages?.length);
      }
    } catch {
      /* corrupt or unavailable storage; start clean */
    }
    const draft = newConversation();
    setConversations([draft, ...saved]);
    setActiveId(draft.id);
    setLoaded(true);
  }, []);

  // Persist non-empty conversations (debounced so streaming doesn't thrash).
  useEffect(() => {
    if (!loaded) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      try {
        const keep = conversations
          .filter((c) => c.messages.length > 0)
          .sort((a, b) => b.updatedAt - a.updatedAt);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(keep));
      } catch {
        /* storage full or unavailable; ignore */
      }
    }, 400);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [conversations, loaded]);

  const active = conversations.find((c) => c.id === activeId) ?? null;

  const newChat = useCallback(() => {
    setConversations((prev) => {
      // Reuse an existing empty draft instead of piling them up.
      const existingDraft = prev.find((c) => c.messages.length === 0);
      if (existingDraft) {
        setActiveId(existingDraft.id);
        return prev;
      }
      const draft = newConversation();
      setActiveId(draft.id);
      return [draft, ...prev];
    });
  }, []);

  const selectChat = useCallback((id: string) => setActiveId(id), []);

  const deleteChat = useCallback(
    (id: string) => {
      setConversations((prev) => {
        const next = prev.filter((c) => c.id !== id);
        if (id === activeId) {
          const fallback = next.find((c) => c.messages.length > 0);
          if (fallback) {
            setActiveId(fallback.id);
            return next;
          }
          const draft = newConversation();
          setActiveId(draft.id);
          return [draft, ...next];
        }
        return next;
      });
    },
    [activeId]
  );

  const renameChat = useCallback((id: string, title: string) => {
    const clean = title.trim();
    setConversations((prev) =>
      prev.map((c) => (c.id === id ? { ...c, title: clean || c.title } : c))
    );
  }, []);

  const setActiveMessages = useCallback(
    (messages: ChatMessage[]) => {
      setConversations((prev) =>
        prev.map((c) =>
          c.id === activeId
            ? {
                ...c,
                messages,
                updatedAt: Date.now(),
                title:
                  c.title === "New chat" ? titleFrom(messages) : c.title,
              }
            : c
        )
      );
    },
    [activeId]
  );

  // History excludes empty drafts, most-recent first.
  const history = conversations
    .filter((c) => c.messages.length > 0)
    .sort((a, b) => b.updatedAt - a.updatedAt);

  return {
    loaded,
    activeId,
    active,
    history,
    newChat,
    selectChat,
    deleteChat,
    renameChat,
    setActiveMessages,
  };
}
