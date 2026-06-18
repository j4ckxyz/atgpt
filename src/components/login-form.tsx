"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { KeyRound, Loader2, ExternalLink, Github } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SITE } from "@/lib/site";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function LoginForm() {
  const router = useRouter();
  const [apiKey, setApiKey] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Sign in failed");
        return;
      }
      router.replace("/");
      router.refresh();
    } catch {
      setError("Network error — could not reach the server");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <div className="mb-2 flex items-center justify-between">
          <div className="grid h-10 w-10 place-items-center rounded-lg bg-primary text-primary-foreground font-mono font-bold">
            co
          </div>
          <Badge variant="outline">demo</Badge>
        </div>
        <CardTitle className="text-xl">Sign in to co/core</CardTitle>
        <CardDescription>
          An unofficial demo console. Your co/core API key is your identity — it
          resolves to your DID server-side. Paste a <code>cocore-…</code> key
          below to spend credits and chat across the cooperative.
        </CardDescription>
      </CardHeader>
      <form onSubmit={onSubmit}>
        <CardContent className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="apiKey">API key</Label>
            <div className="relative">
              <KeyRound className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="apiKey"
                type="password"
                autoComplete="off"
                placeholder="cocore-…"
                className="pl-9 font-mono"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                disabled={loading}
              />
            </div>
          </div>
          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            The key is stored only in a secure, httpOnly cookie on this site —
            it never reaches client-side JavaScript.
          </p>
        </CardContent>
        <CardFooter className="flex-col items-stretch gap-3">
          <Button type="submit" disabled={loading || !apiKey}>
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {loading ? "Verifying…" : "Sign in"}
          </Button>
          <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
            <a
              href={SITE.apiKeysUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 hover:text-foreground"
            >
              No key? Mint one
              <ExternalLink className="h-3 w-3" />
            </a>
            <a
              href={SITE.repoUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 hover:text-foreground"
            >
              <Github className="h-3 w-3" />
              Source
            </a>
          </div>
        </CardFooter>
      </form>
    </Card>
  );
}
