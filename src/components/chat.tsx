"use client";

import { useEffect, useRef, useState } from "react";
import {
  ArrowUp,
  Loader2,
  Square,
  Users,
  Globe,
  SlidersHorizontal,
  Menu,
  PenSquare,
  ChevronRight,
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
  "Explain how co/core routes requests across the network.",
  "Write a short poem about decentralized AI.",
  "Give me three ideas for a side project this weekend.",
  "What's the difference between temperature and top_p?",
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
  const rawRef = useRef(""); // raw, unsanitized text of the streaming reply
  const settingsReady = useRef(false);
  const lastSavedRef = useRef("");

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

  // Load available models and the account's saved preferences together so the
  // picker and sliders reflect what was chosen last (synced across devices).
  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch("/api/models")
        .then((r) => r.json())
        .catch(() => ({})),
      fetch("/api/settings", { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null),
    ]).then(([modelsData, settingsData]) => {
      if (cancelled) return;
      const list: ModelSummary[] = modelsData?.models ?? [];
      const sorted = [...list].sort((a, b) => b.machineCount - a.machineCount);
      setModels(sorted);

      const s = settingsData?.settings;
      if (s) {
        if (typeof s.friendsOnly === "boolean") setFriendsOnly(s.friendsOnly);
        if (typeof s.temperature === "number") setTemperature(s.temperature);
        if (typeof s.topP === "number") setTopP(s.topP);
        if (typeof s.maxTokens === "number") setMaxTokens(s.maxTokens);
      }

      // Prefer the saved model if it's still being served, else a real model
      // over the "stub" echo.
      const savedAvailable =
        s?.model && sorted.some((m) => m.modelId === s.model);
      const preferred = sorted.find((m) => m.modelId !== "stub") ?? sorted[0];
      const chosen = savedAvailable ? s.model : preferred?.modelId;
      if (chosen) setModel(chosen);

      // Record the loaded snapshot so we don't immediately echo it back.
      lastSavedRef.current = JSON.stringify({
        model: chosen ?? "",
        friendsOnly: s?.friendsOnly ?? false,
        temperature: s?.temperature ?? 0.7,
        topP: s?.topP ?? 1,
        maxTokens: s?.maxTokens ?? 1024,
      });
      settingsReady.current = true;
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Persist preference changes (debounced) once the initial load has applied.
  useEffect(() => {
    if (!settingsReady.current) return;
    const snap = JSON.stringify({
      model,
      friendsOnly,
      temperature,
      topP,
      maxTokens,
    });
    if (snap === lastSavedRef.current) return;
    const t = setTimeout(() => {
      lastSavedRef.current = snap;
      fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: snap,
      }).catch(() => {});
    }, 500);
    return () => clearTimeout(t);
  }, [model, friendsOnly, temperature, topP, maxTokens]);

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
    rawRef.current = "";
    setMessages((m) => [...m, { role: "assistant", content: "", reasoning: "" }]);

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
          // co/core can emit an inline error frame mid-stream (e.g. a provider
          // or payment failure). Surface it instead of leaving an empty reply.
          if (json?.error) {
            const code = json.error.code;
            failAssistant(
              (code && ERROR_COPY[code]) ||
                json.error.message ||
                "The provider returned an error."
            );
            return;
          }
          const delta: string | undefined = json?.choices?.[0]?.delta?.content;
          if (delta) {
            rawRef.current += delta;
            // Split the running output into the clean answer and the hidden
            // reasoning so each is stored (and persisted) separately.
            const { text, reasoning } = sanitizeAssistant(rawRef.current);
            setMessages((m) => {
              const copy = [...m];
              const last = copy[copy.length - 1];
              if (last?.role === "assistant") {
                copy[copy.length - 1] = { ...last, content: text, reasoning };
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
      <div className="flex items-end gap-2 rounded-[28px] border bg-card px-2.5 py-2 shadow-sm transition-colors focus-within:border-ring">
        <Textarea
          ref={taRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Message atGPT…"
          aria-label="Message atGPT"
          rows={1}
          className="max-h-[200px] min-h-[40px] flex-1 resize-none border-0 bg-transparent px-2 py-2 text-base shadow-none focus-visible:ring-0"
          disabled={streaming}
        />
        {streaming ? (
          <Button
            type="button"
            onClick={stop}
            size="icon"
            className="h-11 w-11 shrink-0 rounded-full active:opacity-75"
            aria-label="Stop generating"
          >
            <Square className="h-4 w-4" />
          </Button>
        ) : (
          <Button
            type="button"
            onClick={() => send()}
            size="icon"
            className="h-11 w-11 shrink-0 rounded-full active:opacity-75"
            disabled={!input.trim() || !model}
            aria-label="Send message"
          >
            <ArrowUp className="h-4 w-4" />
          </Button>
        )}
      </div>
      <p className="mt-2 text-center text-xs text-muted-foreground">
        {friendsOnly ? "Friends-only routing. " : "Open network routing. "}
        Responses come from co/core&apos;s distributed nodes and can be wrong.
      </p>
    </div>
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Screen-reader status for streaming */}
      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {streaming ? "atGPT is responding…" : ""}
      </div>

      {/* Top bar */}
      <header className="flex items-center gap-2 border-b px-3 py-2.5">
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden"
          onClick={onMenu}
          aria-label="Open navigation"
          aria-controls="sidebar-nav"
        >
          <Menu className="h-4 w-4" />
        </Button>

        <Select
          value={model}
          onChange={(e) => setModel(e.target.value)}
          disabled={streaming}
          aria-label="Model"
          className="h-10 w-auto max-w-[60vw] border-0 bg-transparent pr-7 font-medium shadow-none hover:bg-accent"
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
            aria-pressed={friendsOnly}
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
            aria-expanded={showParams}
            aria-controls="params-panel"
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
            aria-label="New chat"
          >
            <PenSquare className="h-4 w-4" />
          </Button>
        </div>
      </header>

      {/* Sampling params */}
      {showParams && (
        <div id="params-panel" className="grid grid-cols-1 gap-3 border-b bg-muted/30 px-4 py-3 sm:grid-cols-3">
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
            <div className="mb-5 flex justify-center">
              <span className="grid h-12 w-12 place-items-center rounded-2xl bg-primary text-xl font-extrabold text-primary-foreground">
                @
              </span>
            </div>
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
                  className="min-h-[44px] rounded-full border px-4 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground active:bg-accent active:text-foreground disabled:opacity-50"
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
            role="log"
            aria-label="Conversation"
            aria-relevant="additions"
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
                  <AssistantMessage
                    key={i}
                    content={m.content}
                    reasoning={m.reasoning}
                    live={streaming && i === messages.length - 1}
                  />
                )
              )}
            </div>
          </div>
          <div
            className="px-4"
            style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}
          >
            <div className="mx-auto max-w-3xl">{composer}</div>
          </div>
        </>
      )}
    </div>
  );
}

