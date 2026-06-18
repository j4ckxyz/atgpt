"use client";

import { useEffect, useRef, useState } from "react";
import {
  SendHorizonal,
  Loader2,
  Square,
  Users,
  Globe,
  Trash2,
  Bot,
  User as UserIcon,
  SlidersHorizontal,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { ModelSummary } from "@/lib/cocore";

type Msg = { role: "user" | "assistant"; content: string };

// Friendly messages for co/core's stable error codes.
const ERROR_COPY: Record<string, string> = {
  model_not_found:
    "No connected provider is serving that model right now. Try another.",
  no_providers_connected:
    "No providers are connected to the exchange at the moment.",
  no_friends_available:
    "None of your friends are online. Toggle off friends-only or add friends.",
  no_friends_for_model:
    "Your friends are online but none serve that model. Try another model.",
};

export function Chat() {
  const [models, setModels] = useState<ModelSummary[]>([]);
  const [model, setModel] = useState("");
  const [friendsOnly, setFriendsOnly] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Request parameters (exposed in the API: temperature, top_p, max_tokens).
  const [showParams, setShowParams] = useState(false);
  const [temperature, setTemperature] = useState(0.7);
  const [topP, setTopP] = useState(1);
  const [maxTokens, setMaxTokens] = useState(1024);

  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/models")
      .then((r) => r.json())
      .then((d) => {
        const list: ModelSummary[] = d?.models ?? [];
        const sorted = [...list].sort(
          (a, b) => b.machineCount - a.machineCount
        );
        setModels(sorted);
        if (sorted.length) setModel(sorted[0].modelId);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, streaming]);

  function stop() {
    abortRef.current?.abort();
  }

  async function send() {
    const text = input.trim();
    if (!text || streaming || !model) return;

    setError(null);
    const next: Msg[] = [...messages, { role: "user", content: text }];
    setMessages(next);
    setInput("");
    setStreaming(true);

    // Placeholder assistant message we stream into.
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
        // Error envelope (JSON) rather than a stream.
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
      if ((e as Error).name === "AbortError") {
        // Keep whatever streamed so far; just stop.
      } else {
        failAssistant("Network error while streaming the response.");
      }
    } finally {
      setStreaming(false);
      abortRef.current = null;
    }
  }

  function failAssistant(message: string) {
    setError(message);
    // Drop the empty assistant placeholder if nothing streamed.
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
      buffer = lines.pop() ?? ""; // keep the partial line

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
          /* a non-JSON keep-alive line; ignore */
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

  return (
    <div className="flex h-[calc(100vh-3.5rem)] flex-col">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3 border-b px-4 py-3">
        <div className="min-w-0 flex-1">
          <Select
            value={model}
            onChange={(e) => setModel(e.target.value)}
            disabled={streaming}
          >
            {models.length === 0 && <option value="">Loading models…</option>}
            {models.map((m) => (
              <option key={m.modelId} value={m.modelId}>
                {m.modelId} · {m.machineCount} machine
                {m.machineCount === 1 ? "" : "s"}
              </option>
            ))}
          </Select>
        </div>

        <Button
          type="button"
          variant={friendsOnly ? "default" : "outline"}
          size="sm"
          onClick={() => setFriendsOnly((v) => !v)}
          disabled={streaming}
          title="Constrain routing to providers run by DIDs you've friended"
        >
          {friendsOnly ? (
            <Users className="h-4 w-4" />
          ) : (
            <Globe className="h-4 w-4" />
          )}
          {friendsOnly ? "Friends only" : "Open network"}
        </Button>

        <Button
          type="button"
          variant={showParams ? "secondary" : "outline"}
          size="sm"
          onClick={() => setShowParams((v) => !v)}
          title="Sampling parameters"
        >
          <SlidersHorizontal className="h-4 w-4" />
          Params
        </Button>

        {messages.length > 0 && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              setMessages([]);
              setError(null);
            }}
            disabled={streaming}
          >
            <Trash2 className="h-4 w-4" />
            Clear
          </Button>
        )}
      </div>

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

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl space-y-5 px-4 py-6">
          {messages.length === 0 && (
            <div className="grid place-items-center py-20 text-center">
              <Bot className="mb-3 h-10 w-10 text-muted-foreground" />
              <h2 className="text-lg font-medium">Chat with the cooperative</h2>
              <p className="mt-1 max-w-md text-sm text-muted-foreground">
                Your prompt is dispatched through the co/core exchange to a
                paired provider&apos;s attested Mac. Spending credits as you go.
              </p>
            </div>
          )}

          {messages.map((m, i) => (
            <div
              key={i}
              className={cn(
                "flex gap-3",
                m.role === "user" && "flex-row-reverse"
              )}
            >
              <div
                className={cn(
                  "grid h-7 w-7 shrink-0 place-items-center rounded-md",
                  m.role === "user"
                    ? "bg-secondary"
                    : "bg-primary text-primary-foreground"
                )}
              >
                {m.role === "user" ? (
                  <UserIcon className="h-4 w-4" />
                ) : (
                  <Bot className="h-4 w-4" />
                )}
              </div>
              <div
                className={cn(
                  "max-w-[80%] whitespace-pre-wrap rounded-lg px-3.5 py-2.5 text-sm leading-relaxed",
                  m.role === "user"
                    ? "bg-secondary"
                    : "border bg-card"
                )}
              >
                {m.content || (
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Composer */}
      <div className="border-t bg-background px-4 py-3">
        <div className="mx-auto max-w-3xl">
          {error && (
            <p className="mb-2 text-sm text-destructive" role="alert">
              {error}
            </p>
          )}
          <div className="flex items-end gap-2">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Message the cooperative…  (Enter to send, Shift+Enter for newline)"
              rows={1}
              className="max-h-40 min-h-[44px] flex-1 resize-none"
              disabled={streaming}
            />
            {streaming ? (
              <Button type="button" variant="outline" onClick={stop} size="icon">
                <Square className="h-4 w-4" />
              </Button>
            ) : (
              <Button
                type="button"
                onClick={send}
                size="icon"
                disabled={!input.trim() || !model}
              >
                <SendHorizonal className="h-4 w-4" />
              </Button>
            )}
          </div>
          <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
            <Badge variant="outline">{model || "no model"}</Badge>
            <span>
              {friendsOnly
                ? "routed to your friends only"
                : "routed across the open network"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
