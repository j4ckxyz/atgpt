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
          <div className="grid h-11 w-11 place-items-center rounded-2xl bg-primary text-sm font-extrabold text-primary-foreground">
            @
          </div>
          <Badge variant="outline">beta</Badge>
        </div>
        <CardTitle className="text-xl">Welcome to atGPT</CardTitle>
        <CardDescription>
          A ChatGPT-style interface for the co/core distributed network. Sign in
          with your co/core API key to start chatting.
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
                placeholder="sk-cocore-…"
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
            Your key is kept in a secure cookie on this site only. It is never
            exposed to the page or shared with anyone else.
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
              No key? Get one
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
