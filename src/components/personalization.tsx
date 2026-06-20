"use client";

import { useEffect, useState } from "react";
import {
  Sparkles,
  KeyRound,
  RefreshCw,
  ExternalLink,
  Check,
  Loader2,
  Music,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

type Facts = {
  topArtists?: { name: string; plays: number }[];
  totalPlays?: number;
  postsAnalyzed?: number;
} | null;

type Status = {
  atPersonalization: boolean;
  hasGeminiKey: boolean;
  handle: string | null;
  displayName: string | null;
  hasProfile: boolean;
  profilePreview: string | null;
  facts: Facts;
  counts: { posts: number; plays: number };
  lastIngestAt: number | null;
  lastCondensedAt: number | null;
};

function relTime(secs: number | null): string {
  if (!secs) return "never";
  const diff = Date.now() - secs * 1000;
  const m = Math.round(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

const nf = new Intl.NumberFormat("en-US");

export function Personalization() {
  const [status, setStatus] = useState<Status | null>(null);
  const [keyInput, setKeyInput] = useState("");
  const [savingKey, setSavingKey] = useState(false);
  const [keySaved, setKeySaved] = useState(false);
  const [togglish, setTogglish] = useState(false);
  const [resyncing, setResyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/personalization", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d?.status && setStatus(d.status))
      .catch(() => {});
  }, []);

  async function patch(body: Record<string, unknown>) {
    const r = await fetch("/api/personalization", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!r.ok) throw new Error("Save failed");
    const d = await r.json();
    setStatus(d.status);
  }

  async function toggle() {
    if (!status) return;
    setTogglish(true);
    setError(null);
    try {
      await patch({ atPersonalization: !status.atPersonalization });
    } catch {
      setError("Could not update the setting.");
    } finally {
      setTogglish(false);
    }
  }

  async function saveKey() {
    setSavingKey(true);
    setError(null);
    try {
      await patch({ geminiApiKey: keyInput.trim() });
      setKeyInput("");
      setKeySaved(true);
      setTimeout(() => setKeySaved(false), 1800);
    } catch {
      setError("Could not save the key.");
    } finally {
      setSavingKey(false);
    }
  }

  async function resync() {
    setResyncing(true);
    setError(null);
    try {
      const r = await fetch("/api/personalization/resync", { method: "POST" });
      const d = await r.json();
      if (!r.ok) throw new Error();
      if (d.status) setStatus(d.status);
      const c = d.result?.condense;
      if (c && !c.ok && c.error) setError(`Gemini: ${c.error}`);
    } catch {
      setError("Refresh failed. Check your Gemini key and try again.");
    } finally {
      setResyncing(false);
    }
  }

  const on = status?.atPersonalization ?? true;
  const artists = status?.facts?.topArtists ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <Sparkles className="h-5 w-5 text-primary" />
          Personalization
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Let atGPT learn from your public AT Protocol activity — your Bluesky
          posts, bio, and teal.fm music — for replies that feel like you.
        </p>
      </div>

      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}

      {/* On/off */}
      <Card>
        <CardHeader className="flex-row items-start justify-between gap-4 space-y-0">
          <div>
            <CardTitle className="text-base">AT Personalisation</CardTitle>
            <CardDescription className="mt-1">
              When on, your public posts and music taste are ingested and
              condensed into a short profile. Turn it off and nothing is used.
            </CardDescription>
          </div>
          <Switch checked={on} disabled={togglish || !status} onClick={toggle} />
        </CardHeader>
      </Card>

      <div className={cn("space-y-6 transition-opacity", !on && "pointer-events-none opacity-50")}>
        {/* Gemini key */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <KeyRound className="h-4 w-4" />
              Gemini API key
              {status?.hasGeminiKey && (
                <Badge variant="secondary" className="ml-1">
                  set
                </Badge>
              )}
            </CardTitle>
            <CardDescription>
              Your own key condenses your data into a tiny profile (one request,
              cached). It&apos;s stored encrypted and never leaves this server.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="gemini">
                {status?.hasGeminiKey ? "Replace key" : "Add key"}
              </Label>
              <div className="flex gap-2">
                <Input
                  id="gemini"
                  type="password"
                  autoComplete="off"
                  placeholder="AIza…"
                  className="font-mono"
                  value={keyInput}
                  onChange={(e) => setKeyInput(e.target.value)}
                  disabled={savingKey}
                />
                <Button onClick={saveKey} disabled={savingKey || !keyInput.trim()}>
                  {savingKey ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : keySaved ? (
                    <Check className="h-4 w-4" />
                  ) : null}
                  {keySaved ? "Saved" : "Save"}
                </Button>
              </div>
            </div>
            <a
              href="https://aistudio.google.com/apikey"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              Get a free Gemini key
              <ExternalLink className="h-3 w-3" />
            </a>
          </CardContent>
        </Card>

        {/* Profile / status */}
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="text-base">Your profile</CardTitle>
              <CardDescription className="mt-1">
                {status?.handle
                  ? `@${status.handle}`
                  : "Sign-in account"}{" "}
                · {nf.format(status?.counts.posts ?? 0)} posts ·{" "}
                {nf.format(status?.counts.plays ?? 0)} plays
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={resync}
              disabled={resyncing || !status}
            >
              <RefreshCw className={cn("h-4 w-4", resyncing && "animate-spin")} />
              {resyncing ? "Refreshing…" : "Refresh"}
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {status?.hasProfile ? (
              <p className="whitespace-pre-wrap rounded-lg bg-secondary/50 px-4 py-3 text-sm leading-relaxed">
                {status.profilePreview}
              </p>
            ) : (
              <p className="rounded-lg bg-secondary/40 px-4 py-3 text-sm text-muted-foreground">
                No profile yet.{" "}
                {status?.hasGeminiKey
                  ? "Hit Refresh to build one from your activity."
                  : "Add a Gemini key above, then Refresh."}
              </p>
            )}

            {artists.length > 0 && (
              <div>
                <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                  <Music className="h-3.5 w-3.5" />
                  Top artists
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {artists.slice(0, 10).map((a) => (
                    <span
                      key={a.name}
                      className="rounded-full bg-accent px-2.5 py-1 text-xs text-accent-foreground"
                    >
                      {a.name}
                      <span className="ml-1 text-muted-foreground">{a.plays}</span>
                    </span>
                  ))}
                </div>
              </div>
            )}

            <p className="text-xs text-muted-foreground">
              Synced {relTime(status?.lastIngestAt ?? null)} · profile built{" "}
              {relTime(status?.lastCondensedAt ?? null)}
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Switch({
  checked,
  disabled,
  onClick,
}: {
  checked: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label="Toggle AT Personalisation"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:opacity-50",
        checked ? "bg-primary" : "bg-input"
      )}
    >
      <span
        className={cn(
          "inline-block h-5 w-5 transform rounded-full bg-background shadow transition-transform",
          checked ? "translate-x-[22px]" : "translate-x-0.5"
        )}
      />
    </button>
  );
}