function AssistantMessage({
  content,
  reasoning,
  live,
}: {
  content: string;
  reasoning?: string | null;
  live?: boolean;
}) {
  const hasReasoning = !!reasoning && reasoning.trim().length > 0;
  // "Thinking" = actively streaming reasoning before any answer has arrived.
  const thinkingNow = !!live && !content;

  return (
    <div className="flex gap-3">
      <div className="grid h-7 w-7 shrink-0 place-items-center rounded-xl bg-primary text-xs font-extrabold text-primary-foreground">
        @
      </div>
      <div className="min-w-0 flex-1 pt-0.5">
        {hasReasoning && <Reasoning text={reasoning!.trim()} live={thinkingNow} />}
        {content ? (
          <Markdown content={content} />
        ) : (
          !hasReasoning &&
          live && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Thinking…
            </div>
          )
        )}
      </div>
    </div>
  );
}

/** Collapsible "Thinking" dropdown. Auto-opens while the model is reasoning,
 *  then collapses once the answer starts. Height animates via grid-rows. */
function Reasoning({ text, live }: { text: string; live: boolean }) {
  const [open, setOpen] = useState(live);
  const wasLive = useRef(live);
  useEffect(() => {
    // Collapse automatically the moment thinking finishes.
    if (wasLive.current && !live) setOpen(false);
    wasLive.current = live;
  }, [live]);

  return (
    <div className="mb-2">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        {live ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <ChevronRight
            className={cn(
              "h-3.5 w-3.5 transition-transform",
              open && "rotate-90"
            )}
          />
        )}
        {live ? "Thinking…" : "Thoughts"}
      </button>
      <div
        className="grid transition-[grid-template-rows] duration-300 ease-out"
        style={{ gridTemplateRows: open ? "1fr" : "0fr" }}
      >
        <div className="overflow-hidden">
          <div className="mt-1.5 whitespace-pre-wrap rounded-lg bg-secondary/50 px-3 py-2 text-xs leading-relaxed text-muted-foreground">
            {text}
          </div>
        </div>
      </div>
    </div>
  );
}
