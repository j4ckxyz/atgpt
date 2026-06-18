"use client";

import { useEffect, useRef, useState } from "react";
import {
  ArrowUp,
  Loader2,
  Square,
  Users,
  Globe,
  Bot,
  SlidersHorizontal,
  Menu,
  PenSquare,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Markdown } from "@/components/markdown";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { prettyModel } from "@/lib/models";
import { sanitizeAssistant } from "@/lib/sanitize";
import type { ModelSummary } from "@/lib/cocore";
import type { ChatMessage } from "@/hooks/use-conversations";

type Msg = ChatMessage;

// Friendly messages for co/core's stable error codes.
const ERROR_COPY: Record<string, string> = {
  model_not_found:
    "No connected provider is serving that model right now. Try another.",
  no_providers_connected:
    "No providers are connected to the exchange at the moment.",
  no_friends_available:
    "None of your friends are online. Switch to the open network or add friends.",
  no_friends_for_model:
    "Your friends are online but none serve that model. Try another model.",
};

const SUGGESTIONS = [
  "Explain how the co/core exchange routes a request.",
  "Write a haiku about decentralized compute.",
  "Give me three ideas for a weekend project.",
  "Summarize what an attested provider is.",
];

export function Chat({
  onMenu,
  onNewChat,
  initialMessages = [],
  onMessagesChange,
}: {
  onMenu?: () => void;
  onNewChat?: () => void;
  initialMessages?: Msg[];
  onMessagesChange?: (messages: Msg[]) => void;
}) {
  const [models, setModels] = useState<ModelSummary[]>([]);
  const [model, setModel] = useState("");
  const [friendsOnly, setFriendsOnly] = useState(false);
  const [messages, setMessages] = useState<Msg[]>(initialMessages);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [showParams, setShowParams] = useState(false);
  const [temperature, setTemperature] = useState(0.7);
  const [topP, setTopP] = useState(1);
  const [maxTokens, setMaxTokens] = useState(1024);

  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const atBottomRef = useRef(true);

  function onScroll() {
    const el = scrollRef.current;
    if (!el) return;
    atBottomRef.current =
      el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  }

  function scrollToBottom(smooth = false) {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: smooth ? "smooth" : "auto" });
  }

  // Persist messages up to the conversation store (debounced; skip mount).
  const persistRef = useRef(onMessagesChange);
  persistRef.current = onMessagesChange;
  const firstRun = useRef(true);
  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
    const t = setTimeout(() => persistRef.current?.(messages), 150);
    return () => clearTimeout(t);
  }, [messages]);

  const selected = models.find((m) => m.modelId === model);

  useEffect(() => {
    fetch("/api/models")
      .then((r) => r.json())
      .then((d) => {
        const list: ModelSummary[] = d?.models ?? [];
        const sorted = [...list].sort(
          (a, b) => b.machineCount - a.machineCount
        );
        setModels(sorted);
        // Prefer a real model over the "stub" echo for the default.
        const preferred =
          sorted.find((m) => m.modelId !== "stub") ?? sorted[0];
        if (preferred) setModel(preferred.modelId);
      })
      .catch(() => {});
  }, []);

  // Follow new output only when the user is already at the bottom.
  useEffect(() => {
    if (atBottomRef.current) scrollToBottom(false);
  }, [messages, streaming]);

  // Auto-grow the textarea.
  useEffect(() => {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 200) + "px";
  }, [input]);

  function stop() {
    abortRef.current?.abort();
  }

  async function send(text?: string) {
    const content = (text ?? input).trim();
    if (!content || streaming || !model) return;

    setError(null);
    const next: Msg[] = [...messages, { role: "user", content }];
    setMessages(next);
    setInput("");
    setStreaming(true);
    atBottomRef.current = true; // jump to the message you just sent
    setMessages((m) => [...m, { role: "assistant", content: "" }]);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          model,
          friendsOnly,
          messages: next,
          temperature,
          top_p: topP,
          max_tokens: maxTokens,
        }),
      });

      const contentType = res.headers.get("content-type") ?? "";
      if (!res.ok || !contentType.includes("text/event-stream")) {
        let msg = `Request failed (${res.status})`;
        try {
          const body = await res.json();
          const code = body?.error?.code;
          msg =
            (code && ERROR_COPY[code]) ||
            body?.error?.message ||
            body?.error ||
            msg;
        } catch {
          /* ignore */
        }
        failAssistant(msg);
        return;
      }

      await consumeStream(res.body!);
    } catch (e) {
      if ((e as Error).name !== "AbortError") {
        failAssistant("Network error while streaming the response.");
      }
    } finally {
      setStreaming(false);
      abortRef.current = null;
    }
  }

  function failAssistant(message: string) {
    setError(message);
    setMessages((m) => {
      const last = m[m.length - 1];
      if (last && last.role === "assistant" && last.content === "") {
        return m.slice(0, -1);
      }
      return m;
    });
  }

  async function consumeStream(body: ReadableStream<Uint8Array>) {
    const reader = body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const raw of lines) {
        const line = raw.trim();
        if (!line.startsWith("data:")) continue;
        const data = line.slice(5).trim();
        if (data === "[DONE]") return;
        try {
          const json = JSON.parse(data);
          const delta: string | undefined = json?.choices?.[0]?.delta?.content;
          if (delta) {
            setMessages((m) => {
              const copy = [...m];
              const last = copy[copy.length - 1];
              if (last?.role === "assistant") {
                copy[copy.length - 1] = {
                  ...last,
                  content: last.content + delta,
                };
              }
              return copy;
            });
          }
        } catch {
          /* keep-alive / non-JSON line */
        }
      }
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  const empty = messages.length === 0;

  const composer = (
    <div className="w-full">
      {error && (
        <p className="mb-2 text-center text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
      <div className="flex items-end gap-2 rounded-[28px] border bg-card px-2.5 py-2 shadow-sm transition-colors focus-within:border-ring/60">
        <Textarea
          ref={taRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Message the cooperative…"
          rows={1}
          className="max-h-[200px] min-h-[40px] flex-1 resize-none border-0 bg-transparent px-2 py-2 text-base shadow-none focus-visible:ring-0"
          disabled={streaming}
        />
        {streaming ? (
          <Button
            type="button"
            onClick={stop}
            size="icon"
            className="h-9 w-9 shrink-0 rounded-full"
            title="Stop"
          >
            <Square className="h-4 w-4" />
          </Button>
        ) : (
          <Button
            type="button"
            onClick={() => send()}
            size="icon"
            className="h-9 w-9 shrink-0 rounded-full"
            disabled={!input.trim() || !model}
            title="Send"
          >
            <ArrowUp className="h-4 w-4" />
          </Button>
        )}
      </div>
      <p className="mt-2 text-center text-xs text-muted-foreground">
        {friendsOnly
          ? "Routing limited to your friends. "
          : "Routing across the open network. "}
        Replies come from strangers&apos; attested Macs and can be wrong.
      </p>
    </div>
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Top bar */}
      <header className="flex items-center gap-2 border-b px-3 py-2.5">
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden"
          onClick={onMenu}
        >
          <Menu className="h-4 w-4" />
        </Button>

        <Select
          value={model}
          onChange={(e) => setModel(e.target.value)}
          disabled={streaming}
          className="h-8 w-auto max-w-[60vw] border-0 bg-transparent pr-7 font-medium shadow-none hover:bg-accent"
        >
          {models.length === 0 && <option value="">Loading models…</option>}
          {models.map((m) => (
            <option key={m.modelId} value={m.modelId}>
              {prettyModel(m.modelId)}
            </option>
          ))}
        </Select>

        <div className="ml-auto flex items-center gap-1.5">
          <Button
            type="button"
            variant={friendsOnly ? "default" : "outline"}
            size="sm"
            onClick={() => setFriendsOnly((v) => !v)}
            title="Friends-only changes routing only — machine counts shown are network-wide"
          >
            {friendsOnly ? (
              <Users className="h-4 w-4" />
            ) : (
              <Globe className="h-4 w-4" />
            )}
            <span className="hidden sm:inline">
              {friendsOnly ? "Friends only" : "Open network"}
            </span>
          </Button>
          <Button
            type="button"
            variant={showParams ? "secondary" : "outline"}
            size="sm"
            onClick={() => setShowParams((v) => !v)}
            title="Sampling parameters"
          >
            <SlidersHorizontal className="h-4 w-4" />
            <span className="hidden sm:inline">Params</span>
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={onNewChat}
            title="New chat"
          >
            <PenSquare className="h-4 w-4" />
          </Button>
        </div>
      </header>

      {/* Sampling params */}
      {showParams && (
        <div className="grid grid-cols-1 gap-3 border-b bg-muted/30 px-4 py-3 sm:grid-cols-3">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">
              temperature · {temperature.toFixed(2)}
            </Label>
            <Input
              type="range"
              min={0}
              max={2}
              step={0.05}
              value={temperature}
              onChange={(e) => setTemperature(Number(e.target.value))}
              disabled={streaming}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">
              top_p · {topP.toFixed(2)}
            </Label>
            <Input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={topP}
              onChange={(e) => setTopP(Number(e.target.value))}
              disabled={streaming}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">max_tokens</Label>
            <Input
              type="number"
              min={1}
              max={8192}
              value={maxTokens}
              onChange={(e) =>
                setMaxTokens(
                  Math.max(1, Math.min(8192, Number(e.target.value) || 1))
                )
              }
              disabled={streaming}
              className="font-mono"
            />
          </div>
        </div>
      )}

      {empty ? (
        /* Centered, ChatGPT-style empty state */
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-4">
          <div className="w-full max-w-2xl">
            <h1 className="mb-6 text-center text-2xl font-semibold tracking-tight sm:text-3xl">
              What can I help with?
            </h1>
            {composer}
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => send(s)}
                  disabled={!model}
                  className="rounded-full border px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-50"
                >
                  {s}
                </button>
              ))}
            </div>
            {selected && (
              <p className="mt-5 text-center text-xs text-muted-foreground">
                {prettyModel(selected.modelId)} · {selected.machineCount} machine
                {selected.machineCount === 1 ? "" : "s"} on the network
              </p>
            )}
          </div>
        </div>
      ) : (
        <>
          <div
            ref={scrollRef}
            onScroll={onScroll}
            className="min-h-0 flex-1 overflow-y-auto"
          >
            <div className="mx-auto max-w-3xl space-y-6 px-4 py-6">
              {messages.map((m, i) =>
                m.role === "user" ? (
                  <div key={i} className="flex justify-end">
                    <div className="max-w-[85%] whitespace-pre-wrap break-words rounded-3xl bg-secondary px-4 py-2.5 text-base leading-relaxed">
                      {m.content}
                    </div>
                  </div>
                ) : (
                  <AssistantMessage key={i} content={m.content} />
                )
              )}
            </div>
          </div>
          <div className="px-4 pb-4">
            <div className="mx-auto max-w-3xl">{composer}</div>
          </div>
        </>
      )}
    </div>
  );
}

function AssistantMessage({ content }: { content: string }) {
  const { text, thinking } = sanitizeAssistant(content);
  return (
    <div className="flex gap-3">
      <div className="grid h-7 w-7 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground">
        <Bot className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1 pt-0.5">
        {text ? (
          <Markdown content={text} />
        ) : (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            {thinking ? "Thinking…" : ""}
          </div>
        )}
      </div>
    </div>
  );
}
